# tsmeta120-tsedge2.R: R's behaviour on the time-series edge cases other than scale (1.20.0, session 42; the spec's
# "Edge-case plan"): degenerate series (constant, all zeros, a straight line, an exact seasonal pattern, lengths 1, 2, 3,
# m, 2m, 2m + 1, 3m for m = 12), invalid values (NA, Inf inside the series), intermittent demand (croston), ties
# (supsmu, runs.test), p-values near 0 and 1, and combinations (Box-Cox lambda with scale, Arima with a lambda).
# For each function the main outputs or the error message, and the warnings, so that rStats.js can be compared with
# what R does on the same inputs.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(forecast); library(tseries) })
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")),
            tseries = as.character(packageVersion("tseries")))
y0 <- as.numeric(USAccDeaths)
out$y <- y0
grab <- function(expr) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(expr, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") }),
                error = function(e) list(error = conditionMessage(e)))
  if (length(w)) r$warnings <- unique(w)
  r
}
num <- function(v) as.numeric(v)
fc3 <- function(f) num(f$mean)[1:3]
yNA <- y0; yNA[30] <- NA
yInf <- y0; yInf[30] <- Inf
inputs <- list(
  const = rep(5, 48), zero = rep(0, 48), line = 1:48 + 0, season = rep(c(3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8), 4),
  len1 = y0[1], len2 = y0[1:2], len3 = y0[1:3], len12 = y0[1:12], len24 = y0[1:24], len25 = y0[1:25], len36 = y0[1:36],
  na = yNA, inf = yInf)
out$inputs <- inputs
runs <- list()
for (nm in names(inputs)) {
  x <- ts(inputs[[nm]], frequency = 12, start = c(1973, 1))
  r <- list()
  r$arima_011 <- grab({ f <- arima(x, order = c(0, 1, 1))
    list(coef = unname(coef(f)), sigma2 = f$sigma2, loglik = f$loglik, pred = num(predict(f, 2)$pred), se = num(predict(f, 2)$se)) })
  r$arima_100_mean <- grab({ f <- arima(x, order = c(1, 0, 0))
    list(coef = unname(coef(f)), sigma2 = f$sigma2, loglik = f$loglik, pred = num(predict(f, 2)$pred)) })
  r$arima_airline <- grab({ f <- arima(x, order = c(0, 1, 1), seasonal = c(0, 1, 1))
    list(coef = unname(coef(f)), sigma2 = f$sigma2, loglik = f$loglik, pred = num(predict(f, 2)$pred)) })
  r$Arima_drift <- grab({ f <- Arima(x, order = c(0, 1, 0), include.drift = TRUE)
    list(coef = unname(coef(f)), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3))) })
  r$auto_arima <- grab({ f <- auto.arima(x)
    list(arma = f$arma, coef = unname(coef(f)), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3))) })
  r$ets_ZZZ <- grab({ f <- ets(x)
    list(method = f$method, par = unname(f$par), mean = fc3(forecast(f, h = 3))) })
  r$ets_ANN <- grab({ f <- ets(x, model = "ANN")
    list(method = f$method, par = unname(f$par), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3))) })
  r$ets_AAA <- grab({ f <- ets(x, model = "AAA", damped = FALSE)
    list(method = f$method, par = unname(f$par), mean = fc3(forecast(f, h = 3))) })
  r$HoltWinters <- grab({ f <- HoltWinters(x)
    list(alpha = unname(f$alpha), beta = unname(f$beta), gamma = unname(f$gamma), SSE = f$SSE, pred = num(predict(f, 3))) })
  r$HoltWinters_ns <- grab({ f <- HoltWinters(x, gamma = FALSE)
    list(alpha = unname(f$alpha), beta = unname(f$beta), SSE = f$SSE, pred = num(predict(f, 3))) })
  r$ses <- grab(list(mean = fc3(ses(x, h = 3))))
  r$holt <- grab(list(mean = fc3(holt(x, h = 3))))
  r$hw <- grab(list(mean = fc3(hw(x, h = 3))))
  r$thetaf <- grab({ f <- thetaf(x, h = 3); list(mean = fc3(f), upper = num(f$upper[1, ])) })
  r$stlf <- grab(list(mean = fc3(stlf(x, h = 3))))
  r$meanf <- grab({ f <- meanf(x, h = 3); list(mean = fc3(f), upper = num(f$upper[1, ])) })
  r$naive <- grab({ f <- naive(x, h = 3); list(mean = fc3(f), upper = num(f$upper[1, ])) })
  r$snaive <- grab({ f <- snaive(x, h = 3); list(mean = fc3(f), upper = num(f$upper[1, ])) })
  r$rwf_drift <- grab({ f <- rwf(x, h = 3, drift = TRUE); list(mean = fc3(f), upper = num(f$upper[1, ])) })
  r$croston <- grab(list(mean = fc3(croston(x, h = 3))))
  r$tslm <- grab({ f <- tslm(x ~ trend + season); list(coef = unname(coef(f)), sigma = summary(f)$sigma) })
  r$ar <- grab({ f <- ar(x); list(order = f$order, ar = num(f$ar), var = f$var.pred, xmean = f$x.mean) })
  r$ar_burg <- grab({ f <- ar(x, method = "burg"); list(order = f$order, ar = num(f$ar), var = f$var.pred) })
  r$ar_ols <- grab({ f <- ar(x, method = "ols"); list(order = f$order, ar = num(f$ar), var = num(f$var.pred)) })
  r$ar_mle <- grab({ f <- ar(x, method = "mle"); list(order = f$order, ar = num(f$ar), var = f$var.pred) })
  r$acf <- grab({ a <- acf(x, lag.max = 5, plot = FALSE, na.action = na.pass); list(acf = num(a$acf)) })
  r$pacf <- grab({ a <- pacf(x, lag.max = 5, plot = FALSE, na.action = na.pass); list(acf = num(a$acf)) })
  r$Box <- grab({ t <- Box.test(x, lag = 5, type = "Ljung"); list(statistic = unname(t$statistic), p = t$p.value) })
  r$kpss <- grab({ t <- kpss.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$pp <- grab({ t <- pp.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$adf <- grab({ t <- adf.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$jarque <- grab({ t <- jarque.bera.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$terasvirta <- grab({ t <- terasvirta.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$white <- grab({ set.seed(1); t <- white.test(x); list(statistic = unname(t$statistic), p = t$p.value) })
  r$ndiffs <- grab(list(kpss = ndiffs(x), adf = ndiffs(x, test = "adf"), pp = ndiffs(x, test = "pp")))
  r$nsdiffs <- grab(list(seas = nsdiffs(x), ocsb = nsdiffs(x, test = "ocsb")))
  r$ocsb <- grab({ t <- ocsb.test(x); list(statistic = unname(t$statistics), critical = unname(t$critical)) })
  r$stl <- grab({ s <- stl(x, s.window = "periodic"); list(seasonal = num(s$time.series[1:3, 1]), trend = num(s$time.series[1:3, 2])) })
  r$stl7 <- grab({ s <- stl(x, s.window = 7, robust = TRUE); list(seasonal = num(s$time.series[1:3, 1]), trend = num(s$time.series[1:3, 2])) })
  r$decompose <- grab({ d <- decompose(x); list(figure = num(d$figure), trend = num(d$trend)[7:9]) })
  r$decompose_mult <- grab({ d <- decompose(x, type = "multiplicative"); list(figure = num(d$figure), trend = num(d$trend)[7:9]) })
  r$mstl <- grab({ m <- mstl(x); list(ncol = ncol(m), first = num(m[1, ]), last = num(m[nrow(m), ])) })
  r$filter <- grab(list(conv = num(stats::filter(x, rep(1 / 3, 3)))[1:4], rec = num(stats::filter(x, 0.5, method = "recursive"))[1:4]))
  r$diffinv <- grab(list(v = num(diffinv(x, lag = 12))[1:4]))
  r$ma <- grab(list(v = num(ma(x, order = 12))[1:8]))
  r$na_interp <- grab(list(v = num(na.interp(x))[28:32]))
  r$tsclean <- grab(list(v = num(tsclean(x))[28:32]))
  r$tsoutliers <- grab({ o <- tsoutliers(x); list(index = o$index, replacements = num(o$replacements)) })
  r$findfrequency <- grab(list(f = findfrequency(x)))
  r$spec_ar <- grab({ s <- spec.ar(x, n.freq = 5, plot = FALSE); list(order = s$method, spec = num(s$spec)) })
  r$BoxCox_lambda <- grab(list(guerrero = BoxCox.lambda(x), loglik = BoxCox.lambda(x, method = "loglik")))
  r$supsmu <- grab({ s <- supsmu(seq_along(x), num(x)); list(y = s$y[1:3]) })
  r$runs <- grab({ t <- runs.test(factor(num(x) > median(num(x)))); list(statistic = unname(t$statistic), p = t$p.value) })
  runs[[nm]] <- r
}
out$runs <- runs

# intermittent demand (croston): R's forecast and fitted values
inter <- list(
  sparse = c(0, 0, 3, 0, 0, 1, 0, 0, 0, 2, 0, 5, 0, 0, 0, 1, 0, 4, 0, 0),
  first = c(2, 0, 0, 0, 0, 0, 0, 0, 0, 0), last = c(0, 0, 0, 0, 0, 0, 0, 0, 0, 3), one = c(0, 0, 0, 4, 0, 0, 0, 0),
  zeros = rep(0, 10), dense = c(1, 2, 3, 2, 1, 2, 3, 2), two = c(0, 4))
out$intermittent_inputs <- inter
cr <- list()
for (nm in names(inter)) {
  cr[[nm]] <- list(
    croston = grab({ f <- croston(inter[[nm]], h = 2); list(mean = num(f$mean), fitted = num(f$fitted)) }),
    sba = grab({ f <- croston(inter[[nm]], h = 2, type = "sba"); list(mean = num(f$mean)) }))
}
out$intermittent <- cr

# ties: supsmu with tied x, runs.test with values at the median
xt <- c(1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 5, 5, 6, 7, 7, 7, 8, 9, 9, 10)
yt <- c(2.1, 1.9, 2.4, 3.0, 2.8, 3.9, 4.2, 3.7, 4.1, 5.0, 5.8, 6.1, 6.9, 8.2, 7.7, 8.0, 9.1, 9.8, 10.2, 11.0)
out$ties <- list(x = xt, y = yt,
  supsmu = grab({ s <- supsmu(xt, yt); list(x = s$x, y = s$y) }),
  supsmu_cv = grab({ s <- supsmu(xt, yt, span = 0.3); list(x = s$x, y = s$y) }),
  runs = grab({ t <- runs.test(factor(c(1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1))); list(statistic = unname(t$statistic), p = t$p.value) }),
  runs_one_level = grab({ t <- runs.test(factor(rep(1, 10))); list(statistic = unname(t$statistic), p = t$p.value) }),
  runs_three_levels = grab({ t <- runs.test(factor(c(1, 2, 3, 1, 2, 3))); list(statistic = unname(t$statistic), p = t$p.value) }))

# p-values near 0 and 1
set.seed(42)
e <- rnorm(2000)
a1 <- num(stats::filter(e, 0.95, method = "recursive"))
wn <- c(0.1, -0.1, 0.2, -0.2, 0.05, -0.05, 0.15, -0.15, 0.1, -0.1, 0.2, -0.2, 0.05, -0.05, 0.15, -0.15)
out$prob_inputs <- list(e = e, a1 = a1, wn = wn)
out$prob <- list(
  box_a1 = grab({ t <- Box.test(a1, lag = 10, type = "Ljung"); list(statistic = unname(t$statistic), p = t$p.value) }),
  box_e = grab({ t <- Box.test(e, lag = 1); list(statistic = unname(t$statistic), p = t$p.value) }),
  box_wn = grab({ t <- Box.test(wn, lag = 3); list(statistic = unname(t$statistic), p = t$p.value) }),
  jarque_e = grab({ t <- jarque.bera.test(e); list(statistic = unname(t$statistic), p = t$p.value) }),
  jarque_exp = grab({ t <- jarque.bera.test(exp(e)); list(statistic = unname(t$statistic), p = t$p.value) }),
  adf_e = grab({ t <- adf.test(e); list(statistic = unname(t$statistic), p = t$p.value) }),
  adf_rw = grab({ t <- adf.test(cumsum(e)); list(statistic = unname(t$statistic), p = t$p.value) }),
  kpss_e = grab({ t <- kpss.test(e); list(statistic = unname(t$statistic), p = t$p.value) }),
  kpss_rw = grab({ t <- kpss.test(cumsum(e)); list(statistic = unname(t$statistic), p = t$p.value) }),
  pp_e = grab({ t <- pp.test(e); list(statistic = unname(t$statistic), p = t$p.value) }),
  dm = grab({ t <- dm.test(e[1:200], 3 * e[201:400]); list(statistic = unname(t$statistic), p = t$p.value) }),
  dm_less = grab({ t <- dm.test(e[1:200], 3 * e[201:400], alternative = "less"); list(statistic = unname(t$statistic), p = t$p.value) }),
  runs_alt = grab({ t <- runs.test(factor(rep(c(0, 1), 50))); list(statistic = unname(t$statistic), p = t$p.value) }),
  runs_alt_less = grab({ t <- runs.test(factor(rep(c(0, 1), 50)), alternative = "less"); list(statistic = unname(t$statistic), p = t$p.value) }))

# combinations: Box-Cox lambda and Arima with a lambda under a change of scale, drift with scale
xs <- ts(y0, frequency = 12, start = c(1973, 1))
comb <- list()
for (c0 in c(1, 1e-10, 1e10, 1e-150, 1e150)) {
  z <- xs * c0
  comb[[format(c0)]] <- list(
    lambda = grab(list(guerrero = BoxCox.lambda(z), loglik = BoxCox.lambda(z, method = "loglik"))),
    Arima_log = grab({ f <- Arima(z, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0)
      list(coef = unname(coef(f)), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3)), upper = num(forecast(f, h = 3)$upper[1, ])) }),
    Arima_half = grab({ f <- Arima(z, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0.5)
      list(coef = unname(coef(f)), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3))) }),
    drift = grab({ f <- Arima(z, order = c(0, 1, 0), include.drift = TRUE)
      list(coef = unname(coef(f)), sigma2 = f$sigma2, mean = fc3(forecast(f, h = 3))) }))
}
out$combinations <- comb
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
