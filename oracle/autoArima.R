# issue: 570
# oracle-platform: amd64
# Public outputs of forecast 9.0.2's auto.arima for test/fixtures/autoArima.json (1.20.0): the chosen model, its fit and
# the printed search trace. The behaviour is in oracle/tsmeta-behaviour.md ("auto.arima"); the experiments behind it in
# experiments/tsmeta120-autoarima*.R. With approximation R's printed values carry a constant per series (log 45-46), so
# only the models and their Inf marks are compared there.
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
cases <- list(
  list("lh", lh), list("lakehuron", LakeHuron), list("wwwusage", WWWusage), list("nile", Nile),
  list("usaccdeaths", USAccDeaths), list("airpassengers", AirPassengers), list("ukgas", UKgas),
  list("sunspot_year", sunspot.year), list("nottem", nottem), list("lh_full", lh, list(stepwise = FALSE)),
  list("usacc_full", USAccDeaths, list(stepwise = FALSE, approximation = FALSE)), list("lynx_bic", lynx, list(ic = "bic"))
)
out <- list()
for (cs in cases) {
  args <- if (length(cs) > 2) cs[[3]] else list()
  lines <- capture.output(fit <- do.call("auto.arima", c(list(cs[[2]], trace = TRUE), args)))
  out[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), args = args, trace = lines,
    order = unname(arimaorder(fit)), coef = unname(coef(fit)), names = names(coef(fit)), aicc = fit$aicc, aic = fit$aic,
    bic = fit$bic, loglik = fit$loglik, sigma2 = fit$sigma2)
}
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "autoArima.json"))
