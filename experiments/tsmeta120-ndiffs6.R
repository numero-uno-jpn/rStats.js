# tsmeta120-ndiffs6.R: forecast's ndiffs(test = "pp", type = "trend"), third experiment (1.20.0, log item 85), with
# public building blocks compared inside R. ?ndiffs passes `...` to the unit root test:
#   (a) which test is behind it: ndiffs(x, test = "pp", type = "trend", lags = "long") (urca's ur.pp argument) and
#       ndiffs(x, ..., lshort = FALSE) (tseries' pp.test argument), each in tryCatch, beside the default call;
#   (b) R's p-value at d = 0 recovered by bisection on alpha in (0.01, 0.1) (as ndiffs4 run 4), beside
#       ur.pp(x, type = "Z-tau", model = "trend", lags = "short")'s @teststat, @cval (1, 5, 10%) and @lag, and the same
#       for model = "constant" and type = "level" (a check of the level case of log 40-41).
# Designed: near-unit-root series with a trend, lengths across 20..300, so that p falls inside (0.01, 0.1).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(forecast); library(urca) })
out <- list(R = R.version.string, arch = R.version$arch, urca = as.character(packageVersion("urca")))
pOf <- function(y, type) { lo <- 0.01; hi <- 0.1 - 1e-9
  if (ndiffs(y, alpha = lo, test = "pp", type = type) == 0) return(NA)
  if (ndiffs(y, alpha = hi, test = "pp", type = type) >= 1) return(hi)
  for (k in 1:45) { mid <- (lo + hi) / 2; if (ndiffs(y, alpha = mid, test = "pp", type = type) >= 1) lo <- mid else hi <- mid }
  (lo + hi) / 2 }
urp <- function(y, model, lg) { u <- ur.pp(y, type = "Z-tau", model = model, lags = lg)
  list(stat = unname(u@teststat), cval = unname(as.numeric(u@cval)), lag = unname(u@lag)) }
set.seed(20261201)
rows <- list()
for (it in 1:80) {
  n <- sample(c(20:60, 80:120, 200:300), 1); e <- as.numeric(arima.sim(list(ar = runif(1, 0, 0.6)), n))
  y <- numeric(n); r <- runif(1, 0.55, 0.9); y[1] <- e[1]; for (t in 2:n) y[t] <- r * y[t - 1] + e[t]
  y <- y + runif(1, -0.05, 0.05) * (1:n)
  probe <- function(...) tryCatch(ndiffs(y, test = "pp", type = "trend", alpha = 0.05, ...), error = function(err) paste("error:", conditionMessage(err)))
  rows[[it]] <- list(n = n, y = y, p_trend = pOf(y, "trend"), p_level = pOf(y, "level"),
                     default = probe(), lags_long = probe(lags = "long"), lshort_false = probe(lshort = FALSE),
                     trend_short = urp(y, "trend", "short"), trend_long = urp(y, "trend", "long"),
                     const_short = urp(y, "constant", "short"))
}
out$rows <- rows
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "null"))
