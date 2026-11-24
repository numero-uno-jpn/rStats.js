# step115-perfect.R: when stats' drop1 / add1 warn "attempting model selection on an essentially perfect fit is
# nonsense", public functions only (1.15.0). y = x1 + x2 + eps z for a grid of eps, at three scales of y (times 1,
# 1e6 and 1e-6) and with a large common value (1e6 added); for each, the residual sum of squares, the warnings of
# drop1 and add1 (lm and a gaussian glm), and the ratios that a threshold could be on.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
warned <- function(expr) {
  warns <- character(0)
  withCallingHandlers(expr, warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  warns
}
set.seed(20261130)
n <- 30
base <- data.frame(x1 = rnorm(n), x2 = rnorm(n), x3 = rnorm(n), z = rnorm(n))
eps <- 10^-(2:15)
grid <- expand.grid(eps = eps, scale = c(1, 1e6, 1e-6), shift = c(0, 1e6))
out <- list(R = R.version.string)
out$cases <- lapply(seq_len(nrow(grid)), function(i) {
  g <- grid[i, ]
  d <- base
  d$y <- g$shift + g$scale * (d$x1 + d$x2 + g$eps * d$z)
  m <- lm(y ~ x1 + x2 + x3, data = d)
  m0 <- lm(y ~ x1, data = d)
  gm <- glm(y ~ x1 + x2 + x3, data = d)
  list(eps = g$eps, scale = g$scale, shift = g$shift, rss = deviance(m), tss = sum((d$y - mean(d$y))^2),
       ssy = sum(d$y^2), dfResidual = df.residual(m),
       drop1 = warned(drop1(m)), add1 = warned(add1(m0, scope = ~ x1 + x2 + x3)), drop1_glm = warned(drop1(gm)))
})
cat(toJSON(out, digits = I(17), auto_unbox = FALSE, null = "null", na = "string", pretty = TRUE))
