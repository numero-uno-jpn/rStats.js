# tsmeta120-tsedge3.R: follow-up of tsmeta120-tsedge2 (1.20.0, session 42). What R does where rStats.js differed on
# degenerate and short series: auto.arima's search (its trace) and the criteria of ets's candidate models on short
# series (lengths 2, 3, 12, 24, 25, 36 of USAccDeaths, a straight line, an exact seasonal pattern), and the
# number of observations R's functions use with a missing value.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(forecast); library(tseries) })
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
y0 <- as.numeric(USAccDeaths)
grab <- function(expr) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(expr, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") }),
                error = function(e) list(error = conditionMessage(e)))
  if (length(w)) r$warnings <- unique(w)
  r
}
inputs <- list(len2 = y0[1:2], len3 = y0[1:3], len12 = y0[1:12], len24 = y0[1:24], len25 = y0[1:25], len36 = y0[1:36],
               line = 1:48 + 0, season = rep(c(3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8), 4))
etsInfo <- function(f) list(method = f$method, loglik = f$loglik, aicc = f$aicc, aic = f$aic, par = unname(f$par),
                            sigma2 = f$sigma2, mean = as.numeric(forecast(f, h = 3)$mean))
res <- list()
for (nm in names(inputs)) {
  x <- ts(inputs[[nm]], frequency = 12, start = c(1973, 1))
  r <- list()
  r$auto_trace <- grab({ tr <- capture.output(f <- auto.arima(x, trace = TRUE)); list(trace = tr, arma = f$arma, aicc = f$aicc) })
  for (mdl in c("ZZZ", "ANN", "AAN", "AAA", "MNN", "ANA", "MNM", "MAN")) {
    r[[paste0("ets_", mdl)]] <- grab(etsInfo(ets(x, model = mdl)))
  }
  r$ets_AAdN <- grab(etsInfo(ets(x, model = "AAN", damped = TRUE)))
  r$ets_AAN_nodamp <- grab(etsInfo(ets(x, model = "AAN", damped = FALSE)))
  r$ets_AAA_nodamp <- grab(etsInfo(ets(x, model = "AAA", damped = FALSE)))
  r$holt <- grab({ f <- holt(x, h = 3); c(etsInfo(f$model), list(fmean = as.numeric(f$mean))) })
  r$hw <- grab({ f <- hw(x, h = 3); c(etsInfo(f$model), list(fmean = as.numeric(f$mean))) })
  r$ses <- grab({ f <- ses(x, h = 3); c(etsInfo(f$model), list(fmean = as.numeric(f$mean))) })
  res[[nm]] <- r
}
out$short <- res

# a missing value at position 30: the observations used
yNA <- y0; yNA[30] <- NA
x <- ts(yNA, frequency = 12, start = c(1973, 1))
out$na <- list(
  ets_ANN = grab({ f <- ets(x, model = "ANN"); c(etsInfo(f), list(nres = length(f$residuals), nfinite = sum(is.finite(f$residuals)),
    xlen = length(f$x), fitted30 = as.numeric(f$fitted)[28:32])) }),
  ets_ZZZ = grab({ f <- ets(x); c(etsInfo(f), list(nres = length(f$residuals), xlen = length(f$x))) }),
  Box = grab({ t <- Box.test(x, lag = 5, type = "Ljung"); list(statistic = unname(t$statistic), p = t$p.value) }),
  Box_pierce = grab({ t <- Box.test(x, lag = 5); list(statistic = unname(t$statistic), p = t$p.value) }),
  meanf = grab({ f <- meanf(x, h = 2); list(mean = as.numeric(f$mean), upper = as.numeric(f$upper[, 2]), lower = as.numeric(f$lower[, 2])) }),
  naive = grab({ f <- naive(x, h = 2); list(upper = as.numeric(f$upper[, 2]), res = as.numeric(f$residuals)[28:32]) }),
  snaive = grab({ f <- snaive(x, h = 2); list(upper = as.numeric(f$upper[, 2])) }),
  rwf_drift = grab({ f <- rwf(x, h = 2, drift = TRUE); list(mean = as.numeric(f$mean), upper = as.numeric(f$upper[, 2])) }),
  kpss = grab({ t <- kpss.test(x); list(statistic = unname(t$statistic), p = t$p.value) }),
  kpss_trend = grab({ t <- kpss.test(x, null = "Trend"); list(statistic = unname(t$statistic), p = t$p.value) }),
  lambda = grab(list(guerrero = BoxCox.lambda(x), loglik = BoxCox.lambda(x, method = "loglik"))),
  mstl = grab({ m <- mstl(x); list(row30 = as.numeric(m[30, ]), first = as.numeric(m[1, ])) }),
  stlf = grab(list(mean = as.numeric(stlf(x, h = 3)$mean))),
  ses = grab(list(mean = as.numeric(ses(x, h = 3)$mean))),
  hw = grab(list(mean = as.numeric(hw(x, h = 3)$mean))),
  thetaf = grab(list(mean = as.numeric(thetaf(x, h = 3)$mean))),
  tsclean = grab(list(v = as.numeric(tsclean(x))[28:32])),
  adf = grab({ t <- adf.test(x); list(statistic = unname(t$statistic), p = t$p.value) }),
  pp = grab({ t <- pp.test(x); list(statistic = unname(t$statistic), p = t$p.value) }),
  jarque = grab({ t <- jarque.bera.test(x); list(statistic = unname(t$statistic), p = t$p.value) }),
  ndiffs = grab(list(kpss = ndiffs(x), adf = ndiffs(x, test = "adf"), pp = ndiffs(x, test = "pp"))),
  nsdiffs = grab(list(seas = nsdiffs(x), ocsb = nsdiffs(x, test = "ocsb"))),
  findfrequency = grab(list(f = findfrequency(x))),
  tslm = grab({ f <- tslm(x ~ trend + season); list(coef = unname(coef(f)), sigma = summary(f)$sigma) }))

# BoxCox.lambda(method = "loglik") under a change of scale, on a finer view: the profile it maximises is reported
# only through the chosen lambda, so record the choice for many scales
lam <- list()
for (c0 in c(1, 2, 10, 100, 1e-3, 1e-10, 1e10)) lam[[format(c0)]] <- grab(list(loglik = BoxCox.lambda(ts(y0 * c0, frequency = 12), method = "loglik"),
  loglik_ns = BoxCox.lambda(y0 * c0, method = "loglik"), guerrero = BoxCox.lambda(ts(y0 * c0, frequency = 12))))
out$lambda_scale <- lam
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
