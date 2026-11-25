# tdroc119-sespppv2.R: after tdroc119-sespppv.R (TP, FP, PPV and NPV matched the Bayes forms, the competing-risks
# PPV and NPV_2 those of definition (ii); NPV_1 matched neither form; no cutpoint was a marker value): NPV_1 variants
# (1 - FP_1) S_1 / P(M <= c) with the empirical P, (1 - FP_1) S_1 / (1 - P(M > c)) with the IPCW P, ...; cutpoints
# equal to marker values (> or >=); the Stats column names. (The header of tdroc119-sespppv.R follows.)
# tdroc119-sespppv.R: timeROC's SeSpPPVNPV (marginal weights; single cause and competing risks; 1.19.0). The structure
# (fields, inference) and candidates written for this experiment, with the weights of tdroc119-basic3.R:
#   TP = sum_cases w [M > c] / sum_cases w (or [M >= c]); FP = the controls' weighted proportion above c;
#   PPV direct: sum_cases w [M > c] / #(M > c);  NPV direct: sum_controls w [M <= c] / #(M <= c);
#   PPV Bayes: TP F / (TP F + FP S), NPV Bayes: (1 - FP) S / ((1 - FP) S + (1 - TP) F), F, S as in the AUC.
# Data: tdroc119-basic.R's (single cause) and tdroc119-cr.R's (competing risks); cutpoints at a marker value and
# between values.
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
ut <- sort(unique(T))
Gfun <- function(T, delta) {
  ut <- sort(unique(T))
  R_u <- sapply(ut, function(u) sum(T > u) + sum(T == u & delta == 0))
  Gs <- cumprod(1 - ifelse(R_u > 0, sapply(ut, function(u) sum(T == u & delta == 0)) / R_u, 0))
  function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
}
cand <- function(T, delta, marker, cut, t, cr) {
  G <- Gfun(T, delta); n <- length(T)
  a <- (T < t & delta == 1) / G(T, TRUE)
  c1 <- (T > t) / G(t, FALSE)
  c2 <- c1 + (T < t & delta == 2) / G(T, TRUE)
  res <- list()
  for (ge in c(FALSE, TRUE)) {
    pos <- if (ge) marker >= cut else marker > cut
    TP <- sum(a * pos) / sum(a)
    cc <- if (cr) c2 else c1
    FP <- sum(c1 * pos) / sum(c1); FP2 <- sum(c2 * pos) / sum(c2)
    F <- sum(a) / n; S1 <- sum(c1) / n; S2 <- sum(c2) / n
    res[[if (ge) "ge" else "gt"]] <- list(TP = TP, FP = FP, FP2 = FP2,
      PPV_direct = sum(a * pos) / sum(pos), NPV_direct = sum(c1 * !pos) / sum(!pos), NPV2_direct = sum(c2 * !pos) / sum(!pos),
      PPV_bayes = TP * F / (TP * F + FP * S1), NPV_bayes = (1 - FP) * S1 / ((1 - FP) * S1 + (1 - TP) * F),
      PPV2_bayes = TP * F / (TP * F + FP2 * S2), NPV2_bayes = (1 - FP2) * S2 / ((1 - FP2) * S2 + (1 - TP) * F),
      NPV1_emp = (1 - FP) * S1 / mean(!pos), NPV1_s2den = (1 - FP) * S1 / ((1 - FP2) * S2 + (1 - TP) * F),
      NPV1_1mF = (1 - FP) * S1 / ((1 - FP) * S1 + (1 - TP) * F + (1 - FP2) * S2 - (1 - FP) * S1))
  }
  res
}
take <- function(s) {
  keep <- setdiff(names(s), c("weights", "computation_time"))
  lapply(s[keep], function(v) if (is.list(v)) lapply(v, function(u) if (is.matrix(u)) dim(u) else unname(u)) else unname(v))
}
out$single <- list()
for (cut in c(sort(unique(marker))[12], 0.35)) {
  s <- SeSpPPVNPV(cutpoint = cut, T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, iid = TRUE)
  out$single[[as.character(cut)]] <- list(names = names(s), class = class(s), res = take(s), inference_names = names(s$inference), Stats_dimnames = dimnames(s$Stats), cut_in_data = cut %in% marker,
                                         cand = lapply(times, function(t) cand(T, delta, marker, cut, t, FALSE)))
}
set.seed(20261127)
n2 <- 50
m2 <- round(rnorm(n2), 1)
t1 <- rexp(n2, exp(0.8 * m2) / 12); t2 <- rexp(n2, 1 / 15); cc <- rexp(n2, 1 / 18)
T2 <- round(pmin(t1, t2, cc)) + 1
d2 <- ifelse(cc <= pmin(t1, t2), 0, ifelse(t1 <= t2, 1, 2))
s <- SeSpPPVNPV(cutpoint = 0.3, T = T2, delta = d2, marker = m2, cause = 1, weighting = "marginal", times = c(4, 8, 12), iid = TRUE)
out$cr <- list(names = names(s), class = class(s), res = take(s), inference_names = names(s$inference), Stats_dimnames = dimnames(s$Stats),
               cand = lapply(c(4, 8, 12), function(t) cand(T2, d2, m2, 0.3, t, TRUE)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
