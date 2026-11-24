# mediation116-reimpl.R: a candidate reimplementation of mediate written from the findings of mediation116*.R (see
# mediation116-log.md), compared with mediate over many settings (1.16.0): lm / logit / probit mediators and outcomes,
# covariates, a treatment-mediator interaction, binary and continuous treatments, robustSE, both interval types, and
# conf.level. Open points it settles: robustSE's covariance, the bootstrap's mediator error sd (refit or original), the
# outcome scale of glm outcomes. Nothing reads mediation's code.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(mediation); library(sandwich) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(R = R.version.string, arch = R.version$arch, mediation = as.character(packageVersion("mediation")))
set.seed(20261125)
n <- 70
C <- rnorm(n); C2 <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
Mc <- 0.5 * Xb + 0.2 * X + 0.3 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-0.5 + 0.9 * Xb + 0.1 * X + 0.4 * C))
Yc <- 0.4 * Mc + 0.6 * Mbin + 0.5 * Xb + 0.1 * X - 0.2 * C + 0.2 * C2 + rnorm(n)
Ybin <- rbinom(n, 1, plogis(-0.5 + 0.7 * Mc + 0.8 * Mbin + 0.6 * Xb + 0.1 * X))
d <- data.frame(C, C2, X, Xb, Mc, Mbin, Yc, Ybin)
assign("d", d, envir = globalenv())

sym_sqrt <- function(S) { e <- eigen(S, symmetric = TRUE); e$vectors %*% diag(sqrt(pmax(e$values, 0)), nrow(S)) %*% t(e$vectors) }
draw_rows <- function(mu, S, k) { p <- length(mu); Z <- matrix(rnorm(k * p), k, byrow = TRUE); sweep(Z %*% sym_sqrt(S), 2, mu, "+") }
vc <- function(f, use_hc, type) if (use_hc) vcovHC(f, type = type) else vcov(f)
is_lm <- function(f) !inherits(f, "glm") || family(f)$family == "gaussian"
linkinv <- function(f) if (inherits(f, "glm")) family(f)$linkinv else identity
# design matrices with the treatment (and the mediator) set
Xm_at <- function(fm, nd, treat, t) { nd[[treat]] <- t; model.matrix(delete.response(terms(fm)), model.frame(delete.response(terms(fm)), nd)) }
Xy_at <- function(fy, nd, treat, med, t, m) { nd[[treat]] <- t; nd[[med]] <- m; model.matrix(delete.response(terms(fy)), model.frame(delete.response(terms(fy)), nd)) }
# one set of effects for the parameter vectors a (mediator) and b (outcome) on data nd, with mediator draws
effects_one <- function(fm, fy, nd, treat, med, t1, t0, a, b, sd_m) {
  nn <- nrow(nd)
  if (is_lm(fm)) {
    e <- rnorm(nn, 0, sd_m)
    m1 <- as.vector(Xm_at(fm, nd, treat, t1) %*% a) + e; m0 <- as.vector(Xm_at(fm, nd, treat, t0) %*% a) + e
  } else {
    li <- linkinv(fm)
    m1 <- rbinom(nn, 1, li(as.vector(Xm_at(fm, nd, treat, t1) %*% a))); m0 <- rbinom(nn, 1, li(as.vector(Xm_at(fm, nd, treat, t0) %*% a)))
  }
  li <- linkinv(fy); mu <- function(t, m) li(as.vector(Xy_at(fy, nd, treat, med, t, m) %*% b))
  c(d0 = mean(mu(t0, m1) - mu(t0, m0)), d1 = mean(mu(t1, m1) - mu(t1, m0)),
    z0 = mean(mu(t1, m0) - mu(t0, m0)), z1 = mean(mu(t1, m1) - mu(t0, m1)), tau = mean(mu(t1, m1) - mu(t0, m0)))
}
my_mediate <- function(fm, fy, treat, med, t1, t0, sims, boot, ci_type, level, use_hc, hc_type) {
  nn <- nrow(d)
  if (!boot) {
    A <- draw_rows(coef(fm), vc(fm, use_hc, hc_type), sims); B <- draw_rows(coef(fy), vc(fy, use_hc, hc_type), sims)
    # mediator draws for all simulations at once: lm errors sims x n by column, binomial rbinom M(1) then M(0)
    if (is_lm(fm)) {
      E <- matrix(rnorm(sims * nn, 0, sigma(fm)), sims, nn)
      M1 <- A %*% t(Xm_at(fm, d, treat, t1)) + E; M0 <- A %*% t(Xm_at(fm, d, treat, t0)) + E
    } else {
      li <- linkinv(fm); P1 <- li(A %*% t(Xm_at(fm, d, treat, t1))); P0 <- li(A %*% t(Xm_at(fm, d, treat, t0)))
      M1 <- matrix(rbinom(sims * nn, 1, as.vector(P1)), sims, nn); M0 <- matrix(rbinom(sims * nn, 1, as.vector(P0)), sims, nn)
    }
    li <- linkinv(fy)
    S <- t(sapply(seq_len(sims), function(j) {
      mu <- function(t, m) li(as.vector(Xy_at(fy, d, treat, med, t, m) %*% B[j, ]))
      c(d0 = mean(mu(t0, M1[j, ]) - mu(t0, M0[j, ])), d1 = mean(mu(t1, M1[j, ]) - mu(t1, M0[j, ])),
        z0 = mean(mu(t1, M0[j, ]) - mu(t0, M0[j, ])), z1 = mean(mu(t1, M1[j, ]) - mu(t0, M1[j, ])),
        tau = mean(mu(t1, M1[j, ]) - mu(t0, M0[j, ])))
    }))
    point <- NULL
  } else {
    I <- matrix(sample(nn, nn * sims, replace = TRUE), sims, nn)
    invisible(effects_one(fm, fy, d, treat, med, t1, t0, coef(fm), coef(fy), if (is_lm(fm)) sigma(fm) else NA))
    S <- t(sapply(seq_len(sims), function(j) {
      dd <- d[I[j, ], ]; fm2 <- update(fm, data = dd); fy2 <- update(fy, data = dd)
      effects_one(fm2, fy2, d, treat, med, t1, t0, coef(fm2), coef(fy2), if (is_lm(fm2)) sigma(fm2) else NA)
    }))
    point <- effects_one(fm, fy, d, treat, med, t1, t0, coef(fm), coef(fy), if (is_lm(fm)) sigma(fm) else NA)
  }
  S <- cbind(S, n0 = S[, "d0"] / S[, "tau"], n1 = S[, "d1"] / S[, "tau"])
  S <- cbind(S, d.avg = (S[, "d0"] + S[, "d1"]) / 2, z.avg = (S[, "z0"] + S[, "z1"]) / 2, n.avg = (S[, "n0"] + S[, "n1"]) / 2)
  est <- if (is.null(point)) apply(S, 2, mean) else c(point, n0 = point[["d0"]] / point[["tau"]], n1 = point[["d1"]] / point[["tau"]],
    d.avg = (point[["d0"]] + point[["d1"]]) / 2, z.avg = (point[["z0"]] + point[["z1"]]) / 2,
    n.avg = (point[["d0"]] / point[["tau"]] + point[["d1"]] / point[["tau"]]) / 2)
  if (is.null(point)) { for (k in c("n0", "n1")) est[[k]] <- median(S[, k]); est[["n.avg"]] <- (est[["n0"]] + est[["n1"]]) / 2 }
  zq <- qnorm(c((1 - level) / 2, (1 + level) / 2))
  ci <- lapply(colnames(S), function(k) { v <- S[, k]
    if (boot && ci_type == "bca") { u <- mean(v) - v; a <- sum(u^3) / (6 * sum(u^2)^1.5); z0 <- qnorm(mean(v < mean(v)))
      unname(quantile(v, pnorm(z0 + (z0 + zq) / (1 - a * (z0 + zq))), type = 7)) }
    else unname(quantile(v, c((1 - level) / 2, (1 + level) / 2), type = 7)) })
  names(ci) <- colnames(S)
  p <- apply(S, 2, function(v) 2 * min(mean(v > 0), mean(v < 0)))
  list(S = S, est = est, ci = ci, p = p)
}
compare <- function(r, m) {
  keys <- c("d0", "d1", "z0", "z1", "tau", "n0", "n1", "d.avg", "z.avg", "n.avg")
  rk <- function(k) if (k == "tau") "tau" else k
  c(sims = max(sapply(keys, function(k) max(abs(as.vector(r[[paste0(rk(k), ".sims")]]) - m$S[, k])))),
    est = max(sapply(keys, function(k) abs(r[[if (k == "tau") "tau.coef" else k]] - m$est[[k]]))),
    ci = max(sapply(keys, function(k) max(abs(r[[paste0(k, ".ci")]] - m$ci[[k]])))),
    p = max(sapply(keys, function(k) abs(r[[paste0(k, ".p")]] - m$p[[k]]))))
}
models <- list(
  lm_lm = list(mm = lm(Mc ~ Xb + C, data = d), y = lm(Yc ~ Xb + Mc + C + C2, data = d), med = "Mc"),
  lm_lm_int = list(mm = lm(Mc ~ Xb + C, data = d), y = lm(Yc ~ Xb * Mc + C, data = d), med = "Mc"),
  lm_logit = list(mm = lm(Mc ~ Xb + C, data = d), y = glm(Ybin ~ Xb + Mc + C, family = binomial, data = d), med = "Mc"),
  lm_probit = list(mm = lm(Mc ~ Xb + C, data = d), y = glm(Ybin ~ Xb + Mc, family = binomial(link = "probit"), data = d), med = "Mc"),
  logit_lm = list(mm = glm(Mbin ~ Xb + C, family = binomial, data = d), y = lm(Yc ~ Xb + Mbin + C, data = d), med = "Mbin"),
  logit_logit_int = list(mm = glm(Mbin ~ Xb + C, family = binomial, data = d), y = glm(Ybin ~ Xb * Mbin + C, family = binomial, data = d), med = "Mbin"),
  probit_lm = list(mm = glm(Mbin ~ Xb, family = binomial(link = "probit"), data = d), y = lm(Yc ~ Xb + Mbin, data = d), med = "Mbin"))
settings <- list(
  quasi = list(boot = FALSE, ci = "perc", level = 0.95, robust = FALSE),
  quasi90 = list(boot = FALSE, ci = "perc", level = 0.9, robust = FALSE),
  quasi_robust_hc3 = list(boot = FALSE, ci = "perc", level = 0.95, robust = TRUE, hc = "HC3"),
  quasi_robust_hc0 = list(boot = FALSE, ci = "perc", level = 0.95, robust = TRUE, hc = "HC0"),
  boot_perc = list(boot = TRUE, ci = "perc", level = 0.95, robust = FALSE),
  boot_bca = list(boot = TRUE, ci = "bca", level = 0.95, robust = FALSE))
res <- list()
for (mn in names(models)) for (sn in names(settings)) {
  ms <- models[[mn]]; st <- settings[[sn]]; sims <- if (st$boot) 40 else 100
  if (st$robust && !is.null(st$hc) && st$hc == "HC0" && mn != "lm_lm") next
  set.seed(1234)
  r <- run(mediate(ms$mm, ms$y, treat = "Xb", mediator = ms$med, boot = st$boot, boot.ci.type = st$ci, sims = sims,
                   conf.level = st$level, robustSE = st$robust))
  if (!is.null(r$error)) { res[[paste(mn, sn)]] <- list(error = r$error); next }
  set.seed(1234)
  m <- run(my_mediate(ms$mm, ms$y, "Xb", ms$med, 1, 0, sims, st$boot, st$ci, st$level, st$robust, if (is.null(st$hc)) "HC3" else st$hc))
  res[[paste(mn, sn)]] <- if (!is.null(m$error)) list(mine_error = m$error) else as.list(compare(r$value, m$value))
}
# a continuous treatment at mean +- SD (ReactiveStat), default values 0 and 1, and treat.value / control.value reversed
mc <- list(mm = lm(Mc ~ X + C, data = d), y = lm(Yc ~ X + Mc + C, data = d))
for (tv in list(list(t1 = mean(X) + sd(X), t0 = mean(X) - sd(X), nm = "mean_sd"), list(t1 = 1, t0 = 0, nm = "default"),
                list(t1 = mean(X) - sd(X), t0 = mean(X) + sd(X), nm = "reversed"))) {
  set.seed(1234)
  r <- if (tv$nm == "default") mediate(mc$mm, mc$y, treat = "X", mediator = "Mc", sims = 100) else
    mediate(mc$mm, mc$y, treat = "X", mediator = "Mc", treat.value = tv$t1, control.value = tv$t0, sims = 100)
  set.seed(1234); m <- my_mediate(mc$mm, mc$y, "X", "Mc", tv$t1, tv$t0, 100, FALSE, "perc", 0.95, FALSE, "HC3")
  res[[paste("continuous", tv$nm)]] <- c(as.list(compare(r, m)), treat.value = r$treat.value, control.value = r$control.value)
}
out$compare <- res
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
# (second run: the candidate's n.avg changed from median(n.avg draws) to (n0 + n1) / 2, after this section showed it)
# added after the first run: the point estimates of the quasi-Bayesian runs that differed, per effect, against the
# mean and the median of the draws
ms <- models$lm_lm_int
set.seed(1234); r <- mediate(ms$mm, ms$y, treat = "Xb", mediator = ms$med, boot = FALSE, sims = 100)
keys <- c("d0", "d1", "z0", "z1", "tau", "n0", "n1", "d.avg", "z.avg", "n.avg")
per <- lapply(keys, function(k) { v <- as.vector(r[[paste0(k, ".sims")]]); g <- r[[if (k == "tau") "tau.coef" else k]]
  c(got = g, mean = mean(v), median = median(v)) })
names(per) <- keys
cat("\n"); cat(toJSON(list(per_effect = per), digits = I(17), auto_unbox = TRUE, pretty = TRUE))
