# tsmeta120-outliers5.R: forecast's tsoutliers and tsclean, fifth try (1.20.0, asked for by the user after experiments 49-50 left
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
# tsmeta120-outliers4 found the final set of iterate = 2 = the union of the first pass and the same pass applied to
# the series with the first pass's points replaced (V3). Checked here: the replacements of that set (na.interp of x
# with all of them removed), iterate = 3 (the union over three passes, each on the series cleaned by the previous
# union), a non-seasonal series (remainder = x - supsmu(1:n, x)) with iterate 1-3, and tsclean (the replacements put
# in; with missing values in x also interpolated by na.interp).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
flag <- function(r) { q <- quantile(r, c(0.25, 0.75), na.rm = TRUE); iq <- q[2] - q[1]; which(r < q[1] - 3 * iq | r > q[2] + 3 * iq) }
mk <- function(base, idx, add) { v <- as.numeric(base); v[idx] <- v[idx] + add; ts(v, start = start(base), frequency = frequency(base)) }
cases <- list(air = mk(AirPassengers, c(30, 100), c(250, -200)), air0 = AirPassengers, usacc = mk(USAccDeaths, c(10, 40), c(4000, -3000)),
              co2 = mk(co2, c(50, 300), c(5, -6)), uk = mk(UKgas, c(20, 70), c(300, -250)))
pass <- function(z, st, fr) { zz <- as.numeric(z); n <- length(zz)
  if (fr > 1) { d <- mstl(ts(zz, start = st, frequency = fr), robust = TRUE); sa <- as.numeric(seasadj(d)) } else sa <- zz
  ok <- !is.na(sa); r <- rep(NA, n); r[ok] <- sa[ok] - supsmu(which(ok), sa[ok])$y; r }
cand <- function(x, iterate) { xx <- as.numeric(x); st <- start(x); fr <- frequency(x); idx <- integer(0); cur <- xx
  for (i in 1:iterate) { new <- flag(pass(cur, st, fr)); idx <- sort(union(idx, new))
    if (!length(idx)) break; cur <- xx; cur[idx] <- NA; cur <- as.numeric(na.interp(ts(cur, start = st, frequency = fr))) }
  list(index = idx, repl = if (length(idx)) cur[idx] else numeric(0)) }
cases$nile <- mk(Nile, c(20, 60, 61), c(900, -700, 650)); cases$lynx <- lynx
for (nm in names(cases)) {
  x <- cases[[nm]]; res <- list()
  for (it in 1:3) { r <- tsoutliers(x, iterate = it); cc <- cand(x, it)
    res[[paste0("it", it)]] <- list(R = r$index, c = cc$index, same = identical(as.integer(r$index), as.integer(cc$index)),
      repl = if (length(r$index) == length(cc$index)) max(abs(r$replacements - cc$repl), 0) else NA) }
  cl <- tsclean(x); cc2 <- cand(x, 2); xx <- as.numeric(x); xx[cc2$index] <- cc2$repl
  res$tsclean <- max(abs(as.numeric(cl) - xx))
  out[[nm]] <- res
}
xm <- as.numeric(AirPassengers); xm[c(12, 60)] <- NA; xm[30] <- xm[30] + 250; xmt <- ts(xm, start = 1949, frequency = 12)
clm <- tsclean(xmt); ccm <- cand(ts(as.numeric(na.interp(xmt)), start = 1949, frequency = 12), 2)
out$tsclean_missing <- list(R = as.numeric(clm)[c(12, 30, 60)], index_cand_after_fill = ccm$index)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
