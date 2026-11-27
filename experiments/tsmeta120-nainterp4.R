# tsmeta120-nainterp4.R: forecast's na.interp for seasonal series, fourth try (1.20.0). tsmeta120-nainterp3 showed the
# seasonal path scale- and shift-equivariant but not additive (a robust fit), a pure seasonal pattern returned
# exactly, and a quadratic trend's missing value returned near the curve (7.2196 against 7.22) rather than at the
# linear interpolation of its neighbours (7.24). New candidate family, written for this experiment: the missing values
# = the fitted trend + seasonal of a robust decomposition at those times, the decomposition fitted to a first filling;
#   first fillings F1: linear interpolation; F2: lm on Fourier terms (K = 1..6) and a polynomial trend (1..3);
#   decompositions: stl(robust = TRUE) with s.window "periodic", 7, 11, 13, and mstl(robust = TRUE);
#   iterations: I1 once; I2 refill with the result and decompose again (twice).
# On the AirPassengers case of experiment 30 and the designed inputs of experiment 52.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
fillLin <- function(v) approx(seq_along(v), v, seq_along(v), rule = 2)$y
fillLm <- function(v, f, K, dg) { tt <- seq_along(v); X <- cbind(1, fourier(ts(v, frequency = f), K = K), poly(tt, dg, raw = TRUE)); ok <- !is.na(v)
  b <- lm.fit(X[ok, , drop = FALSE], v[ok])$coefficients; b[is.na(b)] <- 0; r <- v; r[!ok] <- X[!ok, , drop = FALSE] %*% b; r }
dec <- function(z, f, how) { z <- ts(z, frequency = f)
  d <- switch(how, P = stl(z, "periodic", robust = TRUE), s7 = stl(z, 7, robust = TRUE), s11 = stl(z, 11, robust = TRUE), s13 = stl(z, 13, robust = TRUE), M = NULL)
  if (is.null(d)) { m <- mstl(z, robust = TRUE); return(as.numeric(trendcycle(m) + seasonal(m))) }
  as.numeric(d$time.series[, 1] + d$time.series[, 2]) }
cand <- function(v, f, fill, how, iter) { miss <- which(is.na(v)); z <- fill(v)
  for (i in 1:iter) { fit <- dec(z, f, how); z <- v; z[miss] <- fit[miss] }; z[miss] }
probe <- list()
xs <- as.numeric(AirPassengers); xs[c(5, 30, 31, 32, 77, 140)] <- NA
n <- 48; q <- ((1:n) - 24)^2 / 50; sp <- rep(c(5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -5), 4)
set.seed(41); y1 <- 10 + 0.3 * (1:n) + 3 * sin(2 * pi * (1:n) / 12) + rnorm(n)
inputs <- list(air = xs, quad = replace(q, c(5, 17, 30), NA), both = replace(sp + q, c(5, 17, 30), NA), y1 = replace(y1, c(5, 17, 30), NA))
fills <- list(F1 = fillLin)
for (K in c(1, 2, 3, 6)) for (dg in 1:3) fills[[paste0("F2_K", K, "_d", dg)]] <- local({ KK <- K; dd <- dg; function(v) fillLm(v, 12, KK, dd) })
for (nm in names(inputs)) {
  v <- inputs[[nm]]; R <- as.numeric(na.interp(ts(v, frequency = 12)))[which(is.na(v))]
  res <- c()
  for (fn in names(fills)) for (how in c("P", "s7", "s11", "s13", "M")) for (it in 1:2)
    res[paste(fn, how, it)] <- tryCatch(max(abs(cand(v, 12, fills[[fn]], how, it) - R)), error = function(e) NA)
  probe[[nm]] <- list(R = R, best = head(sort(res), 6))
}
out$probe <- probe
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
