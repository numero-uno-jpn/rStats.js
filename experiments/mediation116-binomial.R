# mediation116-binomial.R: how mediate predicts the mediator with binomial glm models (1.16.0), after
# mediation116-summary.R found sims * n normal draws' worth of the generator (2 sims n uniforms) after the parameter
# draws. Candidates: an lm mediator gets normal errors (layout by simulation or by observation, sd = sigma or the ML
# estimate) shared by M(1) and M(0); a binomial mediator gets rbinom draws for M(1) and M(0) in several layouts.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation) })
out <- list(R = R.version.string, arch = R.version$arch, mediation = as.character(packageVersion("mediation")))
set.seed(20261125)
n <- 60
C <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
M <- 0.5 * X + 0.3 * C + rnorm(n); Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Y <- 0.4 * M + 0.2 * X - 0.2 * C + rnorm(n); Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-1 + 0.9 * Xb + 0.4 * C))
Ybin <- rbinom(n, 1, plogis(-0.5 + 0.8 * Mb + 0.6 * Xb))
Ybin2 <- rbinom(n, 1, plogis(-0.5 + 1.2 * Mbin + 0.6 * Xb))
Ycont2 <- 0.9 * Mbin + 0.4 * Xb + rnorm(n)
d <- data.frame(C, X, Xb, M, Mb, Y, Yb, Mbin, Ybin, Ybin2, Ycont2)
assign("d", d, envir = globalenv())
sims <- 40
sym_sqrt <- function(S) { e <- eigen(S, symmetric = TRUE); e$vectors %*% diag(sqrt(pmax(e$values, 0)), nrow(S)) %*% t(e$vectors) }
draw_rows <- function(mu, S, k) { p <- length(mu); Z <- matrix(rnorm(k * p), k, byrow = TRUE); sweep(Z %*% sym_sqrt(S), 2, mu, "+") }
Xm <- function(t) cbind(1, t, C)   # the mediator model's design at Xb = t

## 1. lm mediator, logit outcome
fm <- lm(Mb ~ Xb + C, data = d); fy <- glm(Ybin ~ Xb + Mb + C, family = binomial, data = d)
set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = FALSE, sims = sims)
d0 <- as.vector(r$d0.sims); d1 <- as.vector(r$d1.sims); z0 <- as.vector(r$z0.sims)
sig <- c(sigma = sigma(fm), ml = sqrt(mean(residuals(fm)^2)))
res1 <- list()
for (lay in c("by_sim", "by_obs")) for (sn in names(sig)) {
  set.seed(1234); A <- draw_rows(coef(fm), vcov(fm), sims); B <- draw_rows(coef(fy), vcov(fy), sims)
  e <- rnorm(sims * n, 0, sig[[sn]])
  E <- if (lay == "by_sim") matrix(e, sims, n, byrow = TRUE) else matrix(e, sims, n)
  cd0 <- cd1 <- cz0 <- numeric(sims)
  for (j in seq_len(sims)) {
    m1 <- as.vector(Xm(1) %*% A[j, ]) + E[j, ]; m0 <- as.vector(Xm(0) %*% A[j, ]) + E[j, ]
    py <- function(t, m) plogis(B[j, 1] + B[j, 2] * t + B[j, 3] * m + B[j, 4] * C)
    cd0[j] <- mean(py(0, m1) - py(0, m0)); cd1[j] <- mean(py(1, m1) - py(1, m0)); cz0[j] <- mean(py(1, m0) - py(0, m0))
  }
  res1[[paste(lay, sn)]] <- c(d0 = max(abs(d0 - cd0)), d1 = max(abs(d1 - cd1)), z0 = max(abs(z0 - cz0)))
}
out$lm_logit <- res1

## 2. logit mediator, lm outcome: mean(M(1) - M(0)) per draw is d0 / b
fm2 <- glm(Mbin ~ Xb + C, family = binomial, data = d); fy2 <- lm(Ycont2 ~ Xb + Mbin + C, data = d)
set.seed(1234); r2 <- mediate(fm2, fy2, treat = "Xb", mediator = "Mbin", boot = FALSE, sims = sims)
set.seed(1234); A <- draw_rows(coef(fm2), vcov(fm2), sims); B <- draw_rows(coef(fy2), vcov(fy2), sims)
target <- as.vector(r2$d0.sims) / B[, 3]
out$logit_lm_z0_check <- max(abs(as.vector(r2$z0.sims) - B[, 2]))
P1 <- plogis(A %*% t(Xm(1))); P0 <- plogis(A %*% t(Xm(0)))   # sims x n
layouts <- list(
  M1_then_M0_by_sim = function() { a <- matrix(rbinom(sims * n, 1, as.vector(t(P1))), sims, n, byrow = TRUE); b <- matrix(rbinom(sims * n, 1, as.vector(t(P0))), sims, n, byrow = TRUE); list(a, b) },
  M1_then_M0_by_obs = function() { a <- matrix(rbinom(sims * n, 1, as.vector(P1)), sims, n); b <- matrix(rbinom(sims * n, 1, as.vector(P0)), sims, n); list(a, b) },
  M0_then_M1_by_sim = function() { b <- matrix(rbinom(sims * n, 1, as.vector(t(P0))), sims, n, byrow = TRUE); a <- matrix(rbinom(sims * n, 1, as.vector(t(P1))), sims, n, byrow = TRUE); list(a, b) },
  M0_then_M1_by_obs = function() { b <- matrix(rbinom(sims * n, 1, as.vector(P0)), sims, n); a <- matrix(rbinom(sims * n, 1, as.vector(P1)), sims, n); list(a, b) },
  per_sim_M1_M0 = function() { a <- b <- matrix(0, sims, n); for (j in seq_len(sims)) { a[j, ] <- rbinom(n, 1, P1[j, ]); b[j, ] <- rbinom(n, 1, P0[j, ]) }; list(a, b) },
  per_sim_M0_M1 = function() { a <- b <- matrix(0, sims, n); for (j in seq_len(sims)) { b[j, ] <- rbinom(n, 1, P0[j, ]); a[j, ] <- rbinom(n, 1, P1[j, ]) }; list(a, b) },
  one_uniform = function() { u <- matrix(runif(sims * n), sims, n, byrow = TRUE); list((u < P1) + 0, (u < P0) + 0) },
  one_uniform_obs = function() { u <- matrix(runif(sims * n), sims, n); list((u < P1) + 0, (u < P0) + 0) })
out$logit_lm <- lapply(layouts, function(f) {
  set.seed(1234); invisible(draw_rows(coef(fm2), vcov(fm2), sims)); invisible(draw_rows(coef(fy2), vcov(fy2), sims))
  ab <- f(); max(abs(target - rowMeans(ab[[1]] - ab[[2]])))
})
out$logit_lm_target_head <- head(target)

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
