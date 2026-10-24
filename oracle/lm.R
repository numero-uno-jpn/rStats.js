source("/oracle/_linalg.R")

# Linear regression with a matrix interface: lm(y ~ x) or lm(y ~ x - 1) for intercept = FALSE, with optional
# weights; summary.lm, confint, predict (fixture lm). Aliased (linearly dependent) columns get NA coefficients,
# as R reports them; the coefficient table of summary.lm leaves them out.

set.seed(20261027)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

n <- 30
X1 <- matrix(rnorm(n), n, 1)
X3 <- cbind(rnorm(n), runif(n), rnorm(n, 5, 2))
y3 <- drop(1 + X3 %*% c(2, -1, 0.5) + rnorm(n, 0, 0.5))
Xc <- cbind(X3, X3[, 1] + 2 * X3[, 2])          # rank-deficient: column 4 = column 1 + 2 column 2
Xbig <- cbind(1e6 + rnorm(n), 1e6 + rnorm(n))  # nearly collinear with the intercept
ybig <- drop(3 + Xbig %*% c(1e-3, 2e-3) + rnorm(n, 0, 1e-3))
newX3 <- rbind(c(0, 0.5, 5), c(1, 0.1, 3), c(-2, 0.9, 8))

for (int in c(TRUE, FALSE)) {
  add(x = X1, y = I(drop(2 + 3 * X1 + rnorm(n))), intercept = int, newdata = matrix(c(-1, 0, 2), 3, 1))
  add(x = X3, y = I(y3), intercept = int, newdata = newX3)
  add(x = X3, y = I(y3), intercept = int, weights = I(runif(n, 0.5, 2)), newdata = newX3)
  add(x = Xc, y = I(y3), intercept = int)
}
add(x = Xbig, y = I(ybig), intercept = TRUE)
add(x = X3[1:4, ], y = I(y3[1:4]), intercept = TRUE)                 # zero residual degrees of freedom
add(x = X3, y = I(drop(1 + X3 %*% c(2, -1, 0.5))), intercept = TRUE)   # perfect fit
add(x = X3, y = I(c(y3[1:5], NA, y3[7:n])), intercept = TRUE)          # NA in y: the row is dropped (na.omit)
add(x = X3, y = I(y3[1:10]), intercept = TRUE)                         # lengths differ
for (lv in c(0.9, 0.99)) add(x = X3, y = I(y3), intercept = TRUE, newdata = newX3, level = lv)

write_linalg_fixture("lm", cases, function(a) {
  x <- a$x; y <- unclass(a$y)
  w <- if (is.null(a$weights)) NULL else unclass(a$weights)
  fit <- if (isFALSE(a$intercept)) lm(y ~ x - 1, weights = w) else lm(y ~ x, weights = w)
  s <- summary(fit)
  lv <- if (is.null(a$level)) 0.95 else a$level
  ct <- s$coefficients
  out <- list(
    coefficients = vec_out(coef(fit)),       # NA for aliased columns; intercept first when present
    residuals = vec_out(residuals(fit)),
    fittedValues = vec_out(fitted(fit)),
    rank = num2str(fit$rank),
    dfResidual = num2str(fit$df.residual),
    estimate = vec_out(ct[, 1]), stdError = vec_out(ct[, 2]), tValue = vec_out(ct[, 3]), pValue = vec_out(ct[, 4]),
    sigma = num2str(s$sigma),
    rSquared = num2str(s$r.squared), adjRSquared = num2str(s$adj.r.squared)
  )
  if (!is.null(s$fstatistic)) {
    f <- s$fstatistic
    out$fStatistic <- vec_out(f)               # value, numdf, dendf
    out$fPValue <- num2str(pf(f[1], f[2], f[3], lower.tail = FALSE))
  }
  ci <- confint(fit, level = lv)
  out$confLower <- vec_out(ci[, 1]); out$confUpper <- vec_out(ci[, 2])
  if (!is.null(a$newdata)) {
    nd <- data.frame(x = I(a$newdata))
    pc <- predict(fit, nd, interval = "confidence", level = lv)
    pp <- predict(fit, nd, interval = "prediction", level = lv)
    out$predict <- vec_out(pc[, "fit"])
    out$confidenceLower <- vec_out(pc[, "lwr"]); out$confidenceUpper <- vec_out(pc[, "upr"])
    out$predictionLower <- vec_out(pp[, "lwr"]); out$predictionUpper <- vec_out(pp[, "upr"])
  }
  out
})
