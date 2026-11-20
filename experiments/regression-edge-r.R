# Stage-3 edge inputs on the R side. Public functions only.
# 1. rlm when all or most points lie exactly on a line (M and MM).
# 2. Time of polr with 200 response levels (n = 1000) and with a 150-level factor (n = 300).
library(MASS)
set.seed(1)
x <- rnorm(100); y <- 1 + 2 * x + 0.5 * rnorm(100)
show <- function(label, expr) {
  r <- tryCatch(withCallingHandlers(expr, warning = function(w) { cat("  warning:", conditionMessage(w), "\n"); invokeRestart("muffleWarning") }),
    error = function(e) paste("ERROR", conditionMessage(e)))
  if (is.character(r)) cat(label, r, "\n") else cat(label, "coef", format(coef(r), digits = 15), "scale", format(r$s, digits = 6), "converged", r$converged, "\n")
}
yl <- 1 + 2 * x
show("rlm M all on a line:", rlm(yl ~ x))
show("rlm MM all on a line:", rlm(yl ~ x, method = "MM"))
y60 <- y; y60[1:60] <- yl[1:60]
show("rlm M 60% on a line:", rlm(y60 ~ x))
show("rlm MM 60% on a line:", rlm(y60 ~ x, method = "MM"))
xx <- rnorm(1000); yy <- xx + rnorm(1000)
yf <- factor(cut(rank(yy), 200, labels = FALSE), ordered = TRUE)
t1 <- system.time(f1 <- polr(yf ~ xx))
cat("polr 200 levels n=1000: coef", format(coef(f1), digits = 8), "logLik", format(logLik(f1), digits = 10), "elapsed", t1[["elapsed"]], "\n")
x3 <- rnorm(300); z3 <- rnorm(300); g3 <- factor(paste0("g", (1:300) %% 150))
y3 <- factor(cut(0.8 * x3 - 0.5 * z3 + rlogis(300), c(-Inf, -1, 0, 1.2, Inf), labels = c("a", "b", "c", "d")), ordered = TRUE)
t2 <- system.time(f2 <- withCallingHandlers(polr(y3 ~ x3 + g3), warning = function(w) { cat("  warning:", conditionMessage(w), "\n"); invokeRestart("muffleWarning") }))
cat("polr 150-level factor n=300: coef x", format(coef(f2)[1], digits = 8), "logLik", format(logLik(f2), digits = 10), "elapsed", t2[["elapsed"]], "\n")
