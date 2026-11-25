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
cu <- sort(unique(T[delta == 0]))
cand <- list()
for (rs in c("ge", "eventsFirst")) {
  dB <- t(sapply(cu, function(u) {
    at <- if (rs == "ge") T >= u else (T > u | (T == u & delta == 0))
    X <- cbind(1, marker[at]); dN <- as.numeric(T[at] == u & delta[at] == 0)
    as.vector(solve(crossprod(X), crossprod(X, dN)))
  }))
  B <- apply(dB, 2, cumsum)
  Gat <- function(s, z, left, trunc) { k <- if (left) which(cu < s) else which(cu <= s); v <- if (length(k)) exp(-(B[max(k), 1] + B[max(k), 2] * z)) else 1; if (trunc) min(1, max(0, v)) else v }
  for (trunc in c(TRUE, FALSE)) {
    sub <- sapply(seq_len(n), function(i) Gat(T[i], marker[i], TRUE, trunc))[o]
    tt <- sapply(times, function(t) sapply(seq_len(n), function(i) Gat(t, marker[i], FALSE, trunc)))[o, ]
    cand[[paste(rs, trunc, sep = ",")]] <- list(sub = sub, times = tt)
  }
}
out$cand <- cand
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
