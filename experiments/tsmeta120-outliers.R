# tsmeta120-outliers.R: stats' supsmu (the half-width rounding, ties) and forecast's tsoutliers / tsclean (1.20.0).
# Candidates written for this experiment:
#   supsmu: the candidate of tsmeta120-supsmu (K1 / E2) against K3 (ceiling) on lengths where s n / 2 has a fraction
#     below 0.5 (n = 130, 70, 90); tied x values: R returns unique x; candidate T1: y averaged over ties before
#     smoothing with the tie count as weight (here: plain mean, equal weights per unique x) — recorded;
#   tsoutliers (Hyndman and Athanasopoulos, "Forecasting: principles and practice", section on outliers): the
#     remainder of a decomposition — mstl(x, robust = TRUE) for seasonal series (candidate D1) or stl robust (D2), and
#     x - supsmu(1:n, x) for non-seasonal ones; outliers where the remainder is outside [Q1 - 3 IQR, Q3 + 3 IQR]
#     (quantile type 7); replacements: na.interp of the series with the outliers removed; `iterate` repeats with the
#     cleaned series;
#   tsclean: tsoutliers' replacements put in, missing values interpolated by na.interp.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
runLine <- function(x, y, s, kv) {
  n <- length(x); k <- if (kv == "K1") max(2, floor(s * n / 2 + 0.5)) else max(2, ceiling(s * n / 2)); k <- min(k, floor((n - 1) / 2))
  fit <- res <- numeric(n)
  for (i in 1:n) {
    lo <- max(1, min(i - k, n - 2 * k)); j <- lo:(lo + 2 * k); xm <- mean(x[j]); ym <- mean(y[j]); sxx <- sum((x[j] - xm)^2)
    ok <- sxx > (1e-3 * (x[n] - x[1]))^2; b <- if (ok) sum((x[j] - xm) * (y[j] - ym)) / sxx else 0
    fit[i] <- ym + b * (x[i] - xm); res[i] <- abs(y[i] - fit[i]) / (1 - 1 / length(j) - (if (ok) (x[i] - xm)^2 / sxx else 0))
  }
  list(fit = fit, res = res)
}
supsmuC <- function(x, y, kv) {
  o <- order(x); x <- x[o]; y <- y[o]; sp <- c(0.05, 0.2, 0.5)
  fits <- lapply(sp, function(s) runLine(x, y, s, kv)); rs <- sapply(fits, function(f) runLine(x, f$res, 0.2, kv)$fit)
  best <- sp[apply(rs, 1, which.min)]; bs <- pmin(0.5, pmax(0.05, runLine(x, best, 0.2, kv)$fit))
  mix <- ifelse(bs >= 0.2, (1 - (bs - 0.2) / 0.3) * fits[[2]]$fit + (bs - 0.2) / 0.3 * fits[[3]]$fit,
                (1 - (0.2 - bs) / 0.15) * fits[[2]]$fit + (0.2 - bs) / 0.15 * fits[[1]]$fit)
  runLine(x, mix, 0.05, kv)$fit
}
set.seed(31)
sk <- list()
for (n in c(130, 70, 90, 110)) { x <- sort(runif(n, 0, 5)); y <- cos(x) + rnorm(n, sd = 0.2); r <- supsmu(x, y)$y
  sk[[as.character(n)]] <- c(K1 = max(abs(r - supsmuC(x, y, "K1"))), K3 = max(abs(r - supsmuC(x, y, "K3")))) }
xt <- rep(1:40, each = 2); yt <- sin(xt / 5) + rnorm(80, sd = 0.1); rt <- supsmu(xt, yt)
ux <- unique(xt); ym <- tapply(yt, xt, mean)
sk$ties <- list(n_out = length(rt$x), d_T1 = max(abs(rt$y - supsmuC(ux, as.numeric(ym), "K1"))))
out$supsmu <- sk

iqrOut <- function(r) { q <- quantile(r, c(0.25, 0.75), na.rm = TRUE); iq <- q[2] - q[1]; which(r < q[1] - 3 * iq | r > q[2] + 3 * iq) }
ol <- list()
mk <- function(base, idx, add) { v <- as.numeric(base); v[idx] <- v[idx] + add; ts(v, start = start(base), frequency = frequency(base)) }
cases <- list(nile = mk(Nile, c(20, 60), c(900, -700)), usacc = mk(USAccDeaths, c(10, 40), c(4000, -3000)),
              air = mk(AirPassengers, c(30, 100), c(250, -200)), lynx = lynx)
for (nm in names(cases)) {
  x <- cases[[nm]]; r <- tsoutliers(x); f <- frequency(x); xx <- as.numeric(x); n <- length(xx)
  rem <- if (f > 1) list(D1 = as.numeric(remainder(mstl(x, robust = TRUE))), D2 = as.numeric(stl(x, "periodic", robust = TRUE)$time.series[, 3]),
                         D3 = as.numeric(remainder(mstl(x))))
         else list(S = xx - supsmu(1:n, xx)$y)
  cand <- lapply(rem, iqrOut)
  cl <- tsclean(x)
  ol[[nm]] <- list(index = r$index, replacements = r$replacements, cand_index = cand,
                   clean_at_index = as.numeric(cl)[r$index], clean_other = max(abs(as.numeric(cl)[-r$index] - xx[-r$index]), 0))
}
out$tsoutliers <- ol
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
