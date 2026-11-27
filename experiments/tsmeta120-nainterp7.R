# tsmeta120-nainterp7.R: forecast's na.interp for seasonal series, seventh try (1.20.0). tsmeta120-nainterp6 found
# the first filling = lm on Fourier terms K = 5 and a polynomial trend of degree 4, then the seasonal of
# mstl(robust = TRUE), linear interpolation of the seasonally adjusted series, the seasonal added back: exact (1e-15)
# for three designed inputs of n = 48, but AirPassengers (n = 144) still 1.8 off. Here AirPassengers with: the grid
# K = 1..6 x degree 0..10; the same missing positions one at a time; and series of the designed shapes at n = 144,
# 96, 72 to see whether K or the degree depend on n.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
fillLm <- function(v, f, K, dg) { tt <- seq_along(v)
  X <- cbind(1, fourier(ts(v, frequency = f), K = K), if (dg) poly(tt, dg, raw = TRUE)); ok <- !is.na(v)
  b <- lm.fit(X[ok, , drop = FALSE], v[ok])$coefficients; b[is.na(b)] <- 0; r <- v; r[!ok] <- X[!ok, , drop = FALSE] %*% b; r }
cand <- function(v, f, K, dg) { miss <- which(is.na(v)); s <- as.numeric(seasonal(mstl(ts(fillLm(v, f, K, dg), frequency = f), robust = TRUE)))
  sa <- approx(seq_along(v), v - s, seq_along(v), rule = 2)$y; (sa + s)[miss] }
grid <- function(v, Ks = 1:6, dgs = 0:10) { R <- as.numeric(na.interp(ts(v, frequency = 12)))[which(is.na(v))]; res <- c()
  for (K in Ks) for (dg in dgs) res[paste0("K", K, "_d", dg)] <- tryCatch(max(abs(cand(v, 12, K, dg) - R)), error = function(e) NA)
  b <- head(sort(res), 4); list(best = unname(b), names = names(b), K5d4 = unname(res["K5_d4"])) }
xs <- as.numeric(AirPassengers)
out$air_all <- grid(replace(xs, c(5, 30, 31, 32, 77, 140), NA))
for (p in c(5, 30, 77, 140)) out[[paste0("air_one_", p)]] <- grid(replace(xs, p, NA), Ks = 5, dgs = 0:10)
set.seed(51)
for (n in c(72, 96, 144)) {
  y <- 10 + 0.3 * (1:n) + 0.002 * (1:n)^2 + 3 * sin(2 * pi * (1:n) / 12) + rnorm(n)
  out[[paste0("sim_", n)]] <- grid(replace(y, c(5, 30, n - 10), NA), Ks = c(4, 5, 6), dgs = 2:8)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
