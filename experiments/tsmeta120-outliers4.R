# tsmeta120-outliers4.R: forecast's tsoutliers, fourth try (1.20.0, asked for by the user after experiments 49-50 left
# it open). Remainder candidates for a seasonal series, written for this experiment (the rule [Q1 - 3 IQR, Q3 +
# 3 IQR] as found for Nile and USAccDeaths):
#   R1: remainder of mstl(x, robust = TRUE) (the earlier D1);
#   R2: seasadj of mstl(x, robust = TRUE) minus supsmu(1:n, seasadj)$y (the non-seasonal method applied after
#       removing the seasonal);
#   R3: like R2 with mstl non-robust; R4: like R2 with stl(x, "periodic", robust = TRUE);
#   R5: x - seasonal(mstl robust) - trend of stl robust ... (R1 with the trend replaced by supsmu: same as R2);
#   for iterate = 1 (one pass) on AirPassengers with and without planted outliers, and the replacements of the
#   flagged points by na.interp (now known, log item 57).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
# tsmeta120-outliers3 found the first pass: remainder = seasadj(mstl(x, robust = TRUE)) - supsmu(1:n, seasadj)$y,
# flagged outside [Q1 - 3 IQR, Q3 + 3 IQR], replaced by na.interp (exact for five series with iterate = 1). Here the
# second pass (iterate = 2), candidates written for this experiment, with x2 = x with the first pass's replacements:
#   V1: the same remainder computed from x2; final = its flags;
#   V2: the fit (seasonal of mstl(x2, robust) + supsmu of x2's seasadj) subtracted from the ORIGINAL x, the rule on
#       that residual; final = its flags;
#   V3: union of the first pass and V1; V4: union of the first pass and V2;
#   V5: like V2 but the quartiles of x2's own remainder;
#   the replacements of the final set by na.interp of x with all final points removed.
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
flag <- function(r) { q <- quantile(r, c(0.25, 0.75), na.rm = TRUE); iq <- q[2] - q[1]; which(r < q[1] - 3 * iq | r > q[2] + 3 * iq) }
mk <- function(base, idx, add) { v <- as.numeric(base); v[idx] <- v[idx] + add; ts(v, start = start(base), frequency = frequency(base)) }
cases <- list(air = mk(AirPassengers, c(30, 100), c(250, -200)), air0 = AirPassengers, usacc = mk(USAccDeaths, c(10, 40), c(4000, -3000)),
              co2 = mk(co2, c(50, 300), c(5, -6)), uk = mk(UKgas, c(20, 70), c(300, -250)))
pass <- function(z, st, fr) { zz <- as.numeric(z); d <- mstl(ts(zz, start = st, frequency = fr), robust = TRUE); sa <- as.numeric(seasadj(d))
  tr <- supsmu(seq_along(zz), sa)$y; list(rem = sa - tr, fit = as.numeric(seasonal(d)) + tr) }
lims <- function(r) { q <- quantile(r, c(0.25, 0.75), na.rm = TRUE); iq <- q[2] - q[1]; c(q[1] - 3 * iq, q[2] + 3 * iq) }
flagL <- function(r, L) which(r < L[1] | r > L[2])
for (nm in names(cases)) {
  x <- cases[[nm]]; xx <- as.numeric(x); st <- start(x); fr <- frequency(x)
  p1 <- pass(x, st, fr); o1 <- flag(p1$rem)
  x2 <- xx; if (length(o1)) { x2[o1] <- NA; x2 <- as.numeric(na.interp(ts(x2, start = st, frequency = fr))) }
  p2 <- pass(x2, st, fr)
  V <- list(V1 = flag(p2$rem), V2 = flag(xx - p2$fit), V5 = flagL(xx - p2$fit, lims(p2$rem)))
  V$V3 <- sort(union(o1, V$V1)); V$V4 <- sort(union(o1, V$V2))
  r2 <- tsoutliers(x)
  repl <- function(idx) { if (!length(idx)) return(numeric(0)); v <- xx; v[idx] <- NA; as.numeric(na.interp(ts(v, start = st, frequency = fr)))[idx] }
  out[[nm]] <- list(R = r2$index, R_repl = r2$replacements, V = V, repl_V2 = repl(V$V2), repl_V4 = repl(V$V4))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
