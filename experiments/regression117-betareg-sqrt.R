# regression117-betareg-sqrt.R (added): rStats.js's BR fit disagreed with R's only for link = "cloglog" with
# link.phi = "sqrt" (oracle/betareg.R). R's BC and BR coefficients and bias for the four combinations of
# {logit, cloglog} x {log, sqrt} on the fixture's data, to see which link is involved.
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
d <- data.frame(x1, x2, yc)
assign("d", d, envir = globalenv())
out <- list()
for (lk in c("logit", "cloglog")) for (lp in c("log", "sqrt")) for (ty in c("ML", "BC", "BR")) {
  f <- betareg(yc ~ x1 + x2, data = d, link = lk, link.phi = lp, type = ty)
  out[[paste(lk, lp, ty)]] <- list(coef = unname(c(f$coefficients$mean, f$coefficients$precision)), loglik = f$loglik,
                                   bias = if (is.null(f$bias)) NULL else unname(f$bias), scoring = f$scoring)
}
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
