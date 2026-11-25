# tdroc119-basic2.R: what tdroc119-basic.R left open (1.19.0). timeROC's Stats counted 17 cases at t = 5 where
# "T <= t and delta = 1" gives 18, and one more censored subject: an event at exactly T = t is not a case. Candidates:
#   cases T < t (strict) or T <= t; case weights 1 / G(T_i-) or 1 / G(T_i); control weight 1 / G(t) or 1 / G(t-);
#   the censoring KM with all subjects at risk at their time; CumulativeIncidence = sum of case weights / n,
#   1 - KM(t), 1 - KM(t-).
# The same data as tdroc119-basic.R (same seed and steps).
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
out$AUC <- unname(r$AUC); out$CumInc <- unname(r$CumulativeIncidence); out$Stats <- unname(r$Stats)
out$TPcol <- lapply(1:3, function(j) unname(r$TP[, j])); out$FPcol <- lapply(1:3, function(j) unname(r$FP[, j]))
out$IPCW.times <- unname(r$weights$IPCW.times); out$IPCW.subjectTimes <- unname(r$weights$IPCW.subjectTimes)
out$at_t <- sapply(times, function(t) c(events_at_t = sum(T == t & delta == 1), cens_at_t = sum(T == t & delta == 0)))

# the censoring KM (censoring as the event), all subjects with T >= u at risk at u
ut <- sort(unique(T)); S <- 1; Gs <- numeric(length(ut))
for (k in seq_along(ut)) { S <- S * (1 - sum(T == ut[k] & delta == 0) / sum(T >= ut[k])); Gs[k] <- S }
G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
out$G_subject_left <- G(T, TRUE); out$G_subject_right <- G(T, FALSE)
out$G_times <- G(times, FALSE); out$G_times_left <- G(times, TRUE)
km <- survfit(Surv(T, delta) ~ 1)
KMat <- function(t, left) { s <- km$surv[km$time < t | (!left & km$time == t)]; if (length(s)) tail(s, 1) else 1 }
cand <- function(t, strict, left) {
  case <- (if (strict) T < t else T <= t) & delta == 1; ctrl <- T > t
  w <- 1 / G(T[case], left)
  mc <- marker[case]; mj <- marker[ctrl]
  auc <- sum(outer(seq_along(mc), seq_along(mj), function(a, b) w[a] * ((mc[a] > mj[b]) + 0.5 * (mc[a] == mj[b])))) /
    (sum(w) * length(mj))
  cuts <- c(sort(unique(marker), decreasing = TRUE), -Inf)
  list(auc = auc, ncase = sum(case), tp = sapply(cuts, function(c) sum(w * (mc > c)) / sum(w)),
       fp = sapply(cuts, function(c) mean(mj > c)), cuminc_w = sum(w) / n)
}
out$cand <- list()
for (strict in c(TRUE, FALSE)) for (left in c(TRUE, FALSE)) {
  out$cand[[paste0("strict=", strict, ",left=", left)]] <- lapply(times, cand, strict = strict, left = left)
}
out$KM <- list(right = sapply(times, KMat, left = FALSE), left = sapply(times, KMat, left = TRUE))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
