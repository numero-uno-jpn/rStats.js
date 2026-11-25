# regression117-edge2.R: the second pass over the edge cases (1.17.0): tobit with a zero weight and with a factor
# whose level has only censored responses; betareg with a missing value in a precision-model variable only, with a
# zero weight in a modelled-precision fit, and predictions for a new factor level; loglin with iter = 0; loglm with
# numbers for an unnamed table. Data: the fixture's (oracle/betareg.R, oracle/tobit.R).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg); library(AER); library(MASS) })
run <- function(expr) tryCatch(withCallingHandlers(expr, warning = function(w) invokeRestart("muffleWarning")), error = function(e) list(error = conditionMessage(e)))
set.seed(20261125)
n <- 70
x1 <- round(rnorm(n), 4); x2 <- round(runif(n), 4); z1 <- round(rnorm(n), 4); g <- sample(c("a", "b", "c"), n, TRUE)
w <- rpois(n, 1.5) + 1
mu0 <- plogis(-0.3 + 0.6 * x1 - 0.8 * x2 + 0.3 * (g == "c")); ph0 <- exp(2.5 + 0.5 * z1)
yv <- round(rbeta(n, mu0 * ph0, (1 - mu0) * ph0), 6)
d <- data.frame(x1, x2, z1, g, w, yv, stringsAsFactors = FALSE)
d$z1na <- d$z1; d$z1na[c(3, 7)] <- NA; d$w0 <- d$w; d$w0[c(2, 5)] <- 0
assign("d", d, envir = globalenv())
cf <- function(f) unname(c(f$coefficients$mean, f$coefficients$precision))
out <- list()
out$beta_z_na <- run({ f <- betareg(yv ~ x1 + x2 | z1na, data = d); list(coef = cf(f), nobs = f$nobs, n = f$n) })
out$beta_var_w0 <- run({ f <- betareg(yv ~ x1 + x2 | z1, data = d, weights = w0); list(coef = cf(f), nobs = f$nobs, loglik = f$loglik) })
out$beta_new_level <- run({ f <- betareg(yv ~ x1 + g, data = d); predict(f, data.frame(x1 = 0, g = "zz")) })
td <- data.frame(y = pmax(round(0.5 + x1 + rnorm(n), 3), 0), x1, g, w, stringsAsFactors = FALSE)
td$y[td$g == "a"] <- 0; td$w0 <- td$w; td$w0[1] <- 0
assign("td", td, envir = globalenv())
out$tobit_w0 <- run({ f <- tobit(y ~ x1, data = td, weights = w0); coef(f) })
out$tobit_level_all_censored <- run({ f <- tobit(y ~ x1 + g, data = td); list(coef = unname(coef(f)), loglik = f$loglik, iter = f$iter) })
out$data_td <- as.list(td)
t3 <- array(c(32, 11, 10, 3, 53, 50, 25, 15, 10, 10, 7, 7, 3, 30, 5, 8), c(2, 2, 4))
out$loglin_iter0 <- run({ it <- capture.output(r <- loglin(t3, list(c(1, 2), c(1, 3)), iter = 0, fit = TRUE)); list(it = it, lrt = r$lrt, fit1 = r$fit[1]) })
out$loglm_numbers <- run({ f <- loglm(~ 1 * 2 + 3, t3); list(lrt = f$lrt, df = f$df) })
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
