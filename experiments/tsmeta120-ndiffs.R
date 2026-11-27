# tsmeta120-ndiffs.R: forecast's ndiffs, nsdiffs and ocsb.test (1.20.0), first experiment. ndiffs returns only the
# number of differences, so the decision boundary is read against statistics computed for this experiment:
#   KPSS (Kwiatkowski et al. 1992; as found for tseries' kpss.test in experiment 6): level or trend residuals,
#     Bartlett / Newey-West variance, short lag trunc(4 (n/100)^0.25); candidate rule: d = 0; while d < max.d and
#     the KPSS statistic of diff(x, differences = d) exceeds the critical value at alpha, d = d + 1;
#   ADF (drift, i.e. a constant, for type "level"; constant and trend for "trend"), k = trunc((n - 1)^(1/3)) lagged
#     differences; PP Z(t_alpha) likewise — both only recorded (stat for d = 0, 1) beside R's result;
#   nsdiffs "seas" (Wang, Smith and Hyndman 2006): F_s = max(0, 1 - var(R) / var(S + R)) > 0.64, with S, R from
#     stl(x, "periodic") (candidate N1) or mstl(x) (N2);
#   ocsb.test: its printed structure.
# Data: AR(1) series with phi near 1 (and integrated ones) so that the decisions vary; seasonal series with a
# seasonal component of varying strength.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
kpssStat <- function(y, type) {
  n <- length(y); tt <- seq_len(n)
  e <- if (type == "level") y - mean(y) else residuals(lm(y ~ tt))
  l <- trunc(4 * (n / 100)^0.25); v <- sum(e^2) / n
  if (l > 0) for (s in 1:l) v <- v + 2 * (1 - s / (l + 1)) * sum(e[(s + 1):n] * e[1:(n - s)]) / n
  sum(cumsum(e)^2) / (n^2 * v)
}
adfStat <- function(y, type) {
  n <- length(y); k <- trunc((n - 1)^(1 / 3)); dy <- diff(y); z <- embed(dy, k + 1); tt <- (k + 1):(n - 1)
  X <- cbind(1, if (type == "trend") tt, y[(k + 1):(n - 1)], z[, -1, drop = FALSE]); f <- lm.fit(X, z[, 1])
  j <- if (type == "trend") 3 else 2; s2 <- sum(f$residuals^2) / (nrow(X) - ncol(X))
  f$coefficients[j] / sqrt(s2 * chol2inv(qr.R(f$qr))[j, j])
}
set.seed(20261127)
rows <- list()
for (it in 1:500) {
  n <- sample(30:300, 1); kind <- sample(1:3, 1)
  x <- switch(kind, as.numeric(arima.sim(list(ar = runif(1, 0.5, 0.99)), n)), cumsum(as.numeric(arima.sim(list(ar = runif(1, 0, 0.9)), n))),
              cumsum(cumsum(rnorm(n))) * runif(1, 0, 0.05) + cumsum(rnorm(n)))
  if (kind == 1 && runif(1) < 0.5) x <- x + 0.02 * (1:n)
  r <- list(n = n, kind = kind,
            kpss = ndiffs(x), kpss_a01 = ndiffs(x, alpha = 0.01), kpss_a10 = ndiffs(x, alpha = 0.1), kpss_trend = ndiffs(x, type = "trend"),
            adf = ndiffs(x, test = "adf"), pp = ndiffs(x, test = "pp"),
            kL = sapply(0:2, function(d) kpssStat(if (d) diff(x, differences = d) else x, "level")),
            kT = sapply(0:2, function(d) kpssStat(if (d) diff(x, differences = d) else x, "trend")),
            aL = sapply(0:2, function(d) adfStat(if (d) diff(x, differences = d) else x, "level")))
  rows[[it]] <- r
}
out$ndiffs <- rows
# nsdiffs
srows <- list()
for (it in 1:300) {
  f <- sample(c(4, 12), 1); n <- f * sample(4:15, 1)
  x <- ts(0.03 * (1:n) + runif(1, 0, 3) * sin(2 * pi * (1:n) / f + runif(1, 0, 6)) + cumsum(rnorm(n, sd = runif(1, 0.1, 1))) * runif(1, 0, 1) + rnorm(n),
          frequency = f)
  st <- stl(x, "periodic"); S <- st$time.series[, 1]; Rm <- st$time.series[, 3]
  ms <- mstl(x); Sm <- seasonal(ms); Rr <- remainder(ms)
  srows[[it]] <- list(n = n, f = f, R = nsdiffs(x), F1 = max(0, 1 - var(Rm) / var(S + Rm)), F2 = max(0, 1 - var(Rr) / var(Sm + Rr)),
                      ocsb = nsdiffs(x, test = "ocsb"))
}
out$nsdiffs <- srows
o <- ocsb.test(AirPassengers)
out$ocsb <- list(names = names(o), statistics = o$statistics, pvalues = o$pvalues, method = o$method,
                 critical = o$critical, class = class(o), printed = capture.output(print(o)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string"))
