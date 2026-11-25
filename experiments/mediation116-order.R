# mediation116-order.R (second version): the order of mediate's draws for lm / lm (1.16.0), after mediation116.R found two mvrnorm
# calls and sims * n further normal draws. Candidates: the mediator model's parameters (A), the mediator's errors (E)
# and the outcome model's parameters (B) in each order; the ACME and ADE of linear models from A and B.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261125)
n <- 60
C <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
M <- 0.5 * X + 0.3 * C + rnorm(n); Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Y <- 0.4 * M + 0.2 * X - 0.2 * C + rnorm(n); Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
d <- data.frame(C, X, Xb, M, Mb, Y, Yb)
assign("d", d, envir = globalenv())
fm <- lm(M ~ X + C, data = d); fy <- lm(Y ~ X + M + C, data = d)
sims <- 50; cx <- mean(X) - sd(X); tx <- mean(X) + sd(X)
set.seed(1234)
r1 <- mediate(fm, fy, treat = "X", mediator = "M", control.value = cx, treat.value = tx, boot = FALSE, sims = sims)
d0 <- as.vector(r1$d0.sims); z0 <- as.vector(r1$z0.sims); tau <- as.vector(r1$tau.sims)
# the ADE of a linear outcome model is c' (t1 - t0) for each draw. Regress c' on blocks of sims consecutive normals of
# the stream (p blocks from offset k): an exact fit gives where the outcome model's draws start and the row of the
# factor of their covariance; the same for the mediator model's a from the ACME once c' and b are known
ratio_z <- z0 / (tx - cx)
set.seed(1234); stream <- rnorm(sims * n + 20 * sims)
fit_blocks <- function(target, p, by_k = 1) {
  best <- list(k = NA, r2 = 0)
  for (k in seq(0, length(stream) - p * sims, by = by_k)) {
    Z <- sapply(seq_len(p), function(j) stream[k + (j - 1) * sims + seq_len(sims)])
    f <- lm.fit(cbind(1, Z), target)
    r2 <- 1 - sum(f$residuals^2) / sum((target - mean(target))^2)
    if (r2 > best$r2) best <- list(k = k, r2 = r2, coef = unname(f$coefficients))
  }
  best
}
# interleaved draws (one mvrnorm call per simulation, or the two models' draws alternating): the j-th draw uses the
# normals at k + (j - 1) * stride + 0, ..., stride - 1
fit_stride <- function(target) {
  best <- list(k = NA, stride = NA, r2 = 0)
  for (stride in 1:12) for (k in 0:(length(stream) - sims * stride)) {
    Z <- t(sapply(seq_len(sims), function(jj) stream[k + (jj - 1) * stride + seq_len(stride)]))
    if (stride == 1) Z <- matrix(Z, ncol = 1)
    f <- lm.fit(cbind(1, Z), target)
    r2 <- 1 - sum(f$residuals^2) / sum((target - mean(target))^2)
    if (r2 > best$r2) best <- list(k = k, stride = stride, r2 = r2, coef = unname(f$coefficients))
  }
  best
}
out$ade_stride <- fit_stride(ratio_z)
# candidate: the normals fill a sims x p matrix by row and are multiplied by the symmetric square root of the
# covariance (V diag(sqrt(lambda)) V'), the mediator model first, then the outcome model, then sims * n normals
sym_sqrt <- function(S) { e <- eigen(S, symmetric = TRUE); e$vectors %*% diag(sqrt(pmax(e$values, 0)), nrow(S)) %*% t(e$vectors) }
draw_rows <- function(mu, S) {
  p <- length(mu); Z <- matrix(rnorm(sims * p), sims, byrow = TRUE)
  sweep(Z %*% sym_sqrt(S), 2, mu, "+")
}
set.seed(1234)
A <- draw_rows(coef(fm), vcov(fm)); B <- draw_rows(coef(fy), vcov(fy))
out$sym_candidate <- list(ade = max(abs(z0 - B[, 2] * (tx - cx))), acme = max(abs(d0 - A[, 2] * B[, 3] * (tx - cx))),
  total = max(abs(tau - (A[, 2] * B[, 3] + B[, 2]) * (tx - cx))), sym_row_X = sym_sqrt(vcov(fy))[2, ])
out$acme_stride <- fit_stride(d0 / (B[, 3] * (tx - cx)))
e <- eigen(vcov(fy), symmetric = TRUE)
out$factor_y <- e$vectors %*% diag(sqrt(e$values))
out$coef_y <- coef(fy)
out$first_sims <- list(d0 = d0[1:5], z0 = z0[1:5], tau = tau[1:5])
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
