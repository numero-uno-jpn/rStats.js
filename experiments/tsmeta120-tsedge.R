# tsmeta120-tsedge.R: R's behaviour on the time-series edge-case battery of log 103 (1.20.0, session 41).
# USAccDeaths times 1, 1e-150, 1e150, 1e-300, 2^1000, and plus 1e8; for each function the main outputs (estimates,
# first forecasts, statistics) or the error message, so that rStats.js's fixes can be compared with what R does on the
# same inputs (R probably breaks at 1e+-300 too; where it does, rStats.js follows the theory: invariant statistics,
# equivariant estimates).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(forecast); library(tseries) })
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")),
            tseries = as.character(packageVersion("tseries")))
y0 <- as.numeric(USAccDeaths)
out$y <- y0
grab <- function(expr) tryCatch(suppressWarnings(expr), error = function(e) list(error = conditionMessage(e)))
fc3 <- function(f) as.numeric(f$mean)[1:3]
runs <- list()
for (tr in list(list("x1", 1, 0), list("x1e-150", 1e-150, 0), list("x1e150", 1e150, 0), list("x1e-300", 1e-300, 0),
                list("x2^1000", 2^1000, 0), list("x1e300", 1e300, 0), list("+1e8", 1, 1e8))) {
  x <- ts(y0 * tr[[2]] + tr[[3]], frequency = 12, start = c(1973, 1))
  r <- list()
  r$arima_airline <- grab({ f <- arima(x, order = c(0, 1, 1), seasonal = c(0, 1, 1))
    list(coef = unname(coef(f)), sigma2 = f$sigma2, loglik = f$loglik, pred = as.numeric(predict(f, 3)$pred)) })
  r$arima_ar_seasonal_mean <- grab({ f <- arima(x, order = c(1, 0, 0), seasonal = c(1, 0, 0))
    list(coef = unname(coef(f)), sigma2 = f$sigma2, loglik = f$loglik, pred = as.numeric(predict(f, 3)$pred)) })
  r$Arima_airline <- grab({ f <- Arima(x, order = c(0, 1, 1), seasonal = c(0, 1, 1))
    list(coef = unname(coef(f)), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3))) })
  r$auto_arima <- grab({ f <- auto.arima(x)
    list(arma = f$arma, coef = unname(coef(f)), sigma2 = f$sigma2) })
  r$ets_ZZZ <- grab({ f <- ets(x)
    list(method = f$method, par = unname(f$par), mean = fc3(forecast(f, h = 3))) })
  r$ets_AAA <- grab({ f <- ets(x, model = "AAA", damped = FALSE)
    list(method = f$method, par = unname(f$par), mean = fc3(forecast(f, h = 3))) })
  r$HoltWinters <- grab({ f <- HoltWinters(x)
    list(alpha = unname(f$alpha), beta = unname(f$beta), gamma = unname(f$gamma), SSE = f$SSE,
         pred = as.numeric(predict(f, 3))) })
  r$ses <- grab(list(mean = fc3(ses(x, h = 3))))
  r$holt <- grab(list(mean = fc3(holt(x, h = 3))))
  r$hw <- grab(list(mean = fc3(hw(x, h = 3))))
  r$thetaf <- grab(list(mean = fc3(thetaf(x, h = 3))))
  r$stlf <- grab(list(mean = fc3(stlf(x, h = 3))))
  r$meanf <- grab({ f <- meanf(x, h = 3); list(mean = fc3(f), upper = as.numeric(f$upper[1, ])) })
  r$rwf_drift <- grab({ f <- rwf(x, h = 3, drift = TRUE); list(mean = fc3(f), upper = as.numeric(f$upper[1, ])) })
  r$tslm <- grab({ f <- tslm(x ~ trend + season); list(coef = unname(coef(f)), sigma = summary(f)$sigma) })
  r$ar <- grab({ f <- ar(x); list(order = f$order, ar = as.numeric(f$ar), var = f$var.pred) })
  r$Box <- grab({ t <- Box.test(x, lag = 5, type = "Ljung"); list(statistic = unname(t$statistic), p = t$p.value) })
  r$kpss <- grab({ t <- kpss.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$pp <- grab({ t <- pp.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$adf <- grab({ t <- adf.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$jarque <- grab({ t <- jarque.bera.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$terasvirta <- grab({ t <- terasvirta.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$white <- grab({ set.seed(1); t <- white.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$ndiffs <- grab(list(kpss = ndiffs(x), adf = ndiffs(x, test = "adf"), pp = ndiffs(x, test = "pp")))
  r$nsdiffs <- grab(list(seas = nsdiffs(x), ocsb = nsdiffs(x, test = "ocsb")))
  runs[[tr[[1]]]] <- r
}
out$runs <- runs
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
