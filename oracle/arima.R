# issue: 570
# oracle-platform: amd64
# Public outputs of stats' arima and predict.Arima (R 4.6.2) for test/fixtures/arima.json (1.20.0). The behaviour is in
# oracle/tsmeta-behaviour.md ("stats' arima"); the experiments behind it in experiments/tsmeta120-arima*.R.
#
# R's optimiser stops short of the maximum (log 1), so each case also records the optimum of R's own likelihood:
# arima(..., fixed = theta, transform.pars = FALSE) evaluated as a function of theta, maximised from R's tight fit by
# BFGS and then Newton steps with Richardson-extrapolated central differences. rStats.js is compared with that
# optimum (coef, loglik, sigma2, residuals, predictions), and with R's own var.coef (R's numerical Hessian, Choice 2)
# at a looser tolerance.
library(jsonlite)
out <- list()
newton <- function(f, par) {
  grad <- function(p) sapply(seq_along(p), function(i) { h <- 1e-4 * max(1, abs(p[i]))
    d <- function(hh) { a <- p; b <- p; a[i] <- a[i] + hh; b[i] <- b[i] - hh; (f(a) - f(b)) / (2 * hh) }; (4 * d(h / 2) - d(h)) / 3 })
  hess <- function(p) { k <- length(p); H <- matrix(0, k, k)
    at <- function(h) { M <- matrix(0, k, k); for (i in 1:k) for (j in 1:k) { e <- function(a, b) { v <- p; v[i] <- v[i] + a; v[j] <- v[j] + b; f(v) }
      M[i, j] <- (e(h, h) - e(h, -h) - e(-h, h) + e(-h, -h)) / (4 * h * h) }; M }
    (4 * at(5e-4) - at(1e-3)) / 3 }
  cur <- par; fc <- f(cur)
  for (it in 1:30) { g <- grad(cur); st <- tryCatch(-solve(hess(cur), g), error = function(e) NULL); if (is.null(st)) break
    t <- 1; ok <- FALSE
    while (t > 1e-6) { cand <- cur + t * st; fv <- f(cand); if (is.finite(fv) && fv <= fc) { gain <- fc - fv; cur <- cand; fc <- fv; ok <- TRUE; break }; t <- t / 2 }
    if (!ok || max(abs(st)) < 1e-12 || gain <= 1e-16 * max(1, abs(fc))) break }
  cur
}
cases <- list(
  list(name = "lh_ar1", x = lh, order = c(1, 0, 0)),
  list(name = "lh_ar3", x = lh, order = c(3, 0, 0)),
  list(name = "lh_arma11", x = lh, order = c(1, 0, 1)),
  list(name = "lh_ma2_nomean", x = lh, order = c(0, 0, 2), mean = FALSE),
  list(name = "lh_arima110", x = lh, order = c(1, 1, 0)),
  list(name = "lh_arima011", x = lh, order = c(0, 1, 1)),
  list(name = "lh_arima120", x = lh, order = c(1, 2, 0)),
  list(name = "usacc_airline", x = USAccDeaths, order = c(0, 1, 1), seasonal = c(0, 1, 1)),
  list(name = "presidents_ar1_na", x = presidents, order = c(1, 0, 0)),
  list(name = "presidents_sar", x = presidents, order = c(2, 0, 1), seasonal = c(1, 0, 0)),
  list(name = "lakehuron_xreg", x = LakeHuron, order = c(2, 0, 0), xreg = as.numeric(time(LakeHuron) - 1920)),
  list(name = "lakehuron_111_drift", x = LakeHuron, order = c(1, 1, 1), xreg = as.numeric(seq_along(LakeHuron))),
  list(name = "air_log_airline", x = log(AirPassengers), order = c(0, 1, 1), seasonal = c(0, 1, 1)),
  list(name = "lh_ar3_css", x = lh, order = c(3, 0, 0), method = "CSS"),
  list(name = "usacc_airline_css", x = USAccDeaths, order = c(0, 1, 1), seasonal = c(0, 1, 1), method = "CSS"),
  list(name = "lh_ar1_ml", x = lh, order = c(1, 0, 0), method = "ML")
)
for (cs in cases) {
  mean_ <- if (is.null(cs$mean)) TRUE else cs$mean; sea <- if (is.null(cs$seasonal)) c(0, 0, 0) else cs$seasonal
  meth <- if (is.null(cs$method)) "CSS-ML" else cs$method
  f0 <- arima(cs$x, order = cs$order, seasonal = sea, xreg = cs$xreg, include.mean = mean_, method = meth)
  ft <- arima(cs$x, order = cs$order, seasonal = sea, xreg = cs$xreg, include.mean = mean_, method = if (meth == "CSS") "CSS" else "ML",
              optim.control = list(reltol = 1e-15, maxit = 5000))
  crit <- function(th) { r <- tryCatch(arima(cs$x, order = cs$order, seasonal = sea, xreg = cs$xreg, include.mean = mean_,
                                             method = if (meth == "CSS") "CSS" else "ML", fixed = th, transform.pars = FALSE), error = function(e) NULL)
    # the invertible region only: the likelihood can rise towards a non-invertible boundary (lh MA(2), first run)
    cf <- if (is.null(r)) NULL else coef(r); maTerms <- cf[grep("^ma", names(cf))]; smaTerms <- cf[grep("^sma", names(cf))]
    inv <- function(m) !length(m) || all(Mod(polyroot(c(1, m))) > 1)
    if (is.null(r) || !inv(maTerms) || !inv(smaTerms)) Inf else if (meth == "CSS") log(r$sigma2) else -r$loglik }
  # the reference is the local optimum R's default fit reaches: when the likelihood rises towards a boundary instead
  # (lh MA(2): R's tight refit and Newton both move to ma2 -> 1), Newton starts from the default fit and a result that
  # leaves it by more than 1e-3 is not taken
  th <- newton(crit, unname(coef(ft)))
  if (max(abs(th - coef(f0))) > 1e-3 * max(1, max(abs(coef(f0))))) {
    th <- newton(crit, unname(coef(f0)))
    if (max(abs(th - coef(f0))) > 1e-3 * max(1, max(abs(coef(f0))))) th <- unname(coef(f0))
  }
  fo <- arima(cs$x, order = cs$order, seasonal = sea, xreg = cs$xreg, include.mean = mean_, method = if (meth == "CSS") "CSS" else "ML",
              fixed = th, transform.pars = FALSE)
  nx <- if (!is.null(cs$xreg)) max(cs$xreg) + 1:12 else NULL
  po <- predict(fo, n.ahead = 12, newxreg = nx); p0 <- predict(f0, n.ahead = 12, newxreg = nx)
  out[[cs$name]] <- list(
    x = as.numeric(cs$x), frequency = frequency(cs$x), order = cs$order, seasonal = sea, include_mean = mean_, method = meth,
    xreg = cs$xreg,
    R = list(coef = unname(coef(f0)), names = names(coef(f0)), sigma2 = f0$sigma2, loglik = f0$loglik, aic = f0$aic, var_coef = unname(f0$var.coef),
             nobs = f0$nobs, n_cond = f0$n.cond, arma = f0$arma, pred = as.numeric(p0$pred), se = as.numeric(p0$se)),
    optimum = list(coef = th, sigma2 = fo$sigma2, loglik = fo$loglik, residuals = as.numeric(residuals(fo)), pred = as.numeric(po$pred),
                   se = as.numeric(po$se), aic = fo$aic, nobs = fo$nobs, gain_over_tight = crit(unname(coef(ft))) - crit(th)))
}
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "arima.json"))
