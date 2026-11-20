# Numerical edge cases on the R side (public functions only): what R does where rStats.js was found to struggle.
library(MASS)
show <- function(label, expr) {
  r <- tryCatch(withCallingHandlers(expr, warning = function(w) { cat("  warning:", conditionMessage(w), "\n"); invokeRestart("muffleWarning") }),
    error = function(e) paste("ERROR", conditionMessage(e)))
  cat(label, if (is.character(r)) r else paste(format(r, digits = 10), collapse = " "), "\n")
}
x <- (0:29) / 3; y <- 1 + 2 * x + sin((0:29) * 3) * 0.3
for (big in c(1e10, 1e20, 1e100, 1e300)) { yy <- y; yy[6] <- big; show(paste("rlm M, one outlier", big, ": coef"), coef(rlm(yy ~ x))) }
xs <- c(-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5,3,-2.8,-1.2,0.2,1.8,2.9,-0.3,0.7,1.1,-1.7,2.2,-2.2)
lev <- c("a","b","c","d")
ys <- factor(lev[pmin(4, pmax(1, round(xs * 0.6 + 1.5 + sin((0:23) * 7) * 1.1) + 1))], levels = lev, ordered = TRUE)
show("polr x: coef", coef(polr(ys ~ xs)))
show("polr constant predictor: coef", coef(polr(ys ~ xs + k, data = data.frame(ys, xs, k = 3))))
show("polr collinear predictors: coef", coef(polr(ys ~ xs + z, data = data.frame(ys, xs, z = 2 * xs))))
for (w in c(1e-6, 1e-10, 1e-20)) show(paste("polr weights all", w, ": coef"), coef(polr(ys ~ xs, weights = rep(w, 24))))
ex <- 0:10; ey <- 2 * exp(0.3 * ex) + sin(0:10) * 0.05; eyInf <- ey; eyInf[4] <- Inf
show("nls Inf in y: coef", coef(nls(eyInf ~ a * exp(b * ex), start = list(a = 1, b = 0.3))))
xx <- (0:29) / 3; yy <- factor(ifelse(xx < 3, "a", ifelse(xx < 6, "b", "c")), levels = c("a","b","c"), ordered = TRUE)
yy[10] <- "a"; yy[19] <- "b"
fit <- polr(yy ~ xx, Hess = TRUE)
show("polr near separation: coef", coef(fit))
show("polr near separation: profile confint", confint(fit))
