# tdroc119-survivalroc9.R: survivalROC's KM with given cut.values (1.19.0), after the fixture: at the last given cut
# (1.5, two subjects above it) R's TP and FP were both 0. Candidates: the last cut is forced to (0, 0); or the subset
# above the cut is empty for another reason. Cuts in other orders, with the last one below the maximum, and the
# subsets' sizes. The data of oracle/timeroc.R's "smooth" set (regenerated here with the same seed and code).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261202)
n <- 45
marker <- round(rnorm(n), 6)
other <- round(marker + rnorm(n), 6)
t1 <- rexp(n, exp(0.8 * marker) / 10); cc <- rexp(n, 1 / 15)
T <- round(pmin(t1, cc), 6) + 0.5
status <- as.numeric(t1 <= cc)
sr <- function(cuts) { r <- survivalROC(Stime = T, status = status, marker = marker, predict.time = 6.3, method = "KM", cut.values = cuts); lapply(r, unname) }
out$above <- sapply(c(-1, 0, 0.5, 1.5, 1.0), function(c) sum(marker > c))
out$a <- sr(c(-1, 0, 0.5, 1.5))
out$b <- sr(c(-1, 0, 1.5, 0.5))
out$c <- sr(c(-1, 1.5))
out$d <- sr(c(1.5, -1, 0))
out$e <- sr(c(-1, 0, 1.0))
out$f <- sr(c(-1, 0, 0.5, 1.5, 3))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
