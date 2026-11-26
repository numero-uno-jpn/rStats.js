# tdroc119-plotvalues.R: what plotAUCcurve and plotAUCcurveDiff return (1.19.0): their values (the help has no Value
# section), drawn to a null device. The data and markers of tdroc119-confint.R.
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
marker2 <- round(marker + rnorm(n, 0, 1), 1)
times <- c(5, 10, 15)
r1 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, times = times, iid = TRUE)
r2 <- timeROC(T = T, delta = delta, marker = marker2, cause = 1, times = times, iid = TRUE)
pdf(NULL)
set.seed(1); v1 <- plotAUCcurve(r1, conf.int = TRUE, conf.band = TRUE)
set.seed(1); v2 <- plotAUCcurveDiff(r1, r2, conf.int = TRUE, conf.band = TRUE)
out$plotAUCcurve <- list(class = class(v1), value = if (is.null(v1)) NULL else lapply(v1, unname))
out$plotAUCcurveDiff <- list(class = class(v2), value = if (is.null(v2)) NULL else lapply(v2, unname))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
