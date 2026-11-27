# tsmeta120-simple2.R: three questions from the forecastSimple fixture (1.20.0, log item 91). Designed:
# (1) croston: the same series ending in 0, 4 and 100 (does the last demand reach the forecast?), and ending in 4 then 0;
# (2) easter(easter.mon = TRUE) quarterly: start in Q1 and in Q2 over 2012-2014 (Easter 2013 = 31 March, Monday 1 April),
#     the monthly values for comparison, and easter.mon = FALSE;
# (3) thetaf on AirPassengers: the model object's class, alpha, sigma2 and its residuals / fitted (the adjusted scale?),
#     and the forecast's lower / upper against ses on the seasonally adjusted series.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
base <- c(0, 0, 4, 1, 0, 18, 5, 1, 6, 0, 0, 0, 2, 4, 0, 0, 2, 3)
cro <- lapply(list(c(base, 0), c(base, 4), c(base, 100), c(base, 4, 0)), function(y) { f <- croston(y, h = 2); list(y = y, mean = as.numeric(f$mean), fitted = as.numeric(fitted(f))) })
eq <- function(start, mon) as.numeric(easter(ts(rep(0, 12), start = start, frequency = 4), easter.mon = mon))
em <- function(mon) as.numeric(easter(ts(rep(0, 36), start = c(2012, 1), frequency = 12), easter.mon = mon))
eas <- list(q1_mon = eq(c(2012, 1), TRUE), q2_mon = eq(c(2012, 2), TRUE), q1 = eq(c(2012, 1), FALSE), q2 = eq(c(2012, 2), FALSE), monthly_mon = em(TRUE), monthly = em(FALSE))
th <- thetaf(AirPassengers, h = 4)
mdl <- th$model
sa <- AirPassengers / rep(decompose(AirPassengers, type = "multiplicative")$figure, length.out = 144)
sf <- ses(sa, h = 4)
theta <- list(model_class = class(mdl), alpha = if (!is.null(mdl$par)) unname(mdl$par["alpha"]) else NA, sigma2 = if (!is.null(mdl$sigma2)) mdl$sigma2 else NA,
              model_names = names(mdl), mean = as.numeric(th$mean), lower = unname(as.matrix(th$lower)), upper = unname(as.matrix(th$upper)),
              fitted = as.numeric(fitted(th)), residuals = as.numeric(residuals(th)), model_residuals = if (!is.null(mdl$residuals)) as.numeric(mdl$residuals) else NA,
              ses_sa = list(alpha = unname(sf$model$par["alpha"]), sigma2 = sf$model$sigma2, lower = unname(as.matrix(sf$lower)), upper = unname(as.matrix(sf$upper)), mean = as.numeric(sf$mean),
                            residuals = as.numeric(residuals(sf))), sa = as.numeric(sa))
cat(toJSON(list(R = R.version.string, arch = R.version$arch, croston = cro, easter = eas, theta = theta), digits = I(17), auto_unbox = TRUE, na = "null"))
