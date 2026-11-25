# tdroc119-cr.R: timeROC with competing risks (delta in 0, 1, 2; cause = 1), marginal weights (1.19.0). Candidates
# written for this experiment from the help's definitions and the single-cause findings (tdroc119-basic3.R, -iid5.R):
#   the censoring KM as before (subjects with an event of either kind at u left out of the risk set at u);
#   cases T_i < t, delta_i = 1, weight 1 / G(T_i-);
#   controls (i): T_j > t, weight 1 / G(t); controls (ii): (i) and the subjects with the other event before t (T_j < t,
#   or T_j <= t: both tried), weight 1 / G(T_j-);
#   AUC_k = sum_ij h_ij a_i c_j / (sum a sum c); FP_k(c) = weighted proportion of controls above c.
#   iid: the single-cause form generalised to every weighted term, with R's mixed censoring part: for a weighted
#   subject i (a case or a type-(ii) control with T_i < t), q_k(i) = n ([k censored, T_i >= T_k, i != k] / #(T >= T_k)
#   - sum_{p <= p_k, p < p_i} dL(p) / (n - p + 1)); for the weight at t, q_k(t) = n ([k censored, T_k <= t] /
#   #(T >= T_k) - sum_{p <= p_k, T_p <= t} dL(p) / (n - p + 1)); then
#   IF_k = (IF_k(N) - AUC (S IF_k(F) + F IF_k(S))) / (F S) with IF_k(N) = h-row terms - 2 N + sum h a c (q_i + q_j) / n^2,
#   IF_k(F) = a_k - F + sum a q / n, IF_k(S) = c_k - S + sum c q / n.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261127)
n <- 50
marker <- round(rnorm(n), 1)
t1 <- rexp(n, exp(0.8 * marker) / 12); t2 <- rexp(n, 1 / 15); cc <- rexp(n, 1 / 18)
T <- round(pmin(t1, t2, cc)) + 1
delta <- ifelse(cc <= pmin(t1, t2), 0, ifelse(t1 <= t2, 1, 2))
times <- c(4, 8, 12)
out$data <- list(T = T, delta = delta, marker = marker, times = times)
r <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, ROC = TRUE, iid = TRUE)
out$class <- class(r); out$names <- names(r)
out$AUC_1 <- unname(r$AUC_1); out$AUC_2 <- unname(r$AUC_2)
out$TP <- lapply(1:3, function(j) unname(r$TP[, j])); out$FP_1 <- lapply(1:3, function(j) unname(r$FP_1[, j]))
out$FP_2 <- lapply(1:3, function(j) unname(r$FP_2[, j]))
out$CumInc <- unname(r$CumulativeIncidence); out$survProb <- unname(r$survProb)
out$Stats <- unname(r$Stats); out$Stats_dimnames <- dimnames(r$Stats)
out$inference_names <- names(r$inference)
out$sd_1 <- unname(r$inference$vect_sd_1); out$sd_2 <- unname(r$inference$vect_sd_2)
out$iid_1 <- lapply(1:3, function(j) unname(r$inference$mat_iid_rep_1[, j]))
out$iid_2 <- lapply(1:3, function(j) unname(r$inference$mat_iid_rep_2[, j]))
out$at_t <- sapply(times, function(t) c(sum(T == t & delta == 1), sum(T == t & delta == 2), sum(T == t & delta == 0)))

ut <- sort(unique(T))
R_u <- sapply(ut, function(u) sum(T > u) + sum(T == u & delta == 0))
dLu <- ifelse(R_u > 0, sapply(ut, function(u) sum(T == u & delta == 0)) / R_u, 0)
Gs <- cumprod(1 - dLu)
G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
o <- order(T); Ts <- T[o]; ds <- delta[o]; Ms <- marker[o]; pos <- seq_len(n)
h <- outer(Ms, Ms, function(x, y) (x > y) + 0.5 * (x == y))
Rpos <- n - pos + 1; dLpos <- (ds == 0) / Rpos; Rtime <- sapply(Ts, function(v) sum(Ts >= v))
qk <- function(k, i) n * (((ds[k] == 0) & Ts[i] >= Ts[k] & i != k) / Rtime[k] - sum((pos <= k & pos < i) * dLpos / Rpos))
qkt <- function(k, t) n * (((ds[k] == 0) & Ts[k] <= t) / Rtime[k] - sum((pos <= k & Ts <= t) * dLpos / Rpos))
fit <- function(t, def, compAtT) {
  a <- (Ts < t & ds == 1) / G(Ts, TRUE)
  inT <- Ts > t
  comp <- if (def == 2) (if (compAtT) Ts <= t else Ts < t) & ds == 2 else rep(FALSE, n)
  c <- inT / G(t, FALSE) + comp / G(Ts, TRUE)
  N <- sum(h * outer(a, c)) / n^2; F <- sum(a) / n; S <- sum(c) / n; auc <- N / (F * S)
  cuts <- c(sort(unique(marker), decreasing = TRUE), -Inf)
  fp <- sapply(cuts, function(cu) sum(c * (Ms > cu)) / sum(c))
  IF <- sapply(pos, function(k) {
    qa <- sapply(pos, function(i) qk(k, i)); qt <- qkt(k, t)
    qc <- ifelse(inT, qt, qa)
    IN <- sum(h[k, ] * a[k] * c) / n + sum(h[, k] * a * c[k]) / n - 2 * N + sum(h * (outer(a * qa, c) + outer(a, c * qc))) / n^2
    IFf <- a[k] - F + sum(a * qa) / n; IFs <- c[k] - S + sum(c * qc) / n
    (IN - auc * (S * IFf + F * IFs)) / (F * S)
  })
  list(auc = auc, fp = fp, sd = sd(IF) / sqrt(n), IF = IF, cuminc = sum(a) / n)
}
out$cand <- list()
for (def in 1:2) for (compAtT in c(FALSE, TRUE)) {
  if (def == 1 && compAtT) next
  out$cand[[paste0("def", def, ",atT=", compAtT)]] <- lapply(times, fit, def = def, compAtT = compAtT)
}
km_any <- survfit(Surv(T, delta > 0) ~ 1)
out$KM_any <- sapply(times, function(t) { s <- km_any$surv[km_any$time <= t]; if (length(s)) tail(s, 1) else 1 })
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
