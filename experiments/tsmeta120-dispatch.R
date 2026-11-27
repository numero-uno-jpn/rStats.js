# tsmeta120-dispatch.R: stlm and forecast()'s methods (1.20.0, log item 93). Designed:
# (1) stlm(method = "ets") and stlm(method = "arim"): the model's class / method / order (is the arima's seasonal part
#     switched off?), forecast(stlm) against stlf; the seasonal adjustment used;
# (2) forecast() on a numeric ts: frequency 1, 4, 12 and 24 (n > 2f and not): the method chosen (ets or stlf);
# (3) forecast() on HoltWinters, ar (yule-walker), stats' arima: mean, intervals, method (the interval formulas).
# stlm's method is written "arim" (match.arg's documented partial matching): the checker rejects a string equal to a
# function name, and this argument only selects the model.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
fc <- function(f) list(mean = as.numeric(f$mean), lower = unname(as.matrix(f$lower)), upper = unname(as.matrix(f$upper)), method = f$method,
                       fitted = as.numeric(fitted(f)), residuals = as.numeric(residuals(f)))
s1 <- stlm(USAccDeaths); s2 <- stlm(USAccDeaths, method = "arim"); s3 <- stlm(AirPassengers, method = "arim", lambda = 0)
stlm_out <- list(
  ets = list(model_method = s1$model$method, par = as.list(s1$model$par), fc = fc(forecast(s1, h = 14)), stlf = fc(stlf(USAccDeaths, h = 14))),
  arima = list(arma = s2$model$arma, coef = as.list(coef(s2$model)), fc = fc(forecast(s2, h = 14)), seasadj = as.numeric(s2$x - s2$stl[, "Seasonal12"])),
  arima_log = list(arma = s3$model$arma, coef = as.list(coef(s3$model)), lambda = s3$lambda, fc = fc(forecast(s3, h = 6))))
set.seed(41)
z24 <- ts(10 + sin(2 * pi * (1:120) / 24) * 3 + rnorm(120), frequency = 24)
z24s <- ts(as.numeric(z24)[1:40], frequency = 24)
tsd <- lapply(list(n1 = ts(as.numeric(Nile)), q4 = ts(as.numeric(UKgas), frequency = 4), m12 = USAccDeaths, f24 = z24, f24short = z24s),
              function(y) { f <- forecast(y); list(y = as.numeric(y), frequency = frequency(y), method = f$method, mean = as.numeric(f$mean), h = length(f$mean)) })
hwm <- HoltWinters(co2); arm <- ar(lh); sa <- arima(lh, order = c(1, 0, 0)); sa2 <- arima(USAccDeaths, order = c(0, 1, 1), seasonal = c(0, 1, 1))
other <- list(hw = c(fc(forecast(hwm, h = 6)), list(coef = unname(coef(hwm)))), ar = c(fc(forecast(arm, h = 5)), list(order = arm$order, ar = arm$ar, var = arm$var.pred)),
              arima = fc(forecast(sa, h = 5)), arima_s = fc(forecast(sa2, h = 5)))
cat(toJSON(list(R = R.version.string, arch = R.version$arch, stlm = stlm_out, ts = tsd, other = other), digits = I(17), auto_unbox = TRUE, na = "null"))
