# tsmeta120-outliers2.R: forecast's tsoutliers, second experiment (1.20.0): the iterations. tsmeta120-outliers found
# R's outliers for AirPassengers (12) a subset of the first-pass candidate (remainder of mstl(x, robust = TRUE) outside
# [Q1 - 3 IQR, Q3 + 3 IQR]: 17). Variants of the second pass, written for this experiment (replacements by R's own
# na.interp of the series with the flagged points set to NA):
#   P1: pass 2 = the same rule on the remainder of mstl(cleaned, robust = TRUE); final = pass 2's set;
#   P2: pass 2's fit (trend + seasonal of the cleaned series) subtracted from the ORIGINAL series, the rule on that;
#   P3: like P2 with the quartiles taken from the cleaned series' remainder;
#   P4: the union / P5: the intersection of the passes;
#   also iterate = 1 against the first pass alone.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
lim <- function(r) { q <- quantile(r, c(0.25, 0.75), na.rm = TRUE); iq <- q[2] - q[1]; c(q[1] - 3 * iq, q[2] + 3 * iq) }
flag <- function(r, L = lim(r)) which(r < L[1] | r > L[2])
mk <- function(base, idx, add) { v <- as.numeric(base); v[idx] <- v[idx] + add; ts(v, start = start(base), frequency = frequency(base)) }
cases <- list(air = mk(AirPassengers, c(30, 100), c(250, -200)), air0 = AirPassengers, usacc = mk(USAccDeaths, c(10, 40), c(4000, -3000)),
              co2 = mk(co2, c(50, 300), c(5, -6)), nottem = mk(nottem, c(77, 150), c(15, -20)))
for (nm in names(cases)) {
  x <- cases[[nm]]; xx <- as.numeric(x)
  fitp <- function(z) { d <- mstl(z, robust = TRUE); list(rem = as.numeric(remainder(d)), fit = as.numeric(trendcycle(d) + seasonal(d))) }
  p1 <- fitp(x); o1 <- flag(p1$rem)
  cl <- xx; cl[o1] <- NA; cl <- as.numeric(na.interp(ts(cl, start = start(x), frequency = frequency(x))))
  p2 <- fitp(ts(cl, start = start(x), frequency = frequency(x)))
  v <- list(first = o1, P1 = flag(p2$rem), P2 = flag(xx - p2$fit), P3 = flag(xx - p2$fit, lim(p2$rem)))
  v$P4 <- sort(union(o1, v$P2)); v$P5 <- intersect(o1, v$P2)
  r2 <- tsoutliers(x); r1 <- tsoutliers(x, iterate = 1)
  out[[nm]] <- list(R2 = r2$index, R1 = r1$index, variants = v, R2_repl = r2$replacements)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
