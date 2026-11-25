# regression117-betareg-d2.R (added): after regression117-betareg-sqrt.R, rStats.js's bias (closed forms of the
# Kosmidis-Firth adjustment with the exact second derivative of the inverse link) agreed with R's for logit and probit
# but not for cloglog (3e-4 off, whatever the precision link). R's BC bias for every mean link on the fixture's data,
# to compare with candidates for the second derivative d2mu/deta2 that R may use.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
set.seed(20261125)
n <- 70
x1 <- round(rnorm(n), 4); x2 <- round(runif(n), 4); z1 <- round(rnorm(n), 4); g <- sample(c("a", "b", "c"), n, TRUE)
w <- rpois(n, 1.5) + 1
mu0 <- plogis(-0.3 + 0.6 * x1 - 0.8 * x2 + 0.3 * (g == "c")); ph0 <- exp(2.5 + 0.5 * z1)
yv <- round(rbeta(n, mu0 * ph0, (1 - mu0) * ph0), 6)
yc <- round(rbeta(n, mu0 * 20, (1 - mu0) * 20), 6)
ysm <- round(yc / 3, 6)
d <- data.frame(x1, x2, yc, ysm)
assign("d", d, envir = globalenv())
out <- list()
for (lk in c("logit", "probit", "cloglog", "cauchit", "log", "loglog")) {
  fml <- if (lk == "log") ysm ~ x1 + x2 else yc ~ x1 + x2
  f <- betareg(fml, data = d, link = lk, type = "BC")
  f0 <- betareg(fml, data = d, link = lk, type = "ML")
  out[[lk]] <- list(ml = unname(c(f0$coefficients$mean, f0$coefficients$precision)), bias = unname(f$bias))
}
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
