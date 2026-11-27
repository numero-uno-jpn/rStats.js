# issue: 570
# oracle-platform: amd64
# Public outputs of stats' filter, Box.test, diffinv, decompose, ar, predict.ar, arima0, HoltWinters and
# predict.HoltWinters (R 4.6.2) for test/fixtures/statsTs.json (1.20.0). The behaviour is in oracle/tsmeta-behaviour.md;
# the experiments behind it in experiments/tsmeta120-stats*.R and -hw*.R.
library(jsonlite)
out <- list()
x <- c(3, 1, 4, 1, 5, NA, 9, 2, 6, 5, 3, 5)
y <- as.numeric(lh)
out$filter <- list(
  conv2 = as.numeric(filter(y, rep(1 / 3, 3))), conv2even = as.numeric(filter(y, c(0.25, 0.25, 0.25, 0.25))),
  conv1 = as.numeric(filter(y, c(0.5, 0.3, 0.2), sides = 1)), circ = as.numeric(filter(y, c(0.2, 0.5, 0.3), circular = TRUE)),
  na = as.numeric(filter(x, c(0.5, 0.5))), rec = as.numeric(filter(y, c(0.5, -0.2), method = "recursive")),
  recinit = as.numeric(filter(y, c(0.5, -0.2), method = "recursive", init = c(1.5, -0.7))), y = y, x = x)
bt <- list()
for (cs in list(list("bp1", y, 1, "Box-Pierce", 0), list("lb10", y, 10, "Ljung-Box", 0), list("lb5fit", as.numeric(LakeHuron), 5, "Ljung-Box", 2))) {
  r <- Box.test(cs[[2]], lag = cs[[3]], type = cs[[4]], fitdf = cs[[5]])
  bt[[cs[[1]]]] <- list(x = cs[[2]], lag = cs[[3]], type = cs[[4]], fitdf = cs[[5]], statistic = unname(r$statistic), df = unname(r$parameter), p = r$p.value)
}
out$box <- bt
out$diffinv <- list(a = diffinv(c(1, 4, 2, 7)), b = as.numeric(diffinv(c(1, 4, 2, 7, 3, 8), lag = 2, differences = 2, xi = c(1, 2, 3, 5))),
                    c = as.numeric(diffinv(y, lag = 3, xi = c(2, 1, 0))))
dc <- list()
for (cs in list(list("co2", co2, "additive"), list("usacc", USAccDeaths, "additive"), list("air", AirPassengers, "multiplicative"),
                list("q", ts(as.numeric(UKgas)[1:40], frequency = 4), "additive"), list("f5", ts(sin(1:37) + (1:37) / 5, frequency = 5), "additive"),
                list("air_apr", ts(as.numeric(AirPassengers)[4:144], frequency = 12, start = c(1949, 4)), "multiplicative"))) {
  d <- decompose(cs[[2]], type = cs[[3]])
  dc[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), type = cs[[3]], seasonal = as.numeric(d$seasonal),
                        trend = as.numeric(d$trend), random = as.numeric(d$random), figure = d$figure)
}
out$decompose <- dc
arr <- list()
for (cs in list(list("lh", lh), list("lakehuron", LakeHuron), list("sunspot", sunspot.year), list("dlair", diff(log(AirPassengers))))) {
  r <- list(x = as.numeric(cs[[2]]))
  for (mth in c("yule-walker", "burg", "ols", "mle")) {
    a <- ar(cs[[2]], method = mth); pr <- predict(a, n.ahead = 8)
    r[[mth]] <- list(order = a$order, ar = as.numeric(a$ar), var_pred = as.numeric(a$var.pred), x_mean = unname(a$x.mean),
                     aic = unname(a$aic), partialacf = as.numeric(a$partialacf), x_intercept = if (is.null(a$x.intercept)) NULL else unname(a$x.intercept),
                     pred = as.numeric(pr$pred), se = as.numeric(pr$se))
  }
  b2 <- ar(cs[[2]], method = "burg", var.method = 2)
  r$burg2 <- list(order = b2$order, ar = as.numeric(b2$ar), var_pred = as.numeric(b2$var.pred), aic = unname(b2$aic))
  arr[[cs[[1]]]] <- r
}
out$ar <- arr
a0 <- list()
for (cs in list(list("lh_ar1", lh, c(1, 0, 0), c(0, 0, 0)), list("lh_arma11", lh, c(1, 0, 1), c(0, 0, 0)),
                list("lake_110", LakeHuron, c(1, 1, 0), c(0, 0, 0)), list("usacc_air", USAccDeaths, c(0, 1, 1), c(0, 1, 1)))) {
  # delta = -1: no fast recursions, i.e. the exact likelihood (log 84); the default delta = 0.01 is an approximation
  f <- arima0(cs[[2]], order = cs[[3]], seasonal = list(order = cs[[4]], period = frequency(cs[[2]])), delta = -1,
              optim.control = list(reltol = 1e-14, maxit = 2000))
  # and the default delta = 0.01 (fast recursions, log 87), tightened likewise
  g <- arima0(cs[[2]], order = cs[[3]], seasonal = list(order = cs[[4]], period = frequency(cs[[2]])),
              optim.control = list(reltol = 1e-14, maxit = 2000))
  a0[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), order = cs[[3]], seasonal = cs[[4]],
                        coef = unname(f$coef), names = names(f$coef), sigma2 = f$sigma2, loglik = f$loglik, aic = f$aic,
                        fast = list(coef = unname(g$coef), sigma2 = g$sigma2, loglik = g$loglik, resid = as.numeric(residuals(g))))
}
out$arima0 <- a0
hw <- list()
for (cs in list(list("co2", co2, list()), list("air_mult", AirPassengers, list(seasonal = "multiplicative")),
                list("usacc", USAccDeaths, list()), list("uspop", uspop, list(gamma = FALSE)), list("nile", Nile, list(gamma = FALSE, beta = FALSE)),
                list("co2_given", co2, list(alpha = 0.5, beta = 0.01, gamma = 0.3)),
                list("usacc_mult", USAccDeaths, list(seasonal = "multiplicative")))) {
  f <- do.call("HoltWinters", c(list(cs[[2]]), cs[[3]])); fr <- frequency(cs[[2]])
  p <- predict(f, n.ahead = 2 * max(fr, 6), prediction.interval = TRUE)
  hw[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = fr, args = cs[[3]], alpha = unname(f$alpha), beta = unname(f$beta), gamma = unname(f$gamma),
                        coefficients = unname(f$coefficients), names = names(f$coefficients), SSE = f$SSE, xhat = as.numeric(f$fitted[, 1]),
                        fit = as.numeric(p[, "fit"]), upr = as.numeric(p[, "upr"]), lwr = as.numeric(p[, "lwr"]))
}
out$hw <- hw
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "statsTs.json"))
