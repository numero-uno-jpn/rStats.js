# tsmeta120-ndiffs3.R: forecast's ndiffs (size-class boundaries, other alpha) and ocsb.test (1.20.0). Candidates:
#   ADF / PP size class at the boundaries: series whose differenced length is exactly 25, 26, 50, 51, 100, 101, 250,
#     251, 500, 501, with the statistic recorded (rules "n <= boundary" / "n < boundary" applied outside R);
#   alpha = 0.01, 0.1 (the 1% / 10% columns: tau_mu -3.75, -3.58, -3.51, -3.46, -3.44, -3.43 / -2.63, -2.60, -2.58,
#     -2.57, -2.57, -2.57) and alpha = 0.025, 0.07 (KPSS: p interpolated in the table; ADF: recorded);
#   ocsb.test (Osborn, Chui, Smith and Birchenhall 1988): z_t = Delta_m Delta_1 y_t on Delta_m y_{t-1} and
#     Delta_1 y_{t-m} (candidate O1: no constant; O2: a constant; O3: seasonal dummies), the statistic = the t value
#     of the coefficient on Delta_1 y_{t-m} (O*a) or on Delta_m y_{t-1} (O*b); the critical value R reports, for
#     m = 2..60 (to see its shape).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
adfStat <- function(y, det) {
  n <- length(y); dy <- diff(y); z <- embed(dy, 2); rows <- 2:(n - 1)
  X <- cbind(1, if (det == 2) rows, y[rows], z[, 2]); f <- lm.fit(X, z[, 1]); j <- det + 1
  s2 <- sum(f$residuals^2) / (nrow(X) - ncol(X)); unname(f$coefficients[j] / sqrt(s2 * chol2inv(qr.R(f$qr))[j, j]))
}
kpssStat <- function(y) {
  n <- length(y); e <- y - mean(y); l <- trunc(3 * sqrt(n) / 13)
  v <- sum(e^2) / n; if (l > 0) for (s in 1:l) v <- v + 2 * (1 - s / (l + 1)) * sum(e[(s + 1):n] * e[1:(n - s)]) / n
  sum(cumsum(e)^2) / (n^2 * v)
}
set.seed(20261128)
b <- list()
for (len in c(25, 26, 50, 51, 100, 101, 250, 251, 500, 501)) for (it in 1:60) {
  x <- as.numeric(arima.sim(list(ar = runif(1, 0.6, 0.97)), len))
  b[[length(b) + 1]] <- c(len = len, R = ndiffs(x, test = "adf", max.d = 1), stat = adfStat(x, 1),
                          R01 = ndiffs(x, test = "adf", alpha = 0.01, max.d = 1), R10 = ndiffs(x, test = "adf", alpha = 0.1, max.d = 1),
                          R025 = tryCatch(ndiffs(x, test = "adf", alpha = 0.025, max.d = 1), error = function(e) -1),
                          k07 = ndiffs(x, alpha = 0.07, max.d = 1), k025 = ndiffs(x, alpha = 0.025, max.d = 1), kstat = kpssStat(x))
}
out$bounds <- do.call(rbind, b)
oc <- list()
for (m in c(4, 12, 7)) for (it in 1:6) {
  n <- m * sample(8:20, 1)
  y <- ts(cumsum(rnorm(n)) * runif(1, 0, 1) + sin(2 * pi * (1:n) / m) * runif(1, 0, 3) + rnorm(n), frequency = m)
  if (runif(1) < 0.5) y <- ts(diffinv(as.numeric(y), lag = m)[-(1:m)], frequency = m)
  r <- ocsb.test(y)
  yy <- as.numeric(y); N <- length(yy)
  d1 <- c(NA, diff(yy)); dm <- c(rep(NA, m), diff(yy, lag = m)); z <- c(rep(NA, m + 1), diff(diff(yy, lag = m)))
  t <- (m + 2):N
  Z <- z[t]; X1 <- dm[t - 1]; X2 <- d1[t - m]
  tv <- function(X, j) { f <- lm.fit(X, Z); s2 <- sum(f$residuals^2) / (nrow(X) - ncol(X)); unname(f$coefficients[j] / sqrt(s2 * chol2inv(qr.R(f$qr))[j, j])) }
  D <- outer(((t - 1) %% m) + 1, 1:m, "==") * 1
  oc[[length(oc) + 1]] <- c(m = m, n = N, R = unname(r$statistics), crit = unname(r$critical),
                            O1a = tv(cbind(X1, X2), 2), O1b = tv(cbind(X1, X2), 1), O2a = tv(cbind(1, X1, X2), 3), O2b = tv(cbind(1, X1, X2), 2),
                            O3a = tv(cbind(D, X1, X2), m + 2), O3b = tv(cbind(D, X1, X2), m + 1))
}
out$ocsb <- do.call(rbind, oc)
out$ocsb_crit <- sapply(2:60, function(m) { set.seed(m); unname(ocsb.test(ts(rnorm(m * 10), frequency = m))$critical) })
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string"))
