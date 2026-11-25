# regression117-betareg-d2b.R (added): to read off the second derivative d2mu/deta2 that R's bias correction uses for
# cloglog and loglog. In an intercept-only model with constant phi every observation has the same eta, so the bias
# is linear in the single value d2(eta0): rStats.js solves for it from R's bias (outside R) and compares it with
# candidate formulas. Data sets with different mean levels give different eta0.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
set.seed(20261202)
out <- list(sets = list())
for (m in c(0.1, 0.25, 0.5, 0.75, 0.9)) {
  y <- round(rbeta(60, m * 15, (1 - m) * 15), 6)
  d <- data.frame(y = y)
  assign("d", d, envir = globalenv())
  res <- list(y = y)
  for (lk in c("cloglog", "loglog", "logit")) {
    f0 <- betareg(y ~ 1, data = d, link = lk); f <- betareg(y ~ 1, data = d, link = lk, type = "BC")
    res[[lk]] <- list(ml = unname(c(f0$coefficients$mean, f0$coefficients$precision)), bias = unname(f$bias))
  }
  out$sets[[length(out$sets) + 1]] <- res
}
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
