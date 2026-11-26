# tsmeta120-ndiffs4.R: forecast's ndiffs with test = "pp", type = "trend" (1.20.0, log item 78). A designed probe:
# ndiffs(y, alpha) at d = 0 is >= 1 exactly when R's p-value exceeds alpha, so bisection on alpha recovers R's p-value,
# and inside (0.01, 0.10) the statistic follows by inverting the linear interpolation in the tau_tau row. Candidates
# written for this experiment (Phillips and Perron 1988), recorded beside it:
#   A: closed form with det(X'X), X = (1, t, y_{t-1}), lag trunc(4 (n/100)^0.25), su2 and lambda2 over nn (my first);
#   B: the same with lag trunc(12 (n/100)^0.25);
#   C: the general form sqrt(su2/lambda2) t - (lambda2 - su2) nn se / (2 sqrt(lambda2) s), lag as A;
#   D: A with t centred (no change expected: a check of the det form).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
cand <- function(y, l, form) {
  n <- length(y); nn <- n - 1; yt <- y[-1]; yl <- y[-n]; tt <- seq_len(nn); if (form == "D") tt <- tt - mean(tt)
  X <- cbind(1, tt, yl); f <- lm.fit(X, yt); u <- f$residuals; rho <- f$coefficients[3]
  s2 <- sum(u^2) / (nn - 3); seR <- sqrt(s2 * solve(crossprod(X))[3, 3]); tval <- (rho - 1) / seR
  su2 <- sum(u^2) / nn; lam <- su2; if (l > 0) for (s in 1:l) lam <- lam + 2 * (1 - s / (l + 1)) * sum(u[(s + 1):nn] * u[1:(nn - s)]) / nn
  if (form == "C") return(unname(sqrt(su2 / lam) * tval - (lam - su2) * nn * seR / (2 * sqrt(lam) * sqrt(s2))))
  dx <- det(crossprod(X))
  unname(sqrt(su2 / lam) * tval - (lam - su2) * nn^3 / (4 * sqrt(3) * sqrt(dx) * sqrt(lam)))
}
# run 1 bisected on (0.0001, 0.2) and found nothing: ndiffs warns and clamps alpha to [0.01, 0.1] (all 80 NA). Run 2
# bisects inside (0.01, 0.1); NA when R's p-value is at either end. Run 2 also found nothing: alpha = 0.1 never
# differences (log 41: p is clamped to 0.10 and the rule is p > alpha), so run 3 starts below it.
# Run 3 returned NA whenever ndiffs(hi) = 0, i.e. for every p below hi (my condition was inverted): run 4 returns NA
# only for p <= 0.01, and hi when p > hi.
pOf <- function(y) { lo <- 0.01; hi <- 0.1 - 1e-9
  if (ndiffs(y, alpha = lo, test = "pp", type = "trend") == 0) return(NA)
  if (ndiffs(y, alpha = hi, test = "pp", type = "trend") >= 1) return(hi)
  for (k in 1:45) { mid <- (lo + hi) / 2; if (ndiffs(y, alpha = mid, test = "pp", type = "trend") >= 1) lo <- mid else hi <- mid }
  (lo + hi) / 2 }
set.seed(20261128)
rows <- list()
for (it in 1:80) {
  n <- sample(c(30:300), 1); phi <- runif(1, 0.6, 0.97)
  y <- as.numeric(arima.sim(list(ar = phi), n)) + runif(1, -0.05, 0.05) * (1:n)
  l4 <- trunc(4 * (n / 100)^0.25); l12 <- trunc(12 * (n / 100)^0.25)
  rows[[it]] <- list(n = n, p = pOf(y), A = cand(y, l4, "A"), B = cand(y, l12, "B"), C = cand(y, l4, "C"), D = cand(y, l4, "D"))
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
