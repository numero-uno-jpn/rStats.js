# tdroc119-survivalroc5.R: survivalROC's NNE (1.19.0): for the subjects with the smallest markers, the neighbours by
# |F_n(M_i) - F_n(M_j)| < span with their times and statuses, to compare R's implied S_i(t) (tdroc119-survivalroc4.R:
# 0.75 for the smallest marker, the candidate 0.667) with the KM of those neighbours by hand. The data of
# tdroc119-survivalroc.R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261128)
n <- 30
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 1)
status <- as.numeric(ttrue <= cens)
pt <- 6; span <- 0.25 * n^(-0.2)
e <- ecdf(marker)(marker)
o <- order(marker)
out$sorted <- data.frame(marker = marker[o], Fn = e[o], T = T[o], status = status[o])
out$span <- span
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, dataframe = "rows"))
