# tdroc119-survivalroc6.R: as tdroc119-survivalroc3.R with no time of 0 (T rounded, plus 0.1): in
# tdroc119-survivalroc5.R a subject censored at T = 0 was counted at risk by R at the first event time (R's S_i 3/4,
# the KM of the neighbours 2/3). (The header of tdroc119-survivalroc3.R follows.)
# tdroc119-survivalroc3.R: as tdroc119-survivalroc2.R on a continuous marker (no ties), with also the neighbourhoods
# by order: j with |rank_j - rank_i| <= k, k = floor / ceiling / round of span n or span n / 2.
# (The header of tdroc119-survivalroc2.R follows.)
# tdroc119-survivalroc2.R: survivalROC's NNE estimator, after tdroc119-survivalroc.R (KM equal; NNE 0.077 off with
# the neighbourhood |F_n(M_i) - F_n(M_j)| < span and S(t) the mean of the smoothed survivals). A grid written for this
# experiment: S(t) the mean of S_i(t) or the KM (R's reported Survival is the KM); the neighbourhood half-width span,
# span / 2 or 2 span; < or <=; F_n the ecdf (max rank / n) or the mean rank / n. The data of tdroc119-survivalroc.R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261128)
n <- 30
marker <- rnorm(n)   # (replaced: rounded to 0.1 in tdroc119-survivalroc2.R)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 1) + 0.1   # (replaced: without + 0.1, a time could be 0)
status <- as.numeric(ttrue <= cens)
pt <- 6; span <- 0.25 * n^(-0.2)
nne <- survivalROC(Stime = T, status = status, marker = marker, predict.time = pt, span = span)
KMall <- { s <- survfit(Surv(T, status) ~ 1); tail(s$surv[s$time <= pt], 1) }
ts <- sort(unique(T[status == 1 & T <= pt]))
res <- list()
for (fn in c("ecdf", "meanrank")) for (w in c(1, 0.5, 2)) for (strict in c(TRUE, FALSE)) for (sm in c("mean", "km")) {
  u <- if (fn == "ecdf") ecdf(marker)(marker) else rank(marker) / n
  K <- outer(u, u, function(a, b) if (strict) abs(a - b) < w * span else abs(a - b) <= w * span)
  Si <- sapply(seq_len(n), function(i) prod(sapply(ts, function(s) { y <- sum(K[i, ] * (T >= s)); if (y > 0) 1 - sum(K[i, ] * (T == s & status == 1)) / y else 1 })))
  St <- if (sm == "mean") mean(Si) else KMall
  r <- t(sapply(nne$cut.values, function(c) { Sc <- sum(Si * (marker > c)) / n; p <- mean(marker > c); c(TP = (p - Sc) / (1 - St), FP = Sc / St) }))
  res[[paste(fn, w, strict, sm, sep = ",")]] <- c(TP = max(abs(r[, "TP"] - nne$TP)), FP = max(abs(r[, "FP"] - nne$FP)))
}
rk <- rank(marker)
for (base in c("n", "n2")) for (rd in c("floor", "ceiling", "round")) for (sm in c("mean", "km")) {
  kk <- switch(rd, floor = floor, ceiling = ceiling, round = round)((if (base == "n") span * n else span * n / 2))
  K <- outer(rk, rk, function(a, b) abs(a - b) <= kk)
  Si <- sapply(seq_len(n), function(i) prod(sapply(ts, function(s) { y <- sum(K[i, ] * (T >= s)); if (y > 0) 1 - sum(K[i, ] * (T == s & status == 1)) / y else 1 })))
  St <- if (sm == "mean") mean(Si) else KMall
  r <- t(sapply(nne$cut.values, function(c) { Sc <- sum(Si * (marker > c)) / n; p <- mean(marker > c); c(TP = (p - Sc) / (1 - St), FP = Sc / St) }))
  res[[paste("order", base, rd, sm, sep = ",")]] <- c(TP = max(abs(r[, "TP"] - nne$TP)), FP = max(abs(r[, "FP"] - nne$FP)))
}
out$grid <- res
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
