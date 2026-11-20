# polr with a predictor rescaled by 1e100, 1e-100, 1e300, 1e-300: does MASS's polr fit, and is it equivariant?
# Also complete and near separation. Public functions only.
library(MASS)
set.seed(1)
n <- 300
x <- rnorm(n); z <- rnorm(n)
l <- 0.8 * x - 0.5 * z + rlogis(n)
y <- factor(cut(l, c(-Inf, -1, 0, 1.2, Inf), labels = c("a", "b", "c", "d")), ordered = TRUE)
base <- polr(y ~ x + z, Hess = TRUE)
cat("base coef", format(coef(base), digits = 10), "zeta", format(base$zeta, digits = 10), "logLik", format(logLik(base), digits = 12), "\n")
for (s in c(1e100, 1e-100, 1e300, 1e-300)) {
  xs <- x * s
  r <- tryCatch({
    f <- withCallingHandlers(polr(y ~ xs + z, Hess = TRUE), warning = function(w) { cat("  warning:", conditionMessage(w), "\n"); invokeRestart("muffleWarning") })
    sev <- sqrt(diag(vcov(f)))
    sprintf("coef*s rel %.1e zeta rel %.1e logLik rel %.1e se*s rel %.1e", abs(coef(f)[1] * s - coef(base)[1]) / abs(coef(base)[1]),
      max(abs(f$zeta - base$zeta) / abs(base$zeta)), abs(as.numeric(logLik(f)) - as.numeric(logLik(base))) / abs(as.numeric(logLik(base))),
      abs(sev[1] * s - sqrt(diag(vcov(base)))[1]) / sqrt(diag(vcov(base)))[1])
  }, error = function(e) paste("ERROR", conditionMessage(e)))
  cat("scale", s, ":", r, "\n")
}
xx <- (0:59) / 10
yy <- factor(ifelse(xx < 2, "a", ifelse(xx < 4, "b", "c")), levels = c("a", "b", "c"), ordered = TRUE)
for (lab in c("complete", "near")) {
  y2 <- yy; if (lab == "near") y2[26] <- "a"
  r <- tryCatch({
    f <- withCallingHandlers(polr(y2 ~ xx, Hess = TRUE), warning = function(w) { cat("  warning:", conditionMessage(w), "\n"); invokeRestart("muffleWarning") })
    paste("coef", format(coef(f), digits = 8), "zeta", paste(format(f$zeta, digits = 8), collapse = " "), "logLik", format(logLik(f), digits = 8), "convergence", f$convergence)
  }, error = function(e) paste("ERROR", conditionMessage(e)))
  cat(lab, "separation:", r, "\n")
}
