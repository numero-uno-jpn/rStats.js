# mediation116-bca.R: mediate's BCa intervals (boot = TRUE, boot.ci.type = "bca") for lm / lm (1.16.0). The replicates
# are those settled in mediation116-boot*.R. Candidates: bias correction z0 = qnorm(mean(reps < est)) or with <=;
# acceleration 0, from the jackknife of the original data, or from the replicates' skewness; the adjusted levels read
# with quantile types 7 and 6 or by interpolation of the order statistics on the normal scale.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(mediation))
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261125)
n <- 60
C <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
d <- data.frame(C, X, Xb, Mb, Yb)
assign("d", d, envir = globalenv())
fm <- lm(Mb ~ Xb + C, data = d); fy <- lm(Yb ~ Xb + Mb + C, data = d)
effs <- function(dd) { m <- lm(Mb ~ Xb + C, data = dd); y <- lm(Yb ~ Xb + Mb + C, data = dd)
  a <- unname(coef(m)["Xb"]); b <- unname(coef(y)["Mb"]); cc <- unname(coef(y)["Xb"])
  c(d0 = a * b, z0 = cc, tau = a * b + cc, n0 = a * b / (a * b + cc)) }
interp_norm <- function(v, alpha) {   # order statistics read on the normal scale (k = (R + 1) alpha)
  t <- sort(v); R <- length(t); r <- (R + 1) * alpha; k <- trunc(r)
  sapply(seq_along(alpha), function(i) {
    if (k[i] == r[i]) return(t[k[i]])
    if (k[i] == 0) return(t[1]); if (k[i] == R) return(t[R])
    tk <- qnorm(c(k[i], k[i] + 1, r[i] * 1) / (R + 1)); t[k[i]] + (tk[3] - tk[1]) / (tk[2] - tk[1]) * (t[k[i] + 1] - t[k[i]]) })
}
res <- list()
for (sims in c(400, 999)) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims, boot.ci.type = "bca")
  got <- list(d0 = r$d0.ci, z0 = r$z0.ci, tau = r$tau.ci, n0 = r$n0.ci)
  sims_of <- list(d0 = as.vector(r$d0.sims), z0 = as.vector(r$z0.sims), tau = as.vector(r$tau.sims), n0 = as.vector(r$n0.sims))
  est <- effs(d)
  jack <- t(sapply(seq_len(n), function(i) effs(d[-i, ])))
  acc <- function(v) { u <- mean(v) - v; sum(u^3) / (6 * sum(u^2)^1.5) }
  per <- list()
  for (nm in names(got)) {
    v <- sims_of[[nm]]; e <- est[[nm]]
    zs <- c(lt = qnorm(mean(v < e)), le = qnorm(mean(v <= e)))
    as <- c(zero = 0, jack = acc(jack[, nm]), jack_neg = -acc(jack[, nm]), boot = acc(v), boot_neg = -acc(v))
    cands <- list()
    for (zn in names(zs)) for (an in names(as)) {
      z0 <- zs[[zn]]; a <- as[[an]]; zq <- qnorm(c(0.025, 0.975))
      al <- pnorm(z0 + (z0 + zq) / (1 - a * (z0 + zq)))
      cands[[paste(zn, an, "q7")]] <- max(abs(unname(quantile(v, al, type = 7)) - got[[nm]]))
      cands[[paste(zn, an, "q6")]] <- max(abs(unname(quantile(v, al, type = 6)) - got[[nm]]))
      cands[[paste(zn, an, "interp")]] <- max(abs(interp_norm(v, al) - got[[nm]]))
    }
    best <- names(cands)[order(unlist(cands))][1:4]
    per[[nm]] <- list(got = got[[nm]], best = best, best_diff = unlist(cands[best]))
  }
  res[[paste0("sims", sims)]] <- per
}
out$bca <- res

# added after the first run: the details of the candidate "lt, boot, q7" (exact for z0 at sims = 400 only), for every
# effect and both sims: the adjusted levels, the candidate interval and R's
detail <- list()
for (sims in c(400, 999)) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims, boot.ci.type = "bca")
  est <- effs(d)
  for (nm in c("d0", "z0", "tau", "n0")) {
    v <- as.vector(r[[paste0(nm, ".sims")]]); e <- est[[nm]]; u <- mean(v) - v; a <- sum(u^3) / (6 * sum(u^2)^1.5)
    z0 <- qnorm(mean(v < e)); zq <- qnorm(c(0.025, 0.975)); al <- pnorm(z0 + (z0 + zq) / (1 - a * (z0 + zq)))
    detail[[paste0(nm, "_", sims)]] <- list(est = e, got_point = r[[if (nm == "tau") "tau.coef" else nm]], prop_below = mean(v < e),
      a = a, levels = al, cand = unname(quantile(v, al, type = 7)), got = r[[paste0(nm, ".ci")]])
  }
}
out$detail <- detail

# added after the second run: invert R's interval ends to the levels p with quantile(v, p, type = 7) = end, then solve
# qnorm(p) = z0 + (z0 + zq) / (1 - a (z0 + zq)) for z0 and a from the two ends
inv_q7 <- function(v, x) { t <- sort(v); R <- length(t); k <- findInterval(x, t); if (k < 1 || k >= R) return(NA)
  ((k - 1) + (x - t[k]) / (t[k + 1] - t[k])) / (R - 1) }
solved <- list()
for (sims in c(400, 999)) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims, boot.ci.type = "bca")
  for (nm in c("d0", "z0", "tau", "n0")) {
    v <- as.vector(r[[paste0(nm, ".sims")]]); g <- r[[paste0(nm, ".ci")]]
    p <- c(inv_q7(v, g[1]), inv_q7(v, g[2])); zq <- qnorm(c(0.025, 0.975))
    f <- function(par) sum((qnorm(p) - (par[1] + (par[1] + zq) / (1 - par[2] * (par[1] + zq))))^2)
    sol <- if (anyNA(p)) c(NA, NA) else optim(c(0, 0), f, control = list(reltol = 1e-14))$par
    solved[[paste0(nm, "_", sims)]] <- list(levels = p, z0 = sol[1], a = sol[2], pnorm_z0 = pnorm(sol[1]),
      prop_below_est = mean(v < effs(d)[[nm]]), prop_below_point = mean(v < r[[if (nm == "tau") "tau.coef" else nm]]))
  }
}
out$solved <- solved

# added after the third run: the acceleration is the replicates' skewness in every case; Phi(z0) is a count / sims but
# not mean(v < est) except for z0. Which reference gives that count: every effect's point estimate, mean(v), median(v)
refs <- list()
for (sims in c(400, 999)) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims, boot.ci.type = "bca")
  pts <- c(d0 = r$d0, d1 = r$d1, z0 = r$z0, z1 = r$z1, tau = r$tau.coef, n0 = r$n0, n1 = r$n1, d.avg = r$d.avg,
           z.avg = r$z.avg, n.avg = r$n.avg)
  for (nm in c("d0", "z0", "tau", "n0")) {
    v <- as.vector(r[[paste0(nm, ".sims")]])
    target <- pnorm(solved[[paste0(nm, "_", sims)]]$z0)
    props <- c(sapply(pts, function(p) mean(v < p)), mean = mean(v < mean(v)), median = mean(v < median(v)))
    refs[[paste0(nm, "_", sims)]] <- list(target = target, match = names(props)[abs(props - target) < 1e-6], props = props)
  }
}
out$refs <- refs

# added after the fourth run: the whole candidate, z0 = qnorm(mean(v < mean(v))), a = sum(u^3) / (6 sum(u^2)^1.5) with
# u = mean(v) - v, levels pnorm(z0 + (z0 + zq) / (1 - a (z0 + zq))), quantile type 7; also at conf.level = 0.9
final <- list()
for (cl in c(0.95, 0.9)) for (sims in c(400, 999)) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims, boot.ci.type = "bca", conf.level = cl)
  for (nm in c("d0", "d1", "z0", "z1", "tau", "n0", "n1", "d.avg", "z.avg", "n.avg")) {
    v <- as.vector(r[[paste0(nm, ".sims")]]); u <- mean(v) - v; a <- sum(u^3) / (6 * sum(u^2)^1.5)
    z0 <- qnorm(mean(v < mean(v))); zq <- qnorm(c((1 - cl) / 2, (1 + cl) / 2))
    cand <- unname(quantile(v, pnorm(z0 + (z0 + zq) / (1 - a * (z0 + zq))), type = 7))
    final[[paste(nm, sims, cl)]] <- max(abs(cand - r[[paste0(nm, ".ci")]]))
  }
}
out$final <- final
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
