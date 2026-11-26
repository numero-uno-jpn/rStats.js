# tsmeta120-ets3.R: forecast.ets, third ets experiment (1.20.0): the shape of the remaining differences of
# tsmeta120-ets2 (class 3 point forecasts and variances; ANA's class 1 variance), printed per horizon: R's mean and
# half-width beside mu~_h s_h (non-seasonal zero-error path times the seasonal state) and the section 6.3 variance.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
pars <- function(fit, nm, d) if (nm %in% names(fit$par)) unname(fit$par[nm]) else d
for (cs in list(list("MNM", AirPassengers, "MNM", FALSE), list("MAM", AirPassengers, "MAM", FALSE), list("ANA", USAccDeaths, "ANA", FALSE),
                list("AAA", USAccDeaths, "AAA", FALSE), list("MNA", USAccDeaths, "MNA", FALSE))) {
  fit <- ets(cs[[2]], model = cs[[3]], damped = cs[[4]]); h <- 30; m <- frequency(fit$x)
  fc <- forecast(fit, h = h, level = 95)
  st <- fit$states[nrow(fit$states), ]; sv <- unname(st[grep("^s", names(st))]); sh <- sv[m - ((1:h - 1) %% m)]
  l <- unname(st["l"]); b <- if ("b" %in% names(st)) unname(st["b"]) else 0
  mt <- l + b * (1:h)
  out[[cs[[1]]]] <- list(par = fit$par, sigma2 = fit$sigma2, R_mean = as.numeric(fc$mean),
                         path = if (cs[[3]] %in% c("MNM", "MAM")) mt * sh else mt + sh,
                         R_half = (as.numeric(fc$upper) - as.numeric(fc$mean)) / qnorm(0.975), s_last = sv, l = l, b = b)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
