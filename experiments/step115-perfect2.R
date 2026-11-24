# step115-perfect2.R: the threshold of stats' drop1 warning "attempting model selection on an essentially perfect fit
# is nonsense" more finely, public functions only (1.15.0): eps on a fine grid around the change found in
# step115-perfect (RSS / sum(y^2) between 4e-11 and 2.4e-9), without and with case weights (does the sum of squares
# of y carry the weights?), and with n = 300.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
warned <- function(expr) {
  warns <- character(0)
  withCallingHandlers(expr, warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  length(warns)
}
out <- list(R = R.version.string)
one <- function(n, eps, weighted, seed) {
  set.seed(seed)
  d <- data.frame(x1 = rnorm(n), x2 = rnorm(n), z = rnorm(n))
  d$w <- if (weighted) runif(n, 0.1, 10) else rep(1, n)
  d$y <- d$x1 + d$x2 + eps * d$z
  m <- lm(y ~ x1 + x2, data = d, weights = w)
  list(n = n, eps = eps, weighted = weighted, rss = deviance(m), ssy = sum(d$y^2), sswy = sum(d$w * d$y^2),
       ssfit = sum(d$w * fitted(m)^2), warned = warned(drop1(m)))
}
eps <- 10^seq(-5.5, -3.5, by = 0.05)
out$cases <- c(lapply(eps, function(e) one(30, e, FALSE, 1)), lapply(eps, function(e) one(30, e, TRUE, 1)),
               lapply(eps, function(e) one(300, e, FALSE, 2)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
