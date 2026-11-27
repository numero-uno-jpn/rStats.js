# tsmeta120-farima.R: forecast's Arima and forecast() for Arima fits (1.20.0), first experiment. Candidates written
# for this experiment from the help pages (Arima: "a regression with ARIMA(p,d,q) errors", include.drift,
# include.constant, lambda, biasadj; forecast.Arima: "calls stats::predict.Arima() and constructs an object of class
# forecast") and Hyndman and Athanasopoulos (2018, Forecasting: Principles and Practice, 2nd ed.):
#   the fit = stats' arima with the same order on BoxCox(y, lambda), with xreg = cbind(xreg, drift = 1:n) when
#   include.drift (or include.constant with d + D = 1);
#   npar = length(coef) + 1, nstar = n - d - D s; aicc = aic + 2 npar (npar + 1) / (nstar - npar - 1);
#   bic = aic + npar (log(nstar) - 2);
#   fitted = InvBoxCox(BoxCox(y) - residuals);
#   intervals: point +- qnorm(0.5 + level / 200) se on the transformed scale, back-transformed;
#   biasadj: mean = InvBoxCox(m) (1 + v (1 - lambda) / (2 (lambda m + 1)^2)) with v = se^2 (forecasts) or sigma2
#   (fitted values).
# Second run: sigma2 rescaled as found in the first (see the log).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))

bc <- function(y, lam) if (lam == 0) log(y) else (sign(y) * abs(y)^lam - 1) / lam
ibc <- function(z, lam) if (lam == 0) exp(z) else (lam * z + 1)^(1 / lam)
badj <- function(m, v, lam) ibc(m, lam) * (1 + v * (1 - lam) / (2 * (lam * m + 1)^2))

cases <- list(
  list(name = "lh_ar1", y = lh, order = c(1, 0, 0), seasonal = c(0, 0, 0)),
  list(name = "lakehuron_drift", y = LakeHuron, order = c(1, 1, 0), seasonal = c(0, 0, 0), drift = TRUE),
  list(name = "lakehuron_constant", y = LakeHuron, order = c(1, 1, 0), seasonal = c(0, 0, 0), constant = TRUE),
  list(name = "lakehuron_constant_d2", y = LakeHuron, order = c(1, 2, 0), seasonal = c(0, 0, 0), constant = TRUE),
  list(name = "air_log", y = AirPassengers, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0),
  list(name = "air_log_biasadj", y = AirPassengers, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0,
       biasadj = TRUE),
  list(name = "air_lambda03_biasadj", y = AirPassengers, order = c(1, 1, 0), seasonal = c(0, 1, 1), lambda = 0.3,
       biasadj = TRUE),
  list(name = "usacc_xreg", y = USAccDeaths, order = c(1, 0, 0), seasonal = c(0, 1, 1),
       xreg = cbind(trend = seq_along(USAccDeaths)), newxreg = cbind(trend = 72 + 1:12))
)
for (cs in cases) {
  lam <- if (is.null(cs$lambda)) NULL else cs$lambda
  ba <- isTRUE(cs$biasadj)
  fit <- Arima(cs$y, order = cs$order, seasonal = cs$seasonal, xreg = cs$xreg, include.drift = isTRUE(cs$drift),
               include.constant = if (isTRUE(cs$constant)) TRUE else NULL, lambda = lam, biasadj = ba)
  fc <- forecast(fit, h = 12, level = c(80, 95), xreg = cs$newxreg)
  # the candidate fit: stats' arima on the transformed series
  y <- as.numeric(cs$y); n <- length(y); s <- frequency(cs$y)
  z <- if (is.null(lam)) cs$y else ts(bc(y, lam), start = start(cs$y), frequency = s)
  dd <- cs$order[2] + cs$seasonal[2]
  usedrift <- isTRUE(cs$drift) || (isTRUE(cs$constant) && dd == 1)
  xr <- cs$xreg; nx <- cs$newxreg
  if (usedrift) { xr <- cbind(xr, drift = 1:n); nx <- cbind(nx, drift = n + 1:12) }
  im <- if (isTRUE(cs$constant)) dd == 0 else TRUE
  sf <- arima(z, order = cs$order, seasonal = cs$seasonal, xreg = xr, include.mean = im)
  # found in the first run: forecast's sigma2 = sum of all squared residuals / (nobs - number of coefficients),
  # and the forecast variances use it
  sf$sigma2 <- sum(residuals(sf)^2, na.rm = TRUE) / (sf$nobs - length(coef(sf)))
  sp <- predict(sf, n.ahead = 12, newxreg = nx)
  npar <- length(coef(sf)) + 1; nstar <- n - cs$order[2] - cs$seasonal[2] * s
  lam0 <- if (is.null(lam)) 1 else lam
  fitz <- as.numeric(z) - as.numeric(residuals(sf))
  q <- qnorm(0.5 + c(80, 95) / 200)
  lower <- sapply(q, function(qq) as.numeric(sp$pred) - qq * as.numeric(sp$se))
  upper <- sapply(q, function(qq) as.numeric(sp$pred) + qq * as.numeric(sp$se))
  tr <- function(v) if (is.null(lam)) v else ibc(v, lam)
  cmean <- if (ba) badj(as.numeric(sp$pred), as.numeric(sp$se)^2, lam0) else tr(as.numeric(sp$pred))
  cfitted <- if (ba) badj(fitz, sf$sigma2, lam0) else tr(fitz)
  out[[cs$name]] <- list(
    coef = unname(coef(fit)), coef_names = names(coef(fit)), sigma2 = fit$sigma2, loglik = fit$loglik, aic = fit$aic,
    aicc = fit$aicc, bic = fit$bic, var_coef = unname(fit$var.coef), nobs = nobs(fit), lambda = fit$lambda,
    names = names(fit), fitted = as.numeric(fitted(fit)), residuals = as.numeric(residuals(fit)),
    mean = as.numeric(fc$mean), lower = unname(fc$lower), upper = unname(fc$upper), level = fc$level,
    fc_names = names(fc), method = fc$method,
    stats = list(coef = unname(coef(sf)), coef_names = names(coef(sf)), loglik = sf$loglik, se = as.numeric(sp$se),
                 lower = lower),
    diff = list(coef = max(abs(coef(fit) - coef(sf))), loglik = fit$loglik - sf$loglik,
                sigma2 = fit$sigma2 / sf$sigma2 - 1,
                aicc = fit$aicc - (sf$aic + 2 * npar * (npar + 1) / (nstar - npar - 1)),
                bic = fit$bic - (sf$aic + npar * (log(nstar) - 2)),
                fitted = max(abs(as.numeric(fitted(fit)) - cfitted)),
                residuals = max(abs(as.numeric(residuals(fit)) - as.numeric(residuals(sf)))),
                mean = max(abs(as.numeric(fc$mean) - cmean)),
                lower = max(abs(unname(fc$lower) - tr(lower))), upper = max(abs(unname(fc$upper) - tr(upper))))
  )
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
