# tsmeta120-nsdiffs-ocsb3.R: forecast's ocsb.test lag selection, open point B (1.20.0, log item 89). Designed: series
# whose w = diff(diff(y, m)) is a strong AR(p), p = 0..3 (known true order, long series n = 240 / 400), built by
# integrating an AR simulation; ocsb.test's lag.order for AIC, BIC, AICc with maxlag 1..6 (does "at most maxlag - 1"
# persist, is the choice the true order, one less, or capped). Also the coefficient names and nobs of the AIC fit with
# maxlag 6 (which regression the chosen order belongs to).
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
  ch <- list()
  for (lm_ in c("AIC", "BIC", "AICc")) ch[[lm_]] <- sapply(1:6, function(ml) tc(ocsb.test(yy, lag.method = lm_, maxlag = ml)$lag.order))
  f <- tc(ocsb.test(yy, lag.method = "AIC", maxlag = 6)$fitted.model)
  rows[[length(rows) + 1]] <- list(m = m, p = p, n = length(y), choices = ch,
    fit_names = if (is.list(f)) names(coef(f)) else NA, fit_nobs = if (is.list(f)) nobs(f) else NA,
    w_check = max(abs(as.numeric(diff(diff(yy, lag = m))) - w)), y = y)
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
