# tdroc119-aalen4.R: timereg's aalen (behind timeROC's weighting = "aalen") breaks tied times with random noise, as
# its help says; here the tied data of tdroc119-aalen.R with two seeds, and the AUC's spread over 20 seeds (1.19.0).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261126)
n <- 40
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 0) + 1
delta <- as.numeric(ttrue <= cens)
times <- c(5, 10, 15)
aucs <- t(sapply(1:20, function(s) { set.seed(s); timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "aalen", times = times)$AUC }))
out$auc_range <- apply(aucs, 2, range)
set.seed(1); w1 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "aalen", times = times)$weights$IPCW.times
set.seed(1); w1b <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "aalen", times = times)$weights$IPCW.times
set.seed(2); w2 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "aalen", times = times)$weights$IPCW.times
out$same_seed_diff <- max(abs(w1 - w1b)); out$other_seed_diff <- max(abs(w1 - w2))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
