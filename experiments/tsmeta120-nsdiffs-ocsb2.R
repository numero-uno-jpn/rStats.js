# tsmeta120-nsdiffs-ocsb2.R: forecast's ocsb.test lag selection (1.20.0, log item 86), with public building blocks
# compared inside R. The same 300 series as tsmeta120-nsdiffs-ocsb.R (same seed and generator calls). Recorded:
#   - ocsb.test's chosen lag for lag.method AIC, BIC, AICc and maxlag 1, 2, 3 (9 choices: the criteria differ only in
#     the penalty, so together they bound the log-likelihood differences between lags);
#   - candidates for the criterion behind the choice, all from public functions, for w = diff(diff(y, m)):
#     ar(w, order.max = 3, aic = TRUE) for method "ols" (demean = FALSE, intercept = FALSE; and the defaults),
#     "yule-walker", "burg", "mle" ($order, $aic); Arima(w, c(L, 0, 0), include.mean = FALSE)'s aic, aicc, bic and
#     loglik for L = 0..3; AIC, BIC, logLik and nobs of ocsb.test(lag.method = "fixed", maxlag = L)$fitted.model for
#     L = 0..3; AIC of lm(w_t ~ w_{t-1..L} - 1) on its own rows and on the rows of L = 3.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
set.seed(20261130)
rows <- list()
tc <- function(expr) tryCatch(expr, error = function(err) NA)
for (it in 1:300) {
  m <- sample(c(4, 12), 1); n <- sample((2 * m + 1):(12 * m), 1); kind <- it %% 3
  e <- rnorm(n); y <- e
  if (kind == 0) for (t in (m + 1):n) y[t] <- y[t - m] + e[t]
  if (kind == 1) y <- 2 * sin(2 * pi * (1:n) / m) + e
  if (kind == 2) for (t in (m + 1):n) y[t] <- runif(1, 0.3, 0.95) * y[t - m] + e[t]
  yy <- ts(y, frequency = m); w <- as.numeric(diff(diff(yy, lag = m)))
  ch <- list()
  for (lm_ in c("AIC", "BIC", "AICc")) for (ml in 1:3) ch[[paste(lm_, ml, sep = "_")]] <- tc(ocsb.test(yy, lag.method = lm_, maxlag = ml)$lag.order)
  arOrd <- list(ols0 = tc(ar(w, order.max = 3, aic = TRUE, method = "ols", demean = FALSE, intercept = FALSE)$order),
                ols = tc(ar(w, order.max = 3, aic = TRUE, method = "ols")$order),
                yw = tc(ar(w, order.max = 3, aic = TRUE, method = "yule-walker")$order),
                yw0 = tc(ar(w, order.max = 3, aic = TRUE, method = "yule-walker", demean = FALSE)$order),
                burg = tc(ar(w, order.max = 3, aic = TRUE, method = "burg")$order),
                mle = tc(ar(w, order.max = 3, aic = TRUE, method = "mle")$order))
  arim <- lapply(0:3, function(L) tc({ f <- Arima(w, order = c(L, 0, 0), include.mean = FALSE); c(aic = f$aic, aicc = f$aicc, bic = f$bic, loglik = f$loglik) }))
  fixedLm <- lapply(0:3, function(L) tc({ f <- ocsb.test(yy, lag.method = "fixed", maxlag = L)$fitted.model
    c(aic = AIC(f), bic = BIC(f), loglik = as.numeric(logLik(f)), nobs = nobs(f), k = length(coef(f))) }))
  lagLm <- lapply(0:3, function(L) tc({ N <- length(w)
    own <- if (L == 0) sum(w^2) else { X <- embed(w, L + 1); sum(lm.fit(X[, -1, drop = FALSE], X[, 1])$residuals^2) }
    c(rss_own = own, n_own = N - L) }))
  rows[[it]] <- list(m = m, n = n, kind = kind, y = y, choices = ch, ar = arOrd, arima = arim, fixed_lm = fixedLm, lag_lm = lagLm)
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
