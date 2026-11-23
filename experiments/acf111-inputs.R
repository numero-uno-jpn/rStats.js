# issue: 560
# Public R dataset values needed to exercise every acf/pacf/ccf fixture in TypeScript.
# No package implementation is inspected; only dataset vectors and deterministic generated inputs are emitted.
library(jsonlite)
set.seed(1)
long <- cumsum(rnorm(5000))
long_partial <- cumsum(rnorm(5000))
ar2 <- as.vector(arima.sim(list(ar = c(0.6, -0.3)), n = 300))
out <- list(
  lh = as.vector(lh),
  ldeaths = as.vector(ldeaths),
  AirPassengers = as.vector(AirPassengers),
  presidents = as.vector(presidents),
  mdeaths = as.vector(mdeaths),
  fdeaths = as.vector(fdeaths),
  long = long,
  long_partial = long_partial,
  ar2 = ar2
)
cat(toJSON(out, digits = I(17), auto_unbox = FALSE, null = "null", na = "string", pretty = FALSE))
