# tdroc119-aalen3.R: the tied data of tdroc119-aalen.R, after tdroc119-aalen2.R (equal without ties): each censoring
# taken on its own at its position among the subjects sorted by time (risk set: the positions from it on), ties in
# the data order, events first, or censorings first. (The header of tdroc119-aalen.R follows.)
# tdroc119-aalen.R: timeROC's weighting = "aalen" (1.19.0). Candidate written for this experiment (Aalen's additive
# hazards model of the censoring, the least-squares increments): at each censoring time u, dB(u) = (X(u)' X(u))^-1
# X(u)' dN(u), X(u) the rows [1, Z_j] of the subjects at risk at u (T_j >= u, or the risk set of the marginal weights,
# events at u left out), Z = the marker; G(s | Z_i) = exp(-sum_{u <= s} [1, Z_i] dB(u)), truncated to [0, 1] (or
# not); compared with IPCW.subjectTimes (sorted order, at T_i-) and IPCW.times (sorted order). The data of
# tdroc119-basic.R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261126)
n <- 40
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 0) + 1
delta <- as.numeric(ttrue <= cens)
times <- c(5, 10, 15)
ra <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "aalen", times = times)
out$R <- list(AUC = unname(ra$AUC), IPCW.times = unname(ra$weights$IPCW.times), IPCW.subjectTimes = unname(ra$weights$IPCW.subjectTimes),
              fit_class = class(ra$weights$fit))
o <- order(T)
cand <- list()
for (tieord in c("data", "eventsFirst", "censFirst")) {
  op <- switch(tieord, data = order(T), eventsFirst = order(T, -delta), censFirst = order(T, delta))
  Ts <- T[op]; ds <- delta[op]; Ms <- marker[op]
  cpos <- which(ds == 0)
  dB <- t(sapply(cpos, function(p) { X <- cbind(1, Ms[p:n]); dN <- as.numeric(seq(p, n) == p); as.vector(solve(crossprod(X), crossprod(X, dN))) }))
  B <- apply(dB, 2, cumsum); ct <- Ts[cpos]
  Gat <- function(s, z, left) { k <- if (left) which(ct < s) else which(ct <= s); v <- if (length(k)) exp(-(B[max(k), 1] + B[max(k), 2] * z)) else 1; min(1, max(0, v)) }
  sub <- sapply(seq_len(n), function(i) Gat(T[i], marker[i], TRUE))[o]
  tt <- sapply(times, function(t) sapply(seq_len(n), function(i) Gat(t, marker[i], FALSE)))[o, ]
  cand[[tieord]] <- list(sub = sub, times = tt)
}
out$cand <- cand
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
