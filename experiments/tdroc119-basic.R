# tdroc119-basic.R: timeROC without competing risks, marginal (Kaplan-Meier) censoring weights (1.19.0), first
# experiment. The structure of the result (names, TP / FP rows, Stats, inference) and candidate IPCW formulas written
# for this experiment from the help and the papers it cites (Uno et al. 2007, Hung and Chiang 2010, Blanche et al. 2013):
#   G = the Kaplan-Meier estimator of the censoring distribution (censoring as the event);
#   case i: T_i <= t and delta_i = cause, weight 1 / G(T_i-) (candidate A) or 1 / G(T_i) (candidate B);
#   control j: T_j > t, weight 1 / G(t);
#   TP(c) = sum_cases w_i [M_i > c] / sum_cases w_i, FP(c) = #controls with M_j > c / #controls;
#   AUC = sum_i sum_j w_i w_j ([M_i > M_j] + [M_i = M_j] / 2) / (sum_i w_i sum_j w_j), and the trapezoid over (FP, TP).
#   Censoring ties with events at the same time: the censoring KM with censoring "after" the events (candidates A, B)
#   or "before" (candidate C, with A's left limit).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC) })
out <- list(R = R.version.string, arch = R.version$arch, timeROC = as.character(packageVersion("timeROC")))
set.seed(20261126)
n <- 40
marker <- round(rnorm(n), 1)                   # ties in the marker
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 0) + 1           # ties in the times, also between events and censorings
delta <- as.numeric(ttrue <= cens)
times <- c(5, 10, 15)
out$data <- list(T = T, delta = delta, marker = marker, times = times)

r <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, ROC = TRUE, iid = TRUE)
out$names <- names(r)
out$class <- class(r)
out$AUC <- unname(r$AUC)
out$TP <- unname(r$TP); out$FP <- unname(r$FP); out$TP_dim <- dim(r$TP)
out$times_out <- unname(r$times)
out$CumulativeIncidence <- unname(r$CumulativeIncidence)
out$survProb <- unname(r$survProb)
out$Stats <- unname(r$Stats); out$Stats_dimnames <- dimnames(r$Stats)
out$n <- r$n
out$inference_names <- names(r$inference)
out$inference_sd <- lapply(r$inference[grepl("sd|se", names(r$inference))], unname)
out$weights_names <- names(r$weights)
out$weights_class <- class(r$weights)
out$IPCW.times <- unname(r$weights$IPCW.times)
out$IPCW.subjectTimes <- unname(r$weights$IPCW.subjectTimes)
out$weights_method <- r$weights$method
r1 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, times = 10, ROC = TRUE, iid = FALSE)
out$single_time <- list(times = unname(r1$times), AUC = unname(r1$AUC), TP_dim = dim(r1$TP))

# candidates
km_cens <- function(after) {
  # censoring KM: with "after", events at a time come before censorings at that time (an event time is not a
  # censoring risk-set exit for the censorings); the survival curve of the censoring times
  ut <- sort(unique(T)); S <- 1; s <- numeric(length(ut))
  for (k in seq_along(ut)) {
    atrisk <- if (after) sum(T >= ut[k]) - 0 else sum(T >= ut[k])
    nc <- sum(T == ut[k] & delta == 0)
    ne <- sum(T == ut[k] & delta == 1)
    if (!after) atrisk <- atrisk                 # the same risk set; the variant changes only the left limit below
    S <- S * (1 - nc / atrisk); s[k] <- S
  }
  list(t = ut, s = s)
}
Gstep <- function(g, x, left) sapply(x, function(v) { k <- if (left) which(g$t < v) else which(g$t <= v); if (length(k)) g$s[max(k)] else 1 })
g <- km_cens(TRUE)
cand <- function(t, left) {
  case <- T <= t & delta == 1; ctrl <- T > t
  w <- 1 / Gstep(g, T[case], left)
  mc <- marker[case]; mj <- marker[ctrl]
  num <- sum(outer(seq_along(mc), seq_along(mj), function(a, b) w[a] * ((mc[a] > mj[b]) + 0.5 * (mc[a] == mj[b]))))
  auc <- num / (sum(w) * length(mj))
  cuts <- c(Inf, sort(unique(marker), decreasing = TRUE))
  tp <- sapply(cuts, function(c) sum(w * (mc > c)) / sum(w)); fp <- sapply(cuts, function(c) mean(mj > c))
  # the thresholds "marker > the k-th largest value" for k = 1..n_unique, then everyone positive
  cuts2 <- c(sort(unique(marker), decreasing = TRUE), -Inf)
  tp2 <- sapply(cuts2, function(c) sum(w * (mc > c)) / sum(w)); fp2 <- sapply(cuts2, function(c) mean(mj > c))
  trap <- sum(diff(fp2) * (head(tp2, -1) + tail(tp2, -1)) / 2)
  list(auc = auc, trap = trap, tp_inf_first = tp, fp_inf_first = fp, tp_k = tp2, fp_k = fp2,
       ncase = sum(case), nctrl = sum(ctrl), sumw = sum(w), Gt = Gstep(g, t, FALSE),
       F_ipcw = sum(w) / n, KM = { s <- survfit(Surv(T, delta) ~ 1); summary(s, times = t, extend = TRUE)$surv })
}
out$candA <- lapply(times, cand, left = TRUE)
out$candB <- lapply(times, cand, left = FALSE)
out$G <- g
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
