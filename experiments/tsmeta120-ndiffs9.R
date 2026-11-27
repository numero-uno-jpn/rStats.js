# tsmeta120-ndiffs9.R: urca's ur.pp, open point A (1.20.0, log item 88). Designed: type = "Z-alpha" with use.lag = 0..4.
# Z-alpha = n (rho - 1) - (1/2) (n^2 se^2 / s^2) (lambda^2 - gamma0) is linear in lambda^2, so each series gives the
# correction term directly; with use.lag = 0 it should vanish if lambda^2 = gamma0 with the same divisor. Also
# Z-tau and @auxstat for the same calls (consistency), and the scaled / shifted series y * 3, y + 5 (which quantities
# the statistic depends on). Same series as ndiffs8 (same seed).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(urca))
set.seed(20261203)
ys <- c(list(as.numeric(lh)), lapply(1:20, function(i) { n <- sample(c(30:60, 100:200), 1); cumsum(rnorm(n)) * runif(1, 0, 1) + rnorm(n) + 0.02 * (1:n) }))
one <- function(y, model, L) {
  za <- ur.pp(y, type = "Z-alpha", model = model, use.lag = L)
  zt <- ur.pp(y, type = "Z-tau", model = model, use.lag = L)
  list(alpha = unname(za@teststat), tau = unname(zt@teststat), aux_alpha = as.numeric(za@auxstat), aux_tau = as.numeric(zt@auxstat),
       aux_names = colnames(zt@auxstat), cval_alpha = as.numeric(za@cval))
}
rows <- list()
for (y in ys) {
  r <- list(y = y)
  for (model in c("constant", "trend")) {
    tr <- ur.pp(y, type = "Z-tau", model = model, use.lag = 0)@testreg
    r[[model]] <- list(coef = unname(tr$coefficients), sigma = tr$sigma, df = unname(tr$df),
                       lags = lapply(0:4, function(L) one(y, model, L)),
                       scaled = one(y * 3, model, 2), shifted = one(y + 5, model, 2))
  }
  rows[[length(rows) + 1]] <- r
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
