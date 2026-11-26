# issue: 570
# oracle-platform: amd64
# Public outputs of forecast 9.0.2's Arima, forecast.Arima, BoxCox, InvBoxCox, BoxCox.lambda and ndiffs for
# test/fixtures/forecastArima.json (1.20.0). The behaviour is in oracle/tsmeta-behaviour.md; the experiments behind it
# in experiments/tsmeta120-farima.R, -fsmall2/3.R and -ndiffs*.R. stats' arima itself is checked at the optimum in
# test/fixtures/arima.json; here R's default fits are recorded (they stop about 1e-6 short, hence the tolerances).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list()
cases <- list(
  list(name = "lh_ar1", y = lh, order = c(1, 0, 0), seasonal = c(0, 0, 0)),
  list(name = "lakehuron_drift", y = LakeHuron, order = c(1, 1, 0), seasonal = c(0, 0, 0), drift = TRUE),
  list(name = "lakehuron_constant", y = LakeHuron, order = c(1, 1, 0), seasonal = c(0, 0, 0), constant = TRUE),
  list(name = "lakehuron_constant_d2", y = LakeHuron, order = c(1, 2, 0), seasonal = c(0, 0, 0), constant = TRUE),
  list(name = "air_log", y = AirPassengers, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0),
  list(name = "air_log_biasadj", y = AirPassengers, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0, biasadj = TRUE),
  list(name = "air_lambda03_biasadj", y = AirPassengers, order = c(1, 1, 0), seasonal = c(0, 1, 1), lambda = 0.3, biasadj = TRUE),
  list(name = "usacc_xreg", y = USAccDeaths, order = c(1, 0, 0), seasonal = c(0, 1, 1), xreg = seq_along(USAccDeaths), newxreg = 72 + 1:12)
)
arimaCases <- list()
for (cs in cases) {
  fit <- Arima(cs$y, order = cs$order, seasonal = cs$seasonal, xreg = if (!is.null(cs$xreg)) cbind(trend = cs$xreg),
               include.drift = isTRUE(cs$drift), include.constant = if (isTRUE(cs$constant)) TRUE else NULL,
               lambda = cs$lambda, biasadj = isTRUE(cs$biasadj))
  fc <- forecast(fit, h = 12, level = c(80, 95), xreg = if (!is.null(cs$newxreg)) cbind(trend = cs$newxreg))
  arimaCases[[cs$name]] <- list(y = as.numeric(cs$y), frequency = frequency(cs$y), order = cs$order, seasonal = cs$seasonal,
    drift = isTRUE(cs$drift), constant = isTRUE(cs$constant), lambda = cs$lambda, biasadj = isTRUE(cs$biasadj),
    xreg = cs$xreg, newxreg = cs$newxreg,
    coef = unname(coef(fit)), se_coef = unname(sqrt(diag(fit$var.coef))), names = names(coef(fit)), sigma2 = fit$sigma2, loglik = fit$loglik, aic = fit$aic, aicc = fit$aicc,
    bic = fit$bic, fitted = as.numeric(fitted(fit)), residuals = as.numeric(residuals(fit)), nobs = nobs(fit),
    mean = as.numeric(fc$mean), lower = unname(fc$lower), upper = unname(fc$upper), method = fc$method)
}
out$arima <- arimaCases
x <- as.numeric(AirPassengers)
out$boxcox <- list(x = x, l0 = BoxCox(x, 0), l05 = BoxCox(x, 0.5), lneg = BoxCox(x, -0.7),
                   negx = BoxCox(c(-2, -0.5, 0, 1.5), 0.5), inv = InvBoxCox(c(-3, -2.5, 0.1, 2), 0.5), inv0 = InvBoxCox(c(-1, 0, 2), 0),
                   inv_bias = InvBoxCox(c(5, 5.5), 0.3, biasadj = TRUE, fvar = c(0.01, 0.04)))
bl <- list()
for (cs in list(list("air", AirPassengers), list("usacc", USAccDeaths), list("nile", Nile), list("lynx", lynx),
                list("odd_len", ts(x[1:137], frequency = 12)))) {
  bl[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), guerrero = BoxCox.lambda(cs[[2]]),
                        loglik = BoxCox.lambda(cs[[2]], method = "loglik"), limited = BoxCox.lambda(cs[[2]], lower = 0, upper = 1))
}
out$boxcoxLambda <- bl
set.seed(20261127)
nd <- list()
for (it in 1:150) {
  n <- sample(30:300, 1); kind <- sample(1:3, 1)
  y <- switch(kind, as.numeric(arima.sim(list(ar = runif(1, 0.5, 0.99)), n)), cumsum(as.numeric(arima.sim(list(ar = runif(1, 0, 0.9)), n))),
              cumsum(cumsum(rnorm(n))) * runif(1, 0, 0.05) + cumsum(rnorm(n)))
  if (kind == 1 && runif(1) < 0.5) y <- y + 0.02 * (1:n)
  r <- list(y = y)
  for (test in c("kpss", "adf", "pp")) for (type in c("level", "trend")) for (alpha in c(0.01, 0.025, 0.05, 0.1))
    r[[paste(test, type, alpha, sep = "_")]] <- ndiffs(y, alpha = alpha, test = test, type = type)
  nd[[it]] <- r
}
out$ndiffs <- nd
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "forecastArima.json"))
