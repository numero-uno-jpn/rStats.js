# tsmeta120-nainterp8.R: forecast's na.interp for seasonal series, eighth try (1.20.0). tsmeta120-nainterp6 found
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
grid <- function(v, f, Ks, dgs) { R <- as.numeric(na.interp(ts(v, frequency = f)))[which(is.na(v))]; res <- c()
  for (K in Ks) for (dg in dgs) res[paste0("K", K, "_d", dg)] <- tryCatch(max(abs(cand(v, f, K, dg) - R)), error = function(e) NA)
  b <- head(sort(res), 3); list(best = unname(b), names = names(b)) }
set.seed(61)
rows <- list()
for (f in c(12, 4, 7, 24)) for (yrs in c(2, 3, 4, 5, 6, 7, 9)) {
  n <- f * yrs; if (n > 240) next
  y <- 10 + 0.3 * (1:n) + 0.002 * (1:n)^2 + 3 * sin(2 * pi * (1:n) / f) + 1.5 * cos(4 * pi * (1:n) / f) + rnorm(n)
  miss <- unique(c(3, floor(n / 2), n - 2))
  g <- grid(replace(y, miss, NA), f, 1:min(12, floor(f / 2)), 0:8)
  rows[[length(rows) + 1]] <- list(f = f, n = n, nmiss = length(miss), best = g$best, names = g$names)
}
out$rows <- rows
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
