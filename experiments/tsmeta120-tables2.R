# tsmeta120-tables2.R: the p-value table of pp.test type "Z(t_alpha)" (tsmeta120-tables.R recorded pp.test's default, which is "Z(alpha)"); otherwise as tsmeta120-tables.R. The p-value tables of tseries' adf.test and pp.test (1.20.0, log item 94). Designed: series
# whose N = n - 1 is exactly a likely table row (25, 50, 100, 250, 500) or beyond (1000, 5000), with statistics spread
# over the whole range (AR(1) coefficients from 0.3 to 1.02 plus a trend); for each, the statistic and p-value of
# adf.test (stationary and explosive), pp.test type "Z(t_alpha)" and "Z(alpha)". Outside R, p is piecewise linear in
# the statistic for each N; its knots are the table's critical values at that N.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
set.seed(20261206)
q <- function(expr) suppressWarnings(expr)
rows <- list()
for (N in c(25, 50, 100, 250, 500, 1000, 5000)) {
  reps <- if (N >= 1000) 150 else 400
  for (i in 1:reps) {
    phi <- runif(1, 0.3, 1.02); n <- N + 1; e <- rnorm(n); y <- numeric(n); y[1] <- e[1]
    for (t in 2:n) y[t] <- phi * y[t - 1] + e[t]
    y <- y + runif(1, -0.05, 0.05) * (1:n)
    a <- q(adf.test(y)); ax <- q(adf.test(y, alternative = "explosive")); pt_ <- q(pp.test(y, type = "Z(t_alpha)")); pa <- q(pp.test(y, type = "Z(alpha)"))
    rows[[length(rows) + 1]] <- c(N, unname(a$statistic), a$p.value, ax$p.value, unname(pt_$statistic), pt_$p.value, unname(pa$statistic), pa$p.value)
  }
}
cat(toJSON(list(R = R.version.string, cols = c("N", "adf", "adf_p", "adf_px", "ppt", "ppt_p", "ppa", "ppa_p"), rows = rows), digits = I(17), na = "null"))
