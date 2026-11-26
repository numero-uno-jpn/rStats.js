# tsmeta120-autoarima.R: forecast's auto.arima (1.20.0), first experiment: the printed trace (trace = TRUE), i.e.
# the order in which models are tried and the criterion printed for each, for a few series, with and without
# stepwise and approximation; and the final model's orders, coefficients, aicc. Nothing is computed here; the
# trace is compared with the Hyndman and Khandakar (2008) algorithm outside R (log item 43).
# Output: JSON on stdout. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
for (cs in list(list("lh", lh, TRUE, FALSE), list("wwwusage", WWWusage, TRUE, FALSE), list("usacc", USAccDeaths, TRUE, FALSE),
                list("air", AirPassengers, TRUE, FALSE), list("lh_full", lh, FALSE, FALSE), list("air_approx", AirPassengers, TRUE, TRUE),
                list("lakehuron", LakeHuron, TRUE, FALSE))) {
  tr <- capture.output(fit <- auto.arima(cs[[2]], stepwise = cs[[3]], approximation = cs[[4]], trace = TRUE))
  out[[cs[[1]]]] <- list(trace = tr, order = arimaorder(fit), coef = coef(fit), aicc = fit$aicc, aic = fit$aic, loglik = fit$loglik)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
