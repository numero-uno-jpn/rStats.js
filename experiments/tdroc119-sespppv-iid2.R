# tdroc119-sespppv-iid2.R: Sp2's iid, after tdroc119-sespppv-iid.R (every other quantity matched; Sp2 only where no
# event falls at t): the forms W(c2 neg) / (1 - W(a)) and W(c2 neg) / W(c2). (The header of tdroc119-sespppv-iid.R
# follows.)
# tdroc119-sespppv-iid.R: the iid representations of SeSpPPVNPV (1.19.0). Each quantity is written as a function of
# weighted totals W(f) = sum_i w_i f_i / n (w = a for cases, c1 / c2 for the controls of definitions (i) / (ii)), the
# totals' influence IF_k(W) = w_k f_k - W + sum_i w_i f_i q_k(i) / n with R's censoring term of tdroc119-iid5.R
# (q_k(i) for a weight 1 / G(T_i-): n ([k censored, T_i >= T_k, i != k] / #(T >= T_k) - sum_{p <= p_k, p < p_i}
# dL(p) / (n - p + 1)); for the weight 1 / G(t): the same with T_k <= t and the positions with T_p <= t), and the
# quantities' influence by the delta method (numerical gradient). Candidates:
#   Se = W(a pos) / W(a); Sp1 = 1 - W(c1 pos) / W(c1); Sp2 = 1 - W(c2 pos) / (1 - W(a)) (the "1 - F" form of
#   tdroc119-cr11.R) or 1 - W(c2 pos) / W(c2); PPV = W(a pos) / (W(a pos) + W(c2 pos)); NPV2 = W(c2 neg) / (W(c2 neg)
#   + W(a neg)); NPV1 = W(c1 neg) / (W(c2 neg) + W(a neg)); se = sd(iid) / sqrt(n).
# Data and cutpoints of tdroc119-sespppv.R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC) })
out <- list(R = R.version.string, arch = R.version$arch)
analyse <- function(T, delta, marker, cut, times) {
  n <- length(T)
  s <- SeSpPPVNPV(cutpoint = cut, T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, iid = TRUE)
  ut <- sort(unique(T))
  R_u <- sapply(ut, function(u) sum(T > u) + sum(T == u & delta == 0))
  Gs <- cumprod(1 - ifelse(R_u > 0, sapply(ut, function(u) sum(T == u & delta == 0)) / R_u, 0))
  G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
  o <- order(T); Ts <- T[o]; ds <- delta[o]; Ms <- marker[o]; pos <- seq_len(n)
  Rpos <- n - pos + 1; dLpos <- (ds == 0) / Rpos; Rtime <- sapply(Ts, function(v) sum(Ts >= v))
  qk <- function(k, i) n * (((ds[k] == 0) & Ts[i] >= Ts[k] & i != k) / Rtime[k] - sum((pos <= k & pos < i) * dLpos / Rpos))
  qkt <- function(k, t) n * (((ds[k] == 0) & Ts[k] <= t) / Rtime[k] - sum((pos <= k & Ts <= t) * dLpos / Rpos))
  res <- list()
  for (j in seq_along(times)) {
    t <- times[j]
    a <- (Ts < t & ds == 1) / G(Ts, TRUE); c1 <- (Ts > t) / G(t, FALSE); c2 <- c1 + (Ts < t & ds == 2) / G(Ts, TRUE)
    P <- Ms > cut
    f <- list(a = a, ap = a * P, an = a * !P, c1 = c1, c1p = c1 * P, c1n = c1 * !P, c2 = c2, c2p = c2 * P, c2n = c2 * !P)
    W <- sapply(f, function(v) sum(v) / n)
    Q <- sapply(pos, function(k) { qa <- sapply(pos, function(i) qk(k, i)); ifelse(Ts > t, qkt(k, t), qa) })   # Q[i, k]
    IFW <- sapply(f, function(v) sapply(pos, function(k) v[k] - sum(v) / n + sum(v * Q[, k]) / n))      # k x total
    quant <- list(
      Se = function(w) w[["ap"]] / w[["a"]], Sp1 = function(w) 1 - w[["c1p"]] / w[["c1"]],
      Sp2_1mF = function(w) 1 - w[["c2p"]] / (1 - w[["a"]]), Sp2_c2 = function(w) 1 - w[["c2p"]] / w[["c2"]],
      Sp2_neg1mF = function(w) w[["c2n"]] / (1 - w[["a"]]), Sp2_negc2 = function(w) w[["c2n"]] / w[["c2"]],
      PPV = function(w) w[["ap"]] / (w[["ap"]] + w[["c2p"]]), NPV2 = function(w) w[["c2n"]] / (w[["c2n"]] + w[["an"]]),
      NPV1 = function(w) w[["c1n"]] / (w[["c2n"]] + w[["an"]]))
    cand <- lapply(quant, function(g) {
      gr <- sapply(seq_along(W), function(m) { e <- 1e-7 * max(1, abs(W[m])); wp <- W; wm <- W; wp[m] <- W[m] + e; wm[m] <- W[m] - e
        if (W[m] - e < 0) { wm[m] <- W[m]; (g(wp) - g(wm)) / e } else (g(wp) - g(wm)) / (2 * e) })
      as.vector(IFW %*% gr)
    })
    res[[j]] <- list(cand = cand, cand_se = lapply(cand, function(v) sd(v) / sqrt(n)))
  }
  list(se = lapply(s$inference[grepl("^vect", names(s$inference))], unname),
       iid = lapply(s$inference[grepl("^mat", names(s$inference))], function(m) lapply(seq_len(ncol(m)), function(j) unname(m[, j]))),
       res = res)
}
set.seed(20261126)
n <- 40
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 0) + 1
delta <- as.numeric(ttrue <= cens)
out$single <- analyse(T, delta, marker, sort(unique(marker))[12], c(5, 10, 15))
set.seed(20261127)
n2 <- 50
m2 <- round(rnorm(n2), 1)
t1 <- rexp(n2, exp(0.8 * m2) / 12); t2 <- rexp(n2, 1 / 15); cc <- rexp(n2, 1 / 18)
T2 <- round(pmin(t1, t2, cc)) + 1
d2 <- ifelse(cc <= pmin(t1, t2), 0, ifelse(t1 <= t2, 1, 2))
out$cr <- analyse(T2, d2, m2, 0.3, c(4, 8, 12))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
