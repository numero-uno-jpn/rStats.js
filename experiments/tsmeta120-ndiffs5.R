# tsmeta120-ndiffs5.R: forecast's ndiffs(test = "pp", type = "trend"), second experiment (1.20.0, log item 79).
# R's p-value at d = 0 by bisection on alpha inside (0.01, 0.1) (as in ndiffs4 run 4), and the components of my own
# Phillips-Perron computation (y_t on 1, t, y_{t-1}): the t value, su2 = SSR / nn, the Bartlett long-run variances
# lambda2(l) for l = 0 .. 15, nn and det(X'X), so that the lag and the form can be fitted outside R. Designed: series of
# white, AR(0.3) and AR(0.8) errors (lambda2 near su2, moderate, large) with lengths across the size classes.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
comp <- function(y) {
  n <- length(y); nn <- n - 1; yt <- y[-1]; yl <- y[-n]; tt <- seq_len(nn)
  X <- cbind(1, tt, yl); f <- lm.fit(X, yt); u <- f$residuals; rho <- f$coefficients[3]
  s2 <- sum(u^2) / (nn - 3); seR <- sqrt(s2 * solve(crossprod(X))[3, 3])
  su2 <- sum(u^2) / nn
  lams <- sapply(0:15, function(l) { v <- su2; if (l > 0) for (s in 1:l) v <- v + 2 * (1 - s / (l + 1)) * sum(u[(s + 1):nn] * u[1:(nn - s)]) / nn; v })
  list(n = n, tval = unname((rho - 1) / seR), rho = unname(rho), su2 = su2, s2 = s2, lams = lams, dx = det(crossprod(X)))
}
pOf <- function(y) { lo <- 0.01; hi <- 0.1 - 1e-9
  if (ndiffs(y, alpha = lo, test = "pp", type = "trend") == 0) return(NA)
  if (ndiffs(y, alpha = hi, test = "pp", type = "trend") >= 1) return(hi)
  for (k in 1:45) { mid <- (lo + hi) / 2; if (ndiffs(y, alpha = mid, test = "pp", type = "trend") >= 1) lo <- mid else hi <- mid }
  (lo + hi) / 2 }
set.seed(20261129)
rows <- list()
for (it in 1:240) {
  n <- sample(c(20:60, 80:120, 200:300), 1); kind <- (it - 1) %% 3 + 1; phi <- c(0, 0.3, 0.8)[kind]
  # a near-unit-root level so that p falls inside (0.01, 0.1) often
  e <- as.numeric(arima.sim(list(ar = max(phi, 1e-8)), n)); y <- numeric(n); r <- runif(1, 0.55, 0.9)
  y[1] <- e[1]; for (t in 2:n) y[t] <- r * y[t - 1] + e[t]
  y <- y + runif(1, -0.05, 0.05) * (1:n)
  rows[[it]] <- c(comp(y), list(kind = kind, p = pOf(y)))
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
