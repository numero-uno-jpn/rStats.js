# mediation116-boot.R: mediate with boot = TRUE (nonparametric bootstrap), public functions only (1.16.0). Settles: how
# the resamples are drawn (sample() per replicate, and what else uses the generator), the models refitted on each
# resample, the point estimates, and the percentile and BCa intervals.
# Candidate formulas are written here and compared with the output.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation) })
out <- list(R = R.version.string, arch = R.version$arch, mediation = as.character(packageVersion("mediation")))
set.seed(20261125)
n <- 60
C <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-1 + 0.9 * Xb + 0.4 * C))
Ycont2 <- 0.9 * Mbin + 0.4 * Xb + rnorm(n)
d <- data.frame(C, X, Xb, Mb, Yb, Mbin, Ycont2)
assign("d", d, envir = globalenv())
sims <- 30
fm <- lm(Mb ~ Xb + C, data = d); fy <- lm(Yb ~ Xb + Mb + C, data = d)
grab <- function(r) list(d0 = r$d0, d1 = r$d1, z0 = r$z0, tau = r$tau.coef, n0 = r$n0, d0.ci = r$d0.ci, z0.ci = r$z0.ci,
  tau.ci = r$tau.ci, n0.ci = r$n0.ci, d0.p = r$d0.p, z0.p = r$z0.p, tau.p = r$tau.p, n0.p = r$n0.p,
  d0.sims = as.vector(r$d0.sims), z0.sims = as.vector(r$z0.sims), tau.sims = as.vector(r$tau.sims),
  n0.sims = as.vector(r$n0.sims), boot = r$boot, boot.ci.type = r$boot.ci.type)

set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims)
st <- .Random.seed
out$perc <- grab(r)
set.seed(1234); rb <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = sims, boot.ci.type = "bca")
out$bca <- grab(rb)
out$bca_same_draws <- max(abs(out$bca$d0.sims - out$perc$d0.sims))

# analytic effects on the original data: a b and c'
ab <- function(dd) { m <- lm(Mb ~ Xb + C, data = dd); y <- lm(Yb ~ Xb + Mb + C, data = dd)
  c(acme = unname(coef(m)["Xb"] * coef(y)["Mb"]), ade = unname(coef(y)["Xb"])) }
out$original <- ab(d)

# candidates for the resamples: (1) per replicate sample(n, n, replace = TRUE) then n mediator errors; (2) the same
# without the errors; (3) all the index vectors first
cand <- function(kind) {
  set.seed(1234); acme <- ade <- numeric(sims)
  if (kind == "all_first") idx <- lapply(seq_len(sims), function(j) sample(n, n, replace = TRUE))
  for (j in seq_len(sims)) {
    ii <- if (kind == "all_first") idx[[j]] else sample(n, n, replace = TRUE)
    e <- ab(d[ii, ]); acme[j] <- e[["acme"]]; ade[j] <- e[["ade"]]
    if (kind == "with_errors") invisible(rnorm(n))
  }
  list(acme = max(abs(acme - out$perc$d0.sims)), ade = max(abs(ade - out$perc$z0.sims)), state = identical(.Random.seed, st))
}
out$candidates <- lapply(c(with_errors = "with_errors", no_errors = "no_errors", all_first = "all_first"), cand)

# the offsets (in uniform draws from set.seed(1234)) at which sample(n, n, replace = TRUE) gives the resample of each of
# the first three replicates (the search found nothing with whole normal draws, see mediation116-boot-count.R)
offsets <- function(target, what, from, to) {
  hits <- integer(0)
  for (k in from:to) {
    set.seed(1234); if (k > 0) invisible(runif(k)); ii <- sample(n, n, replace = TRUE)
    if (abs(ab(d[ii, ])[[what]] - target) < 1e-12) hits <- c(hits, k)
  }
  hits
}
out$offsets <- lapply(1:3, function(j) offsets(out$perc$d0.sims[j], "acme", 0, 1200))
out$offsets_ade <- lapply(1:3, function(j) offsets(out$perc$z0.sims[j], "ade", 0, 1200))
# one call sample(n, n * sims, TRUE) laid out as a sims x n matrix by column (replicate j = row j), after k uniforms
out$one_call_rows <- {
  hits <- list()
  for (k in 0:600) {
    set.seed(1234); if (k > 0) invisible(runif(k)); I <- matrix(sample(n, n * sims, replace = TRUE), sims, n)
    v <- sapply(1:3, function(jj) ab(d[I[jj, ], ])[["ade"]])
    if (max(abs(v - out$perc$z0.sims[1:3])) < 1e-12) {
      all_ade <- sapply(seq_len(sims), function(jj) ab(d[I[jj, ], ]))
      hits[[length(hits) + 1]] <- list(k = k, ade = max(abs(all_ade["ade", ] - out$perc$z0.sims)),
                                      acme = max(abs(all_ade["acme", ] - out$perc$d0.sims)))
    }
  }
  hits
}
# percentile and BCa candidates
q7 <- function(v) unname(quantile(v, c(0.025, 0.975), type = 7))
out$perc_q7 <- list(d0 = q7(out$perc$d0.sims), z0 = q7(out$perc$z0.sims), mean = mean(out$perc$d0.sims),
                    median_n0 = median(out$perc$n0.sims))

# a logit mediator with the bootstrap (draws per replicate)
fm2 <- glm(Mbin ~ Xb + C, family = binomial, data = d); fy2 <- lm(Ycont2 ~ Xb + Mbin + C, data = d)
set.seed(1234); r2 <- mediate(fm2, fy2, treat = "Xb", mediator = "Mbin", boot = TRUE, sims = sims)
out$logit_perc <- grab(r2)
# the binomial mediator with the bootstrap: after the index matrix, the original data's draws first or last, and in each
# replicate rbinom for M(1) then M(0); the effect of an lm outcome is b mean(M(1) - M(0))
fit2 <- function(dd) list(mm = glm(Mbin ~ Xb + C, family = binomial, data = dd), y = lm(Ycont2 ~ Xb + Mbin + C, data = dd))
eff2 <- function(dd, f) {
  p1 <- predict(f$mm, newdata = transform(dd, Xb = 1), type = "response")
  p0 <- predict(f$mm, newdata = transform(dd, Xb = 0), type = "response")
  m1 <- rbinom(nrow(dd), 1, p1); m0 <- rbinom(nrow(dd), 1, p0)
  unname(coef(f$y)["Mbin"] * mean(m1 - m0))
}
out$logit_boot_order <- lapply(c(original_first = TRUE, original_last = FALSE), function(first) {
  set.seed(1234); I <- matrix(sample(n, n * sims, replace = TRUE), sims, n)
  orig <- NA; if (first) orig <- eff2(d, fit2(d))
  reps <- sapply(seq_len(sims), function(jj) { dd <- d[I[jj, ], ]; eff2(dd, fit2(dd)) })
  if (!first) orig <- eff2(d, fit2(d))
  list(reps = max(abs(reps - out$logit_perc$d0.sims)), orig = orig, got_d0 = out$logit_perc$d0)
})
# brute force for the first replicate: k uniforms after the index matrix, then rbinom for M(1) and M(0) in either order
out$logit_boot_offsets <- {
  set.seed(1234); I <- matrix(sample(n, n * sims, replace = TRUE), sims, n); st_I <- .Random.seed
  dd <- d[I[1, ], ]; f <- fit2(dd)
  p1 <- predict(f$mm, newdata = transform(dd, Xb = 1), type = "response")
  p0 <- predict(f$mm, newdata = transform(dd, Xb = 0), type = "response")
  target <- out$logit_perc$d0.sims[1] / unname(coef(f$y)["Mbin"])
  hits <- list()
  for (k in 0:400) for (ord in c("M1_first", "M0_first")) {
    assign(".Random.seed", st_I, envir = globalenv()); if (k > 0) invisible(runif(k))
    if (ord == "M1_first") { m1 <- rbinom(n, 1, p1); m0 <- rbinom(n, 1, p0) } else { m0 <- rbinom(n, 1, p0); m1 <- rbinom(n, 1, p1) }
    if (abs(mean(m1 - m0) - target) < 1e-12) hits[[length(hits) + 1]] <- list(k = k, ord = ord)
  }
  list(target = target, hits = hits)
}
# larger sims for the BCa formula
set.seed(1234); rb2 <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = 400, boot.ci.type = "bca")
out$bca400 <- grab(rb2)
set.seed(1234); rp2 <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = 400)
out$perc400 <- grab(rp2)

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
