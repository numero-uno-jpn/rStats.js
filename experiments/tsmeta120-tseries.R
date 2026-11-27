# tsmeta120-tseries.R: tseries' kpss.test, adf.test, pp.test and jarque.bera.test (1.20.0), first experiment.
# Candidates written for this experiment from the help pages and the papers they cite (Kwiatkowski, Phillips, Schmidt
# and Shin 1992; Said and Dickey 1984; Phillips and Perron 1988; Banerjee et al. 1993; Jarque and Bera 1980) and the
# published Dickey-Fuller tables (Fuller 1976, table 8.5.1 / 10.A.1, as reprinted in Banerjee et al. 1993):
#   KPSS: e = residuals of y on 1 (Level) or 1, t (Trend); S_t = cumsum(e); s2 = Newey-West with Bartlett weights
#     1 - s/(l + 1), l = trunc(4 (n/100)^0.25) (lshort) or trunc(12 (n/100)^0.25); stat = sum(S^2) / (n^2 s2);
#     p = linear interpolation in the KPSS Table 1 (Level: 0.347, 0.463, 0.574, 0.739; Trend: 0.119, 0.146, 0.176,
#     0.216 for p = 0.10, 0.05, 0.025, 0.01), clamped to [0.01, 0.10];
#   ADF: diff(y)_t on 1, t, y_{t-1} and k lagged differences (k = trunc((n - 1)^(1/3)) by default); stat = the t
#     value of y_{t-1}; p = interpolation in the tau_tau table, first over n, then over the statistic (candidate);
#   PP: y_t on 1, t - n/2 (candidate C1) or t (C2), y_{t-1}; Z(alpha) = n (rho - 1) - (n^2 se(rho)^2 / s^2)(lambda2 -
#     s_u^2) / 2 with s_u^2 = sum(u^2) / n, lambda2 the Newey-West variance (lag as KPSS's lshort), s^2 the
#     regression variance; Z(t_alpha) as Phillips and Perron; p from the n(rho - 1) table likewise;
#   Jarque-Bera: n (S^2 / 6 + (K - 3)^2 / 24) with moments about the mean divided by n; p = chi-squared(2).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))

nwVar <- function(e, l) {
  n <- length(e); v <- sum(e^2) / n
  if (l > 0) for (s in 1:l) v <- v + 2 * (1 - s / (l + 1)) * sum(e[(s + 1):n] * e[1:(n - s)]) / n
  v
}
kpssCand <- function(y, null, lshort) {
  n <- length(y); tt <- seq_len(n)
  e <- if (null == "Level") y - mean(y) else residuals(lm(y ~ tt))
  l <- if (lshort) trunc(4 * (n / 100)^0.25) else trunc(12 * (n / 100)^0.25)
  stat <- sum(cumsum(e)^2) / (n^2 * nwVar(e, l))
  tab <- if (null == "Level") c(0.347, 0.463, 0.574, 0.739) else c(0.119, 0.146, 0.176, 0.216)
  list(stat = stat, lag = l, p = approx(tab, c(0.10, 0.05, 0.025, 0.01), stat, rule = 2)$y)
}
tauTable <- rbind(c(-4.38, -3.95, -3.60, -3.24, -1.14, -0.80, -0.50, -0.15),
                  c(-4.15, -3.80, -3.50, -3.18, -1.19, -0.87, -0.58, -0.24),
                  c(-4.04, -3.73, -3.45, -3.15, -1.22, -0.90, -0.62, -0.28),
                  c(-3.99, -3.69, -3.43, -3.13, -1.23, -0.92, -0.64, -0.31),
                  c(-3.98, -3.68, -3.42, -3.13, -1.24, -0.93, -0.65, -0.32),
                  c(-3.96, -3.66, -3.41, -3.12, -1.25, -0.94, -0.66, -0.33))
rhoTable <- rbind(c(-22.5, -19.9, -17.9, -15.6, -3.66, -2.51, -1.53, -0.43),
                  c(-25.7, -22.4, -19.8, -16.8, -3.71, -2.60, -1.66, -0.65),
                  c(-27.4, -23.6, -20.7, -17.5, -3.74, -2.62, -1.73, -0.75),
                  c(-28.4, -24.4, -21.3, -18.0, -3.75, -2.64, -1.78, -0.82),
                  c(-28.9, -24.8, -21.5, -18.1, -3.76, -2.65, -1.78, -0.84),
                  c(-29.5, -25.1, -21.8, -18.3, -3.77, -2.66, -1.79, -0.87))
tableN <- c(25, 50, 100, 250, 500, 1e5)
tableP <- c(0.01, 0.025, 0.05, 0.10, 0.90, 0.95, 0.975, 0.99)
tableInterp <- function(tab, n, stat) {
  crit <- apply(tab, 2, function(col) approx(tableN, col, n, rule = 2)$y)
  approx(crit, tableP, stat, rule = 2)$y
}
adfCand <- function(y, k) {
  n <- length(y); dy <- diff(y)
  z <- embed(dy, k + 1)
  yd <- z[, 1]; nn <- length(yd); tt <- (k + 1):(n - 1); ylag <- y[(k + 1):(n - 1)]
  X <- if (k > 0) cbind(1, tt, ylag, z[, -1, drop = FALSE]) else cbind(1, tt, ylag)
  f <- lm.fit(X, yd)
  rss <- sum(f$residuals^2); s2 <- rss / (nn - ncol(X))
  seb <- sqrt(diag(chol2inv(qr.R(f$qr)) * s2))
  stat <- f$coefficients[3] / seb[3]
  list(stat = unname(stat), k = k, p = tableInterp(tauTable, n - 1, stat), p_n = tableInterp(tauTable, n, stat),
       p_nn = tableInterp(tauTable, nn, stat))
}
ppCand <- function(y, lshort, center) {
  n <- length(y); yt <- y[-1]; yl <- y[-n]; nn <- n - 1
  tt <- if (center) (1:nn) - nn / 2 else 1:nn
  f <- lm(yt ~ tt + yl); u <- residuals(f)
  rho <- unname(coef(f)[3]); ser <- unname(sqrt(diag(vcov(f)))[3])
  s2 <- sum(u^2) / (nn - 3); su2 <- sum(u^2) / nn
  l <- if (lshort) trunc(4 * (nn / 100)^0.25) else trunc(12 * (nn / 100)^0.25)
  l2 <- nwVar(u, l)
  za <- nn * (rho - 1) - (nn^2 * ser^2 / s2) * (l2 - su2) / 2
  tr <- (rho - 1) / ser
  zt <- sqrt(su2 / l2) * tr - (l2 - su2) * nn * ser / (2 * sqrt(l2 * s2))
  list(za = za, zt = zt, lag = l, p_za = tableInterp(rhoTable, nn, za), p_zt = tableInterp(tauTable, nn, zt))
}

set.seed(20261126)
series <- list(lh = as.numeric(lh), lakehuron = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30),
               logair = as.numeric(log(AirPassengers)), trend600 = 0.05 * (1:600) + arima.sim(list(ar = 0.5), 600))
for (nm in names(series)) {
  y <- as.numeric(series[[nm]])
  res <- list(n = length(y))
  for (null in c("Level", "Trend")) for (lsh in c(TRUE, FALSE)) {
    r <- suppressWarnings(kpss.test(y, null = null, lshort = lsh))
    cnd <- kpssCand(y, null, lsh)
    res[[paste0("kpss_", null, "_", lsh)]] <- list(stat = unname(r$statistic), lag = unname(r$parameter),
      p = r$p.value, method = r$method, cand = cnd)
  }
  kdef <- trunc((length(y) - 1)^(1 / 3))
  for (k in unique(c(kdef, 0, 2))) {
    r <- suppressWarnings(adf.test(y, k = k))
    res[[paste0("adf_k", k)]] <- list(stat = unname(r$statistic), k = unname(r$parameter), p = r$p.value,
      method = r$method, alternative = r$alternative, cand = adfCand(y, k))
  }
  r <- suppressWarnings(adf.test(y, alternative = "explosive"))
  res$adf_explosive <- list(stat = unname(r$statistic), p = r$p.value)
  for (ty in c("Z(alpha)", "Z(t_alpha)")) for (lsh in c(TRUE, FALSE)) {
    r <- suppressWarnings(pp.test(y, type = ty, lshort = lsh))
    res[[paste0("pp_", ty, "_", lsh)]] <- list(stat = unname(r$statistic), lag = unname(r$parameter), p = r$p.value,
      method = r$method, candC = ppCand(y, lsh, TRUE), candT = ppCand(y, lsh, FALSE))
  }
  r <- jarque.bera.test(y)
  m <- mean(y); m2 <- mean((y - m)^2); S <- mean((y - m)^3) / m2^1.5; K <- mean((y - m)^4) / m2^2
  jb <- length(y) * (S^2 / 6 + (K - 3)^2 / 24)
  res$jb <- list(stat = unname(r$statistic), df = unname(r$parameter), p = r$p.value, cand = jb,
                 cand_p = pchisq(jb, 2, lower.tail = FALSE))
  out[[nm]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
