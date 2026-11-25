# tdroc119-iid5.R: timeROC's iid representation, after tdroc119-iid4.R (1.19.0): with the censoring martingale taken
# over the sorted subjects (candidate P), every case and control row equals R's, and so do the censored subjects who are
# first among their tied times; the other censored rows differ. Written out, the censoring part of the AUC's influence
# for subject k is
#   (1 / (F n)) sum_i a_i (TP_i - AUC) q_k(i),  TP_i = sum_j h_ij b_j / (n S),
#   q_k(i) = n [ [k censored, k "before" i] / Rjump_k - sum_{p "before" i and at or before k} dL(p) / Rcomp_p ],
# so a grid of variants over what "before" means for k's own jump (positions p_k < p_i; times T_k < T_i; times
# T_k <= T_i), for k's jump denominator (n - p_k + 1; #(T >= T_k); the tie-corrected risk set of the weights), and for
# the compensator (positional, or by time with the tie-corrected risk set). Compared with mat_iid_rep_1, all rows.
# The same data as tdroc119-basic.R.
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
r <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, ROC = TRUE, iid = TRUE)
iidR <- r$inference$mat_iid_rep_1
ut <- sort(unique(T))
R_u <- sapply(ut, function(u) sum(T > u) + sum(T == u & delta == 0))
c_u <- sapply(ut, function(u) sum(T == u & delta == 0))
dLu <- ifelse(R_u > 0, c_u / R_u, 0)
Gs <- cumprod(1 - dLu)
G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
o <- order(T); Ts <- T[o]; ds <- delta[o]; Ms <- marker[o]; pos <- seq_len(n)
h <- outer(Ms, Ms, function(x, y) (x > y) + 0.5 * (x == y))
Rpos <- n - pos + 1
Rtime <- sapply(Ts, function(v) sum(Ts >= v))
Rtie <- sapply(Ts, function(v) R_u[match(v, ut)])
dLpos <- (ds == 0) / Rpos
IFgrid <- function(jumpSet, jumpDen, comp) sapply(times, function(t) {
  a <- (Ts < t & ds == 1) / G(Ts, TRUE); b <- (Ts > t) / G(t, FALSE)
  N <- sum(h * outer(a, b)) / n^2; F <- sum(a) / n; S <- sum(b) / n; auc <- N / (F * S)
  TPi <- as.vector(h %*% b) / (n * S)
  e <- a * (TPi - auc)
  sapply(pos, function(k) {
    base <- (sum(h[k, ] * a[k] * b) / n + sum(h[, k] * a * b[k]) / n - 2 * N - auc * (S * (a[k] - F) + F * (b[k] - S))) / (F * S)
    jden <- switch(jumpDen, pos = Rpos[k], time = Rtime[k], tie = Rtie[k])
    after <- switch(jumpSet, pos = pos > k, time = Ts > Ts[k], timeEq = Ts >= Ts[k] & pos != k)
    jump <- if (ds[k] == 0) n / jden * sum(e[after]) else 0
    compTerm <- if (comp == "pos") {
      # sum over positions p <= k of dL(p) / Rpos(p), times sum of e over cases after p
      sum(sapply(pos[pos <= k], function(p) n * dLpos[p] / Rpos[p] * sum(e[pos > p])))
    } else {
      # by time: the unique times u <= T_k, dL(u) / R(u), times e over cases with T > u
      us <- ut[ut <= Ts[k]]
      sum(sapply(us, function(u) { m <- match(u, ut); if (R_u[m] == 0) 0 else n * dLu[m] / R_u[m] * sum(e[Ts > u]) }))
    }
    base + (jump - compTerm) / (F * n)
  })
})
out$grid <- list()
for (js in c("pos", "time", "timeEq")) for (jd in c("pos", "time", "tie")) for (cp in c("pos", "time")) {
  IF <- IFgrid(js, jd, cp)
  out$grid[[paste(js, jd, cp, sep = ",")]] <- apply(abs(IF - iidR), 2, max)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
