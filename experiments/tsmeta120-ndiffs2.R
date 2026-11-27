# tsmeta120-ndiffs2.R: forecast's ndiffs, second experiment (1.20.0). Variants of the statistics behind the decisions,
# written for this experiment (Kwiatkowski et al. 1992; Said and Dickey 1984; Phillips and Perron 1988), recorded for
# d = 0, 1, 2 beside R's ndiffs; the decision rules are applied outside R (log item 40):
#   KPSS lags: trunc(4 (n/100)^0.25), trunc(3 sqrt(n) / 13), trunc(12 (n/100)^0.25), 0;
#   ADF: no constant / constant / constant and trend; k = trunc((n - 1)^(1/3)), trunc(12 (n/100)^0.25), 0,
#     and k chosen by AIC up to trunc(12 (n/100)^0.25) on a common sample;
#   PP Z(alpha) and Z(t_alpha) with a constant (y_t on 1, y_{t-1}) and lag trunc(4 (n/100)^0.25).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
kpssStat <- function(y, type, l) {
  n <- length(y); tt <- seq_len(n); e <- if (type == "level") y - mean(y) else residuals(lm(y ~ tt))
  v <- sum(e^2) / n; if (l > 0) for (s in 1:l) v <- v + 2 * (1 - s / (l + 1)) * sum(e[(s + 1):n] * e[1:(n - s)]) / n
  sum(cumsum(e)^2) / (n^2 * v)
}
adfStat <- function(y, det, k, kmax = k) {
  n <- length(y); dy <- diff(y)
  fitk <- function(kk, start) {
    z <- embed(dy, kmax + 1); rows <- (kmax + 1):(n - 1)
    X <- cbind(if (det >= 1) 1, if (det == 2) rows, y[rows], if (kk > 0) z[, 2:(kk + 1), drop = FALSE])
    f <- lm.fit(X, z[, 1]); j <- det + 1; s2 <- sum(f$residuals^2) / (nrow(X) - ncol(X))
    list(t = unname(f$coefficients[j] / sqrt(s2 * chol2inv(qr.R(f$qr))[j, j])), aic = nrow(X) * log(sum(f$residuals^2) / nrow(X)) + 2 * ncol(X))
  }
  if (k >= 0) return(fitk(k)$t)
  fits <- lapply(0:kmax, fitk); fits[[which.min(sapply(fits, `[[`, "aic"))]]$t
}
ppStat <- function(y, l) {
  n <- length(y); yt <- y[-1]; yl <- y[-n]; nn <- n - 1; X <- cbind(1, yl); f <- lm.fit(X, yt); u <- f$residuals
  rho <- f$coefficients[2]; s2 <- sum(u^2) / (nn - 2); seR <- sqrt(s2 * solve(crossprod(X))[2, 2])
  su2 <- sum(u^2) / nn; lam <- su2; if (l > 0) for (s in 1:l) lam <- lam + 2 * (1 - s / (l + 1)) * sum(u[(s + 1):nn] * u[1:(nn - s)]) / nn
  sxx <- sum((yl - mean(yl))^2)
  c(za = unname(nn * (rho - 1) - nn^2 / (2 * sxx) * (lam - su2)),
    zt = unname(sqrt(su2 / lam) * (rho - 1) / seR - (lam - su2) * nn / (2 * sqrt(lam) * sqrt(sxx))))
}
set.seed(20261127)
rows <- list()
for (it in 1:500) {
  n <- sample(30:300, 1); kind <- sample(1:3, 1)
  x <- switch(kind, as.numeric(arima.sim(list(ar = runif(1, 0.5, 0.99)), n)), cumsum(as.numeric(arima.sim(list(ar = runif(1, 0, 0.9)), n))),
              cumsum(cumsum(rnorm(n))) * runif(1, 0, 0.05) + cumsum(rnorm(n)))
  if (kind == 1 && runif(1) < 0.5) x <- x + 0.02 * (1:n)
  dx <- lapply(0:2, function(d) if (d) diff(x, differences = d) else x)
  L <- function(y) c(l4 = trunc(4 * (length(y) / 100)^0.25), l3 = trunc(3 * sqrt(length(y)) / 13), l12 = trunc(12 * (length(y) / 100)^0.25), l0 = 0)
  r <- list(n = n, nd = sapply(0:2, function(d) n - d), kpss = ndiffs(x), kpss_trend = ndiffs(x, type = "trend"), adf = ndiffs(x, test = "adf"),
            adf_trend = ndiffs(x, test = "adf", type = "trend"), pp = ndiffs(x, test = "pp"))
  for (lg in names(L(x))) r[[paste0("kL_", lg)]] <- sapply(dx, function(y) kpssStat(y, "level", L(y)[[lg]]))
  for (lg in names(L(x))) r[[paste0("kT_", lg)]] <- sapply(dx, function(y) kpssStat(y, "trend", L(y)[[lg]]))
  for (det in 0:2) {
    r[[paste0("a", det, "_k3")]] <- sapply(dx, function(y) adfStat(y, det, trunc((length(y) - 1)^(1 / 3))))
    r[[paste0("a", det, "_k12")]] <- sapply(dx, function(y) adfStat(y, det, trunc(12 * (length(y) / 100)^0.25)))
    r[[paste0("a", det, "_k0")]] <- sapply(dx, function(y) adfStat(y, det, 0))
    # second run (log item 40): k = 1 and 2
    r[[paste0("a", det, "_k1")]] <- sapply(dx, function(y) adfStat(y, det, 1))
    r[[paste0("a", det, "_k2")]] <- sapply(dx, function(y) adfStat(y, det, 2))
    r[[paste0("a", det, "_kaic")]] <- sapply(dx, function(y) adfStat(y, det, -1, trunc(12 * (length(y) / 100)^0.25)))
  }
  pp <- sapply(dx, function(y) ppStat(y, trunc(4 * (length(y) / 100)^0.25))); r$pp_za <- pp["za", ]; r$pp_zt <- pp["zt", ]
  rows[[it]] <- r
}
out$rows <- rows
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string"))
