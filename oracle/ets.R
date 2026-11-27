# issue: 570
# oracle-platform: amd64
# Public outputs of forecast 9.0.2's ets and forecast.ets for test/fixtures/ets.json (1.20.0). The behaviour is in
# oracle/tsmeta-behaviour.md ("ets"); the experiments behind it in experiments/tsmeta120-ets*.R. rStats.js is checked
# at R's own estimates (filter, likelihood, criteria, forecasts) and, for the estimation, by its likelihood against R's
# (R's optimiser stops early; rStats.js optimises further).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
fits <- list(
  list("nile_ANN", Nile, "ANN", FALSE), list("nile_MNN", Nile, "MNN", FALSE),
  list("uspop_AAN", uspop, "AAN", FALSE), list("uspop_AAdN", uspop, "AAN", TRUE), list("uspop_MAN", uspop, "MAN", FALSE),
  list("uspop_MAdN", uspop, "MAN", TRUE),
  list("usacc_ANA", USAccDeaths, "ANA", FALSE), list("usacc_AAA", USAccDeaths, "AAA", FALSE), list("usacc_AAdA", USAccDeaths, "AAA", TRUE),
  list("usacc_MNA", USAccDeaths, "MNA", FALSE), list("usacc_MAA", USAccDeaths, "MAA", FALSE),
  list("air_MNM", AirPassengers, "MNM", FALSE), list("air_MAM", AirPassengers, "MAM", FALSE), list("air_MAdM", AirPassengers, "MAM", TRUE),
  list("ukgas_ANA", ts(as.numeric(UKgas), frequency = 4), "ANA", FALSE), list("co2_MAM", co2, "MAM", FALSE)
)
out <- list(fits = list(), auto = list())
for (cs in fits) {
  fit <- ets(cs[[2]], model = cs[[3]], damped = cs[[4]]); m <- frequency(cs[[2]])
  fc <- forecast(fit, h = if (substr(cs[[3]], 3, 3) == "N") 10 else 2 * m, level = c(80, 95))
  out$fits[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = m, model = cs[[3]], damped = cs[[4]],
    par = unname(fit$par), par_names = names(fit$par), loglik = fit$loglik, aic = fit$aic, bic = fit$bic, aicc = fit$aicc,
    sigma2 = fit$sigma2, mse = fit$mse, amse = fit$amse, method = fit$method, states = unname(fit$states),
    fitted = as.numeric(fitted(fit)), residuals = as.numeric(residuals(fit)),
    mean = as.numeric(fc$mean), lower = unname(fc$lower), upper = unname(fc$upper))
}
for (cs in list(list("nile", Nile), list("usacc", USAccDeaths), list("air", AirPassengers), list("uspop", uspop),
                list("lynx", lynx), list("ukgas", ts(as.numeric(UKgas), frequency = 4)), list("wwwusage", WWWusage))) {
  fit <- ets(cs[[2]])
  out$auto[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), method = fit$method, aicc = fit$aicc, loglik = fit$loglik)
}
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "ets.json"))
