# tdroc119-iid.R: the iid representation and the standard errors of timeROC's AUC (marginal weights, no competing
# risks; 1.19.0), with the weights found in tdroc119-basic3.R. Candidate influence function written for this experiment
# (the delta method on AUC = N / (F S), Blanche et al. 2013's approach; the censoring KM's part through the censoring
# martingale):
#   a_i = [T_i < t, delta_i = 1] / G(T_i-), b_j = [T_j > t] / G(t), h_ij = [M_i > M_j] + [M_i = M_j] / 2,
#   N = sum_ij h_ij a_i b_j / n^2, F = sum a_i / n, S = sum b_j / n;
#   q_k(s) = n sum_{u <= s} dM_k(u) / R(u), dM_k(u) = [T_k = u, censored] - [k at risk at u] c_u / R(u), with the risk
#   set of tdroc119-basic3.R (events at u left out); q_k(s-) the sum over u < s;
#   IF_k(N) = sum_j h_kj a_k b_j / n + sum_i h_ik a_i b_k / n - 2 N + sum_ij h_ij a_i b_j (q_k(T_i-) + q_k(t)) / n^2,
#   IF_k(F) = a_k - F + sum_i a_i q_k(T_i-) / n, IF_k(S) = b_k - S + S q_k(t),
#   IF_k(AUC) = (IF_k(N) - AUC (S IF_k(F) + F IF_k(S))) / (F S).
# Compared with mat_iid_rep_1 (scale and row order unknown) and vect_sd_1 (sd / sqrt(n) with n or n - 1).
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
out$AUC <- unname(r$AUC)
out$iid_dim <- dim(r$inference$mat_iid_rep_1)
out$iid <- lapply(seq_len(ncol(r$inference$mat_iid_rep_1)), function(j) unname(r$inference$mat_iid_rep_1[, j]))
out$sd <- unname(r$inference$vect_sd_1)

ut <- sort(unique(T))
R_u <- sapply(ut, function(u) sum(T > u) + sum(T == u & delta == 0))
c_u <- sapply(ut, function(u) sum(T == u & delta == 0))
dL <- c_u / R_u
Gs <- cumprod(1 - dL)
G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
atrisk <- function(k, u) T[k] > u | (T[k] == u & delta[k] == 0)
# q[k, m]: n sum over u_1..u_m of dM_k(u) / R(u)
q <- t(sapply(seq_len(n), function(k) cumsum(sapply(seq_along(ut), function(m)
  n * ((T[k] == ut[m] & delta[k] == 0) - atrisk(k, ut[m]) * dL[m]) / R_u[m]))))
qat <- function(k, s, left) { m <- if (left) which(ut < s) else which(ut <= s); if (length(m)) q[k, max(m)] else 0 }
h <- outer(marker, marker, function(x, y) (x > y) + 0.5 * (x == y))
IF <- sapply(times, function(t) {
  a <- (T < t & delta == 1) / G(T, TRUE); b <- (T > t) / G(t, FALSE)
  N <- sum(h * outer(a, b)) / n^2; F <- sum(a) / n; S <- sum(b) / n; auc <- N / (F * S)
  sapply(seq_len(n), function(k) {
    qT <- sapply(seq_len(n), function(i) qat(k, T[i], TRUE)); qt <- qat(k, t, FALSE)
    IN <- sum(h[k, ] * a[k] * b) / n + sum(h[, k] * a * b[k]) / n - 2 * N + sum(h * outer(a * qT, b) + h * outer(a, b) * qt) / n^2
    IFf <- a[k] - F + sum(a * qT) / n; IFs <- b[k] - S + S * qt
    (IN - auc * (S * IFf + F * IFs)) / (F * S)
  })
})
out$cand_IF <- lapply(seq_len(ncol(IF)), function(j) IF[, j])
out$order <- order(T)
out$cand_sd_n <- apply(IF, 2, function(v) sqrt(mean(v^2) / n))
out$cand_sd_n1 <- apply(IF, 2, function(v) sd(v) / sqrt(n))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
