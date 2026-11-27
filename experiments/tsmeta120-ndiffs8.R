# tsmeta120-ndiffs8.R: urca's ur.pp Z-tau (1.20.0, log item 85, second follow-up). ndiffs7 showed ur.pp's test
# regression and residuals equal to mine (4e-14) but the statistic not of my Phillips-Perron forms. Designed: the
# documented argument use.lag set to 0, 1, 2, 3, 4: with no lags the long-run correction vanishes, so the statistic
# shows the remaining form (t alone or a variance ratio), and each added lag adds one autocovariance term with its weight.
# The same series as ndiffs7 (same seed), both models; the residuals and the regression table recorded again.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(urca))
set.seed(20261203)
ys <- c(list(as.numeric(lh)), lapply(1:20, function(i) { n <- sample(c(30:60, 100:200), 1); cumsum(rnorm(n)) * runif(1, 0, 1) + rnorm(n) + 0.02 * (1:n) }))
rows <- list()
for (y in ys) {
  r <- list(y = y)
  for (model in c("constant", "trend")) {
    u0 <- ur.pp(y, type = "Z-tau", model = model, use.lag = 0); tr <- u0@testreg
    r[[model]] <- list(res = as.numeric(u0@res), coef = unname(tr$coefficients), coef_names = rownames(tr$coefficients), sigma = tr$sigma,
                       stat = sapply(0:4, function(L) unname(ur.pp(y, type = "Z-tau", model = model, use.lag = L)@teststat)),
                       lagslot = sapply(0:4, function(L) unname(ur.pp(y, type = "Z-tau", model = model, use.lag = L)@lag)))
  }
  rows[[length(rows) + 1]] <- r
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
