# tsmeta120-po2.R: the p-values of tseries' po.test (1.20.0), second experiment: the critical values read off
# tsmeta120-po's output (log item 17) as the candidate table, checked on fresh data (another seed, n = 80 to 1000,
# both lags, 2..6 variables, demean TRUE / FALSE):
#   p = approx(crit[k, ], c(0.01, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15), stat, rule = 2)$y
# with crit from Phillips and Ouliaris (1990) Table Ib (demean = TRUE) and Ia (demean = FALSE), k = number of
# variables (rows: 2..6), as read off: these are the knots of R's piecewise linear p-value.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))
levels <- c(0.01, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15)
critTrue <- rbind(c(-28.32, -23.81, -20.49, -18.48, -17.04, -15.93, -14.91),
                  c(-34.17, -29.74, -26.09, -23.87, -22.19, -21.04, -19.95),
                  c(-41.13, -35.71, -32.06, -29.51, -27.58, -26.23, -25.05),
                  c(-47.51, -41.64, -37.15, -34.71, -32.74, -31.15, -29.88),
                  c(-52.17, -46.53, -41.94, -39.11, -37.01, -35.48, -34.20))
critFalse <- rbind(c(-22.83, -18.89, -15.64, -13.81, -12.54, -11.57, -10.74),
                   c(-29.27, -25.21, -21.48, -19.61, -18.18, -17.01, -16.02),
                   c(-36.16, -31.54, -27.85, -25.52, -23.92, -22.62, -21.53),
                   c(-42.87, -37.48, -33.48, -30.93, -28.85, -27.40, -26.17),
                   c(-48.52, -42.55, -38.09, -35.51, -33.80, -32.27, -30.90))
set.seed(20261128)
gen <- function(n, k, phi) {
  X <- apply(matrix(rnorm(n * (k - 1)), n, k - 1), 2, cumsum)
  cbind(rowSums(X) + as.numeric(arima.sim(list(ar = phi), n)), X)
}
worst <- 0; count <- 0; inside <- 0; res <- list()
for (k in 2:6) for (dm in c(TRUE, FALSE)) {
  dmax <- 0
  for (i in 1:400) {
    n <- sample(c(80, 150, 300, 1000), 1); lsh <- runif(1) < 0.5
    r <- suppressWarnings(po.test(gen(n, k, runif(1, 0.7, 0.995)), demean = dm, lshort = lsh))
    crit <- if (dm) critTrue[k - 1, ] else critFalse[k - 1, ]
    pc <- approx(crit, levels, unname(r$statistic), rule = 2)$y
    dmax <- max(dmax, abs(r$p.value - pc)); count <- count + 1
    inside <- inside + (r$p.value > 0.01 && r$p.value < 0.15)
  }
  res[[paste0("k", k, "_", dm)]] <- dmax; worst <- max(worst, dmax)
}
out$max_abs_diff <- res; out$worst <- worst; out$count <- count; out$inside <- inside
# the warnings at the ends ("p-value smaller / greater than printed p-value")
w1 <- tryCatch(po.test(gen(300, 2, 0.3)), warning = function(w) conditionMessage(w))
w2 <- tryCatch(po.test(cbind(cumsum(rnorm(300)), cumsum(rnorm(300)))), warning = function(w) conditionMessage(w))
out$warnings <- list(low = if (is.character(w1)) w1 else "none", high = if (is.character(w2)) w2 else "none")
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
