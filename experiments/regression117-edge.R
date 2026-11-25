# regression117-edge.R: R on the edge cases of the first pass (1.17.0): betareg with a covariate scaled by 1e+-150 and
# 1e+-300, shifted by 1e8 and 1e15, weights scaled by 1e+-200, responses at 1e-12 and 1 - 1e-12, collinear columns,
# n = 2 and 3, a constant response, a large n (timing); tobit with the response scaled by 1e+-150; loglin with the
# counts scaled by 1e+-300 and with a zero margin cell. Data: the fixture's (oracle/betareg.R).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg); library(AER) })
set.seed(20261125)
n <- 70
x1 <- round(rnorm(n), 4); x2 <- round(runif(n), 4); z1 <- round(rnorm(n), 4); g <- sample(c("a", "b", "c"), n, TRUE)
w <- rpois(n, 1.5) + 1
mu0 <- plogis(-0.3 + 0.6 * x1 - 0.8 * x2 + 0.3 * (g == "c")); ph0 <- exp(2.5 + 0.5 * z1)
yv <- round(rbeta(n, mu0 * ph0, (1 - mu0) * ph0), 6)
yc <- round(rbeta(n, mu0 * 20, (1 - mu0) * 20), 6)
d <- data.frame(x1, x2, w, yc)
assign("d", d, envir = globalenv())
run <- function(expr) {
  t0 <- proc.time()[["elapsed"]]
  r <- tryCatch(withCallingHandlers(expr, warning = function(w) invokeRestart("muffleWarning")), error = function(e) list(error = conditionMessage(e)))
  if (is.list(r) && !is.null(r$error)) return(r)
  list(value = r, seconds = proc.time()[["elapsed"]] - t0)
}
cf <- function(f) unname(c(f$coefficients$mean, f$coefficients$precision))
out <- list(R = R.version.string, arch = R.version$arch)
out$base <- run(cf(betareg(yc ~ x1 + x2, data = d)))
for (s in c(1e150, 1e-150, 1e300, 1e-300)) { dd <- d; dd$x1 <- d$x1 * s; assign("dd", dd, envir = globalenv()); out[[paste0("x*", s)]] <- run(cf(betareg(yc ~ x1 + x2, data = dd))) }
for (s in c(1e8, 1e15)) { dd <- d; dd$x1 <- d$x1 + s; assign("dd", dd, envir = globalenv()); out[[paste0("x+", s)]] <- run(cf(betareg(yc ~ x1 + x2, data = dd))) }
for (s in c(1, 1e200, 1e-200)) { dd <- d; dd$w <- d$w * s; assign("dd", dd, envir = globalenv()); out[[paste0("w*", s)]] <- run(cf(betareg(yc ~ x1 + x2, data = dd, weights = w))) }
dd <- d; dd$yc[1:5] <- 1e-12; assign("dd", dd, envir = globalenv()); out$y_tiny <- run(cf(betareg(yc ~ x1 + x2, data = dd)))
dd <- d; dd$yc[1:5] <- 1 - 1e-12; assign("dd", dd, envir = globalenv()); out$y_near1 <- run(cf(betareg(yc ~ x1 + x2, data = dd)))
dd <- d; dd$x3 <- 2 * d$x1; assign("dd", dd, envir = globalenv()); out$collinear <- run(cf(betareg(yc ~ x1 + x3, data = dd)))
out$n2 <- run(cf(betareg(yc ~ x1, data = data.frame(yc = c(0.2, 0.5), x1 = c(1, 2)))))
out$n3 <- run(cf(betareg(yc ~ x1, data = data.frame(yc = c(0.2, 0.5, 0.4), x1 = c(1, 2, 3)))))
dd <- d; dd$yc <- 0.3; assign("dd", dd, envir = globalenv()); out$const_y <- run(cf(betareg(yc ~ x1, data = dd)))
N <- 100000; i <- 0:(N - 1); xs <- sin(i) * 2; ys <- 1 / (1 + exp(-(0.3 + 0.5 * xs))) * 0.9 + 0.05 * ((i * 7919) %% 1000) / 1000
big <- data.frame(y = ys, x = xs); assign("big", big, envir = globalenv())
out$n1e5_ML <- run(cf(betareg(y ~ x, data = big)))
out$n2e4_BR <- run(cf(betareg(y ~ x, data = big[1:20000, ], type = "BR")))
tb <- function(f) unname(c(coef(f), f$scale))
for (s in c(1, 1e150, 1e-150)) { dd <- d; dd$yt <- (d$yc - 0.3) * s; assign("dd", dd, envir = globalenv()); out[[paste0("tobit*", s)]] <- run(tb(tobit(yt ~ x1, data = dd))) }
t3 <- array(c(32, 11, 10, 3, 53, 50, 25, 15, 10, 10, 7, 7, 3, 30, 5, 8), c(2, 2, 4))
ll <- function(t) { it <- capture.output(r <- loglin(t, list(c(1, 2), c(1, 3), c(2, 3)), fit = TRUE)); list(lrt = r$lrt, pearson = r$pearson, it = it, fit1 = r$fit[1]) }
out$loglin_base <- run(ll(t3)); out$loglin_1e300 <- run(ll(t3 * 1e300)); out$loglin_1e_300 <- run(ll(t3 * 1e-300))
tz <- t3; tz[c(1, 5, 9, 13)] <- 0; out$loglin_zero <- run(ll(tz))
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
