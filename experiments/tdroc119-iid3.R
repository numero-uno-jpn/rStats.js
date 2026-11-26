# tdroc119-iid3.R: timeROC's iid representation, after tdroc119-iid2.R (1.19.0). The best candidate there (the
# cases' martingale term at T_i) was 0.012 off; R's values differ between subjects in the same situation at the same
# time (cases at T = 1 above every control: 0.365907 and 0.366147) and depend on the position within tied times. So
# candidate P: the censoring martingale of the iid representation taken over the subjects sorted by time (ties in the
# data order), with the risk set at position p = n - p + 1 (no tie correction):
#   dL(p) = [subject at p censored] / (n - p + 1), M_k = [k censored] - sum_{p <= p_k} dL(p),
#   q_k(through position P) = n sum_{p <= P} dM_k(p) / (n - p + 1), dM_k(p) = [p = p_k, censored] - [p <= p_k] dL(p);
#   case i: the term at q_k(positions before p_i) (variant P1) or through p_i (P2); controls at q_k(positions with
#   T <= t). The weights stay those of tdroc119-basic3.R (they matched R).
# Also the empirical sd of R's own iid columns, to fix vect_sd_1's scale. The same data as tdroc119-basic.R.
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
out$iid <- lapply(1:3, function(j) unname(iidR[, j])); out$sd <- unname(r$inference$vect_sd_1)
out$sd_of_iid <- list(sd_n1 = apply(iidR, 2, sd) / sqrt(n), rms_n = apply(iidR, 2, function(v) sqrt(mean(v^2) / n)),
                      mean = colMeans(iidR))

# the weights of tdroc119-basic3.R
ut <- sort(unique(T))
R_u <- sapply(ut, function(u) sum(T > u) + sum(T == u & delta == 0))
Gs <- cumprod(1 - ifelse(R_u > 0, sapply(ut, function(u) sum(T == u & delta == 0)) / R_u, 0))
G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
o <- order(T)                                          # positions: sorted times, ties in the data order
Ts <- T[o]; ds <- delta[o]; Ms <- marker[o]
dLp <- (ds == 0) / (n - seq_len(n) + 1)
# Q[k, P] = n sum_{p <= P} dM_k(p) / (n - p + 1), k a position
Q <- t(sapply(seq_len(n), function(k) cumsum(n * (((seq_len(n) == k) & ds[k] == 0) - (seq_len(n) <= k) * dLp) / (n - seq_len(n) + 1))))
h <- outer(Ms, Ms, function(x, y) (x > y) + 0.5 * (x == y))
IFpos <- function(variant) sapply(times, function(t) {
  a <- (Ts < t & ds == 1) / G(Ts, TRUE); b <- (Ts > t) / G(t, FALSE)
  N <- sum(h * outer(a, b)) / n^2; F <- sum(a) / n; S <- sum(b) / n; auc <- N / (F * S)
  Pt <- max(c(0, which(Ts <= t)))
  sapply(seq_len(n), function(k) {
    qi <- sapply(seq_len(n), function(i) { P <- if (variant == "P1") i - 1 else i; if (P == 0) 0 else Q[k, P] })
    qt <- if (Pt == 0) 0 else Q[k, Pt]
    IN <- sum(h[k, ] * a[k] * b) / n + sum(h[, k] * a * b[k]) / n - 2 * N + sum(h * outer(a * qi, b) + h * outer(a, b) * qt) / n^2
    IFf <- a[k] - F + sum(a * qi) / n; IFs <- b[k] - S + S * qt
    (IN - auc * (S * IFf + F * IFs)) / (F * S)
  })
})
out$cand <- list(P1 = lapply(1:3, function(j) IFpos("P1")[, j]), P2 = lapply(1:3, function(j) IFpos("P2")[, j]))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
