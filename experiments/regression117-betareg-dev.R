# regression117-betareg-dev.R (after regression117-betareg-resid2.R): betareg's deviance residuals (1.17.0). The
# saturated-mean candidate sign(y - mu) sqrt(2 max(l(y | y) - l(y | mu), 0)) was 0.10 off and maximising over the
# mean worse. Here the values side by side with more candidates: abs() instead of max(., 0), the precision of the
# saturated term set to the fitted phi or to other values, and the difference l(y | y) - l(y | mu) itself.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
out <- list(R = R.version.string, arch = R.version$arch, betareg = as.character(packageVersion("betareg")))
set.seed(20261129)
n <- 50
x1 <- rnorm(n); z1 <- rnorm(n); w <- rpois(n, 1.5) + 1
mu0 <- plogis(0.2 + 0.7 * x1); ph0 <- exp(2 + 0.6 * z1)
yv <- rbeta(n, mu0 * ph0, (1 - mu0) * ph0)
yc <- rbeta(n, mu0 * 15, (1 - mu0) * 15)
d <- data.frame(x1, z1, w, yv, yc)
assign("d", d, envir = globalenv())
f <- betareg(yc ~ x1, data = d)
mu <- predict(f, type = "response"); ph <- predict(f, type = "precision"); y <- yc
l <- function(m) dbeta(y, m * ph, (1 - m) * ph, log = TRUE)
dl <- l(y) - l(mu)
rd <- as.numeric(residuals(f, type = "deviance"))
out$table <- cbind(R = rd, R2_half = rd^2 / 2, diff = dl, y = y, mu = mu)[1:12, ]
out$abs_cand <- max(abs(rd - sign(y - mu) * sqrt(2 * abs(dl))))
out$negative_diff <- sum(dl < 0)
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
