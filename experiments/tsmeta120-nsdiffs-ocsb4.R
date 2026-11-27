# tsmeta120-nsdiffs-ocsb4.R: open point B (1.20.0, log item 89, follow-up). The series of ocsb3 (read from its JSON
# is not possible in the sandbox, so regenerated with the same seed and calls). For each series, the fixed-lag fits
# L = 0..6: AIC, BIC, logLik, nobs, number of coefficients, sigma2 and the statistic of ocsb.test(lag.method = "fixed",
# maxlag = L)$fitted.model; and for the AIC choice with maxlag 1..6, the statistic (to tie the choice to a fixed fit).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
set.seed(20261204)
tc <- function(expr) tryCatch(expr, error = function(err) NA)
phis <- list(numeric(0), c(0.7), c(0.6, -0.5), c(0.5, 0.2, -0.45))
rows <- list()
for (m in c(4, 12)) for (p in 0:3) for (rep in 1:6) {
  n <- if (m == 4) 240 else 400
  w <- if (p == 0) rnorm(n - m - 1) else as.numeric(arima.sim(list(ar = phis[[p + 1]]), n - m - 1))
  y <- as.numeric(diffinv(diffinv(w, lag = 1), lag = m)) + rnorm(1)
  yy <- ts(y, frequency = m)
  fixed <- lapply(0:6, function(L) tc({ o <- ocsb.test(yy, lag.method = "fixed", maxlag = L); f <- o$fitted.model
    list(aic = f$aic, aicc = f$aicc, bic = f$bic, AIC = AIC(f), BIC = BIC(f), loglik = f$loglik, nobs = nobs(f), k = length(coef(f)),
         sigma2 = f$sigma2, stat = unname(o$statistics), cls = class(f)[1]) }))
  aicstat <- sapply(1:6, function(ml) tc(unname(ocsb.test(yy, lag.method = "AIC", maxlag = ml)$statistics)))
  rows[[length(rows) + 1]] <- list(m = m, p = p, n = length(y), fixed = fixed, aic_stat = aicstat)
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
