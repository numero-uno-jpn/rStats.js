# qccbt118-extreme.R: qcc and BradleyTerry2 at extreme scales (1.18.0, the third edge-case pass): whether R's results
# stay proportional when the data are multiplied by 1e150 / 1e-150 / 1e300 / 1e-300, for the functions where the
# rStats.js probe found overflow or underflow (process.capability, mqcc, qcc.overdispersion.test, the g chart) and
# cusum / ewma; BTm with counts times 1e6. Ratios to the unscaled results are printed (1 = proportional).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(qcc); library(BradleyTerry2) })
out <- list(R = R.version.string, arch = R.version$arch)
pdf(NULL)
set.seed(20261126)
m <- matrix(round(rnorm(20 * 5, 10, 2), 4), 20, 5)
x <- round(rnorm(12, 5, 1), 4)
try1 <- function(expr) tryCatch(expr, error = function(e) conditionMessage(e))
cap <- function(s) { q <- qcc(m * s, type = "xbar", plot = FALSE)
  pc <- process.capability(q, spec.limits = c(4, 16) * s, target = 10.2 * s, print = FALSE); as.vector(pc$indices) }
c0 <- cap(1)
out$capability <- lapply(c(1e150, 1e-150, 1e200, 1e300, 1e-300), function(s) try1(cap(s) / c0))
X <- matrix(round(rnorm(30 * 3, c(10, 25, 30), c(1, 2, 3)), 4), 30, 3, byrow = TRUE)
t0 <- mqcc(X, type = "T2.single", plot = FALSE)$statistics
out$mqcc <- lapply(c(1e150, 1e-150, 1e300, 1e-300), function(s) try1(range(mqcc(X * s, type = "T2.single", plot = FALSE)$statistics / t0)))
out$mqcc_mixed <- try1(range(mqcc(cbind(X[, 1] * 1e200, X[, 2], X[, 3] * 1e-200), type = "T2.single", plot = FALSE)$statistics / t0))
xb <- c(12, 11, 18, 11, 10, 16, 9, 11, 14, 15, 11, 9, 10, 13, 12, 8, 12, 13, 10, 12)
o0 <- qcc.overdispersion.test(xb)[1, 1]
out$overdispersion <- lapply(c(1e200, 1e-200), function(s) try1(qcc.overdispersion.test(xb * s)[1, 1] / o0 / s))
gg <- c(3, 15, 2, 8, 40, 7)
g0 <- suppressWarnings(qcc(gg, type = "g", plot = FALSE))
out$g <- lapply(c(1e150, 1e300), function(s) try1({ q <- suppressWarnings(qcc(gg * s, type = "g", plot = FALSE)); c(q$std.dev / g0$std.dev / s, q$limits[1, 2] / g0$limits[1, 2] / s) }))
cs0 <- cusum(x, plot = FALSE); ew0 <- ewma(x, plot = FALSE)
out$cusum_ewma <- lapply(c(1e150, 1e-300), function(s) try1({ cs <- cusum(x * s, plot = FALSE); ew <- ewma(x * s, plot = FALSE)
  c(max(abs(cs$pos - cs0$pos)), max(abs(ew$y / s / ew0$y - 1)), max(abs(ew$limits / s / ew0$limits - 1))) }))
d <- data.frame(p1 = factor(c("A", "A", "A", "B", "B", "C"), levels = c("A", "B", "C", "D")),
                p2 = factor(c("B", "C", "D", "C", "D", "D"), levels = c("A", "B", "C", "D")),
                w1 = c(7, 6, 9, 4, 6, 5), w2 = c(3, 5, 2, 6, 4, 5))
b0 <- coef(BTm(cbind(w1, w2), p1, p2, data = d))
d6 <- d; d6$w1 <- d$w1 * 1e6; d6$w2 <- d$w2 * 1e6
out$btm_counts_1e6 <- try1(coef(BTm(cbind(w1, w2), p1, p2, data = d6)) / b0)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
