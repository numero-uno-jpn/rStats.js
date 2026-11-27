# tsmeta120-nainterp6.R: forecast's na.interp for seasonal series, sixth try (1.20.0). tsmeta120-nainterp3 showed the
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
seasOf <- function(z, f, how, rob) { z <- ts(z, frequency = f)
  if (how == "M") return(as.numeric(seasonal(mstl(z, robust = rob))))
  as.numeric(stl(z, switch(how, P = "periodic", s7 = 7, s11 = 11, s13 = 13), robust = rob)$time.series[, 1]) }
cand <- function(v, f, fill, how, rob) { miss <- which(is.na(v)); s <- seasOf(fill(v), f, how, rob)
  sa <- approx(seq_along(v), v - s, seq_along(v), rule = 2)$y; (sa + s)[miss] }
probe <- list()
xs <- as.numeric(AirPassengers); xs[c(5, 30, 31, 32, 77, 140)] <- NA
n <- 48; q <- ((1:n) - 24)^2 / 50; sp <- rep(c(5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -5), 4)
set.seed(41); y1 <- 10 + 0.3 * (1:n) + 3 * sin(2 * pi * (1:n) / 12) + rnorm(n)
inputs <- list(air = xs, quad = replace(q, c(5, 17, 30), NA), both = replace(sp + q, c(5, 17, 30), NA), y1 = replace(y1, c(5, 17, 30), NA))
fillDum <- function(v, f, dg) { tt <- seq_along(v); X <- cbind(outer(((tt - 1) %% f) + 1, 1:f, "==") * 1, if (dg) poly(tt, dg, raw = TRUE)); ok <- !is.na(v)
  b <- lm.fit(X[ok, , drop = FALSE], v[ok])$coefficients; b[is.na(b)] <- 0; r <- v; r[!ok] <- X[!ok, , drop = FALSE] %*% b; r }
fills <- list()
for (dg in 0:5) fills[[paste0("D_d", dg)]] <- local({ dd <- dg; function(v) fillDum(v, 12, dd) })
for (K in 1:6) for (dg in 1:5) fills[[paste0("F_K", K, "_d", dg)]] <- local({ KK <- K; dd <- dg; function(v) fillLm(v, 12, KK, dd) })
for (nm in names(inputs)) {
  v <- inputs[[nm]]; R <- as.numeric(na.interp(ts(v, frequency = 12)))[which(is.na(v))]
  res <- c()
  for (fn in names(fills)) for (how in c("M")) for (rob in c(TRUE))
    res[paste(fn, how, rob)] <- tryCatch(max(abs(cand(v, 12, fills[[fn]], how, rob) - R)), error = function(e) NA)
  bst <- head(sort(res), 6); probe[[nm]] <- list(R = R, best = unname(bst), best_names = names(bst))
}
out$probe <- probe
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
