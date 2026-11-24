# issue: 560
# Public R dataset values needed to exercise the acf/pacf/ccf fixtures in TypeScript.
# No package implementation is inspected; only public data vectors and deterministic generated inputs are emitted.
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
  ar2 = ar2
)
cat(toJSON(out, digits = I(17), auto_unbox = FALSE, null = "null", na = "string", pretty = FALSE))
