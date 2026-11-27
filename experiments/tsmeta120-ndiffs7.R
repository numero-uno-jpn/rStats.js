# tsmeta120-ndiffs7.R: urca's ur.pp(type = "Z-tau", lags = "short") (1.20.0, log item 85, follow-up). ndiffs6
# showed ndiffs(test = "pp") = ur.pp's statistic interpolated in ur.pp's critical values (= MacKinnon 1991 at N = n - 1),
# but my Phillips-Perron statistic is 0.025 (constant) and 0.05 (trend) off ur.pp's. Recorded, to locate the step that
# differs: ur.pp's documented slots @testreg (the test regression's coefficient table and sigma), @res (residuals),
# @auxstat, @lag and @teststat, for model "constant" and "trend", on 20 of ndiffs6's kind of series and lh.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(urca))
set.seed(20261203)
rows <- list()
ys <- c(list(as.numeric(lh)), lapply(1:20, function(i) { n <- sample(c(30:60, 100:200), 1); cumsum(rnorm(n)) * runif(1, 0, 1) + rnorm(n) + 0.02 * (1:n) }))
for (y in ys) {
  r <- list(y = y)
  for (model in c("constant", "trend")) {
    u <- ur.pp(y, type = "Z-tau", model = model, lags = "short")
    tr <- u@testreg
    r[[model]] <- list(stat = unname(u@teststat), lag = unname(u@lag), res = as.numeric(u@res),
                       coef = unname(tr$coefficients), coef_names = rownames(tr$coefficients), sigma = tr$sigma, df = unname(tr$df),
                       auxstat = unname(as.numeric(u@auxstat)), auxstat_names = colnames(u@auxstat))
  }
  rows[[length(rows) + 1]] <- r
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
