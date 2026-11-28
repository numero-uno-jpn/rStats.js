# plot121-weights.R: density's weights when na.rm drops values, and the tiny-scale bandwidth (1.21.0, experiment 3).
# Candidates for the weights left after removing the NA positions: (a) used as they are, (b) rescaled to sum 1,
# (c) rescaled to their total before the removal. Totals 1 and 2, equal and unequal weights, so that (a), (b) and (c)
# differ. Also sd, IQR and bw.nrd0 of a sample at 1e-300 against the same at scale 1, and lowess at 1e300 / 1e15
# against scale 1 (does R's smooth keep its shape?).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
x <- c(3.1, NA, 5.5, 1.2, 9.0)
cases <- list(eq1 = rep(0.2, 5), eq2 = rep(0.4, 5), uneq1 = c(0.1, 0.3, 0.2, 0.15, 0.25), uneq2 = c(0.2, 0.6, 0.4, 0.3, 0.5))
xk <- x[!is.na(x)]
res <- list()
for (nm in names(cases)) {
  w <- cases[[nm]]
  warns <- character()
  d <- withCallingHandlers(density(x, weights = w, na.rm = TRUE, bw = 1),
                           warning = function(e) { warns <<- c(warns, conditionMessage(e)); invokeRestart("muffleWarning") })
  wk <- w[!is.na(x)]
  cA <- density(xk, weights = wk, bw = 1, from = min(d$x), to = max(d$x))
  cB <- density(xk, weights = wk / sum(wk), bw = 1, from = min(d$x), to = max(d$x))
  cC <- suppressWarnings(density(xk, weights = wk * sum(w) / sum(wk), bw = 1, from = min(d$x), to = max(d$x)))
  res[[nm]] <- list(warnings = warns, a = max(abs(d$y - cA$y)), b = max(abs(d$y - cB$y)), c = max(abs(d$y - cC$y)),
                    peak = max(d$y))
}
out$weights <- res
s <- c(3.1, 1.2, 5.5, 1.2, 9.0)
out$tiny <- list(sd1 = sd(s), sdTiny = sd(s * 1e-300) / 1e-300, iqr1 = IQR(s), iqrTiny = IQR(s * 1e-300) / 1e-300,
                 bw1 = bw.nrd0(s), bwTiny = bw.nrd0(s * 1e-300) / 1e-300, varTiny = var(s * 1e-300))
xx <- 1:10; yy <- c(2, 4, 3, 6, 5, 8, 7, 10, 9, 12)
out$lowess <- list(unit = lowess(xx, yy)$y, big = lowess(xx * 1e300, yy * 1e300)$y / 1e300,
                   big150 = lowess(xx * 1e150, yy * 1e150)$y / 1e150,
                   common = lowess(1e15 + xx, 1e15 + yy)$y - 1e15, common8 = lowess(1e8 + xx, 1e8 + yy)$y - 1e8)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = TRUE))
