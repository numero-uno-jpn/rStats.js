# tsmeta120-outliers3.R: forecast's tsoutliers, third try (1.20.0, asked for by the user after experiments 49-50 left
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
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
flag <- function(r) { q <- quantile(r, c(0.25, 0.75), na.rm = TRUE); iq <- q[2] - q[1]; which(r < q[1] - 3 * iq | r > q[2] + 3 * iq) }
mk <- function(base, idx, add) { v <- as.numeric(base); v[idx] <- v[idx] + add; ts(v, start = start(base), frequency = frequency(base)) }
cases <- list(air = mk(AirPassengers, c(30, 100), c(250, -200)), air0 = AirPassengers, usacc = mk(USAccDeaths, c(10, 40), c(4000, -3000)),
              co2 = mk(co2, c(50, 300), c(5, -6)), uk = mk(UKgas, c(20, 70), c(300, -250)))
for (nm in names(cases)) {
  x <- cases[[nm]]; xx <- as.numeric(x); n <- length(xx); tt <- 1:n
  d1 <- mstl(x, robust = TRUE); sa1 <- as.numeric(seasadj(d1))
  d2 <- mstl(x); sa2 <- as.numeric(seasadj(d2))
  d3 <- stl(x, "periodic", robust = TRUE); sa3 <- xx - as.numeric(d3$time.series[, 1])
  rem <- list(R1 = as.numeric(remainder(d1)), R2 = sa1 - supsmu(tt, sa1)$y, R3 = sa2 - supsmu(tt, sa2)$y, R4 = sa3 - supsmu(tt, sa3)$y)
  r1 <- tsoutliers(x, iterate = 1); r2 <- tsoutliers(x)
  cand <- lapply(rem, flag)
  rep2 <- if (length(cand$R2)) { v <- xx; v[cand$R2] <- NA; as.numeric(na.interp(ts(v, start = start(x), frequency = frequency(x))))[cand$R2] } else numeric(0)
  out[[nm]] <- list(R_it1 = r1$index, R_it1_repl = r1$replacements, R_it2 = r2$index, cand = cand, cand_R2_repl = rep2)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
