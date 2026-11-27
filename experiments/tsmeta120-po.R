# tsmeta120-po.R: the p-values of tseries' po.test (1.20.0), asked for by the user. The help page: "The p-values are
# interpolated from Table Ia and Ib, page 189 of Phillips and Ouliaris (1990)", and experiment 9 saw 0.01 and 0.15 at
# the ends. The table's values are not at hand, so they are read off the published output: many data sets whose
# statistics spread over the table's range, for each number of variables (2..6) and demean TRUE / FALSE; the pairs
# (statistic, p-value) then show a piecewise linear function whose knots are the critical values (analysed outside
# R, see the log). Also: whether the p-value depends on n or lshort for the same statistic (two n, both lags).
# Data: x2..xk independent random walks, x1 = sum(x2..xk) + u with u AR(1), phi drawn so that the statistics fall
# in and around the table's range.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))
set.seed(20261127)
gen <- function(n, k, phi) {
  X <- apply(matrix(rnorm(n * (k - 1)), n, k - 1), 2, cumsum)
  u <- as.numeric(arima.sim(list(ar = phi), n))
  cbind(rowSums(X) + u, X)
}
for (k in 2:6) for (dm in c(TRUE, FALSE)) {
  st <- numeric(0); pv <- numeric(0)
  for (i in 1:1500) {
    phi <- runif(1, 0.80, 0.995)
    r <- suppressWarnings(po.test(gen(300, k, phi), demean = dm, lshort = TRUE))
    st <- c(st, unname(r$statistic)); pv <- c(pv, r$p.value)
  }
  out[[paste0("k", k, "_", dm)]] <- list(stat = st, p = pv)
}
# the same statistic under other n and lags: the p-value as a function of the statistic alone?
chk <- list()
for (n in c(120, 600)) for (lsh in c(TRUE, FALSE)) {
  st <- numeric(0); pv <- numeric(0)
  for (i in 1:300) {
    r <- suppressWarnings(po.test(gen(n, 2, runif(1, 0.6, 0.99)), demean = TRUE, lshort = lsh))
    st <- c(st, unname(r$statistic)); pv <- c(pv, r$p.value)
  }
  chk[[paste0("n", n, "_", lsh)]] <- list(stat = st, p = pv)
}
out$check_k2_TRUE <- chk
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string"))
