# Does predict(fit, newdata) use the formula offset of newdata? lm and glm against MASS's polr, same data and
# the same formula offset. Public functions only. The polr probabilities are also computed by hand from the
# coefficients and cut-points, once with the newdata offset and once with the offset set to 0.
library(MASS)
d <- mtcars
d$gearO <- factor(d$gear, ordered = TRUE)
d$off <- d$qsec / 10
nd <- data.frame(wt = c(2, 3, 2, 3), off = c(0, 0, 2, 3), qsec = c(15, 15, 15, 15))

cat("== lm: y ~ wt + offset(off)\n")
m <- lm(mpg ~ wt + offset(off), data = d)
p <- predict(m, newdata = nd)
cat("predict:", format(p, digits = 12), "\n")
cat("by hand with the newdata offset:", format(coef(m)[1] + coef(m)[2] * nd$wt + nd$off, digits = 12), "\n")

cat("== glm (poisson): carb ~ wt + offset(off)\n")
g <- glm(carb ~ wt + offset(off), family = poisson, data = d)
p <- predict(g, newdata = nd, type = "link")
cat("predict:", format(p, digits = 12), "\n")
cat("by hand with the newdata offset:", format(coef(g)[1] + coef(g)[2] * nd$wt + nd$off, digits = 12), "\n")

cat("== polr (MASS): gearO ~ wt + offset(off)\n")
f <- polr(gearO ~ wt + offset(off), data = d, Hess = TRUE)
p <- predict(f, newdata = nd, type = "probs")
cat("predict (rows of probabilities):\n"); print(signif(p, 10))
byHand <- function(offset) {
  eta <- coef(f)[["wt"]] * nd$wt + offset
  cum <- sapply(f$zeta, function(z) plogis(z - eta))
  cbind(cum[, 1], cum[, 2] - cum[, 1], 1 - cum[, 2])
}
cat("by hand with the newdata offset:\n"); print(signif(byHand(nd$off), 10))
cat("by hand with offset 0:\n"); print(signif(byHand(0), 10))
cat("max |predict - by hand with the newdata offset|:", format(max(abs(p - byHand(nd$off))), digits = 3), "\n")
cat("max |predict - by hand with offset 0|:", format(max(abs(p - byHand(0))), digits = 3), "\n")
cat("predict for the rows (wt = 2, off = 0) and (wt = 2, off = 2) equal:", isTRUE(all.equal(unname(p[1, ]), unname(p[3, ]))), "\n")


cat("== does the polr fit itself use the offset? fitted probabilities against hand computation on the training rows\n")
trainByHand <- function(offset) {
  eta <- coef(f)[["wt"]] * d$wt + offset
  cum <- sapply(f$zeta, function(z) plogis(z - eta))
  cbind(cum[, 1], cum[, 2] - cum[, 1], 1 - cum[, 2])
}
cat("max |fitted - by hand with the training offset|:", format(max(abs(fitted(f) - trainByHand(d$off))), digits = 3), "\n")
cat("max |fitted - by hand with offset 0|:", format(max(abs(fitted(f) - trainByHand(0))), digits = 3), "\n")
f0 <- polr(gearO ~ wt, data = d, Hess = TRUE)
cat("coefficient of wt with the offset:", format(coef(f)[["wt"]], digits = 10), " without:", format(coef(f0)[["wt"]], digits = 10), "\n")
cat("predict(fit) without newdata equals fitted(fit):", isTRUE(all.equal(unname(predict(f, type = "probs")), unname(fitted(f)))), "\n")
cat("MASS version:", as.character(packageVersion("MASS")), "\n")
