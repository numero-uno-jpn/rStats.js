# regression117-betareg-resid2.R (after regression117-betareg-resid.R): the deviance residuals of betareg and the
# role of case weights in every residual type (1.17.0). The first script found (unweighted): weighted =
# (y* - mu*) / sqrt(phi v), sweighted = (y* - mu*) / sqrt(v), sweighted2 = sweighted / sqrt(1 - h), and that its
# deviance candidate (saturated mean = y) was wrong. Candidates here:
#   deviance: sign(y - mu) sqrt(2 (l_max(y) - l(y | mu))) with l_max the log-likelihood maximised over the mean in
#     (0, 1) at the fitted phi (optimize), or at the saturated mean y, sign by y - mu or by the sign of y* - mu*
#   weights: each type times sqrt(w), or not; the hat matrix with W including w (found in the first script)
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
out <- list(R = R.version.string, arch = R.version$arch, betareg = as.character(packageVersion("betareg")))
set.seed(20261129)
n <- 50
x1 <- rnorm(n); z1 <- rnorm(n); w <- rpois(n, 1.5) + 1
mu0 <- plogis(0.2 + 0.7 * x1); ph0 <- exp(2 + 0.6 * z1)
yv <- rbeta(n, mu0 * ph0, (1 - mu0) * ph0)
yc <- rbeta(n, mu0 * 15, (1 - mu0) * 15)
d <- data.frame(x1, z1, w, yv, yc)
assign("d", d, envir = globalenv())
mx <- function(a, b) max(abs(a - b))

cands <- function(f, X, y, wt) {
  mu <- predict(f, type = "response"); ph <- predict(f, type = "precision")
  ys <- qlogis(y); ms <- digamma(mu * ph) - digamma((1 - mu) * ph)
  v <- trigamma(mu * ph) + trigamma((1 - mu) * ph)
  ll <- function(m, i) dbeta(y[i], m * ph[i], (1 - m) * ph[i], log = TRUE)
  lmax <- sapply(seq_along(y), function(i) optimize(function(m) ll(m, i), c(1e-10, 1 - 1e-10), maximum = TRUE, tol = 1e-12)$objective)
  lsat <- sapply(seq_along(y), function(i) ll(y[i], i))
  lmu <- sapply(seq_along(y), function(i) ll(mu[i], i))
  Xw <- sqrt(wt * ph * v * (mu * (1 - mu))^2) * X; h <- rowSums((Xw %*% solve(crossprod(Xw))) * Xw)
  r <- function(type) as.numeric(residuals(f, type = type))
  sw <- sqrt(wt)
  base <- list(quantile = qnorm(pbeta(y, mu * ph, (1 - mu) * ph)), pearson = (y - mu) / sqrt(mu * (1 - mu) / (1 + ph)),
               response = y - mu, weighted = (ys - ms) / sqrt(ph * v), sweighted = (ys - ms) / sqrt(v),
               sweighted2 = (ys - ms) / sqrt(v * (1 - h)))
  dev <- list(max_sign_y = sign(y - mu) * sqrt(2 * (lmax - lmu)), max_sign_star = sign(ys - ms) * sqrt(2 * (lmax - lmu)),
              sat_sign_y = sign(y - mu) * sqrt(2 * pmax(lsat - lmu, 0)))
  list(plain = c(sapply(base, function(b) mx(r(names(base)[which(sapply(base, identical, b))[1]]), b)),
                 sapply(dev, function(b) mx(r("deviance"), b))),
       sqrtw = c(sapply(names(base), function(nm) mx(r(nm), sw * base[[nm]])),
                 sapply(dev, function(b) mx(r("deviance"), sw * b))),
       lmax_minus_lsat = range(lmax - lsat))
}
X <- cbind(1, x1)
out$const <- cands(betareg(yc ~ x1, data = d), X, yc, rep(1, n))
out$var <- cands(betareg(yv ~ x1 | z1, data = d), X, yv, rep(1, n))
out$const_weights <- cands(betareg(yc ~ x1, data = d, weights = w), X, yc, w)
out$var_weights <- cands(betareg(yv ~ x1 | z1, data = d, weights = w), X, yv, w)
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
