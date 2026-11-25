# tdroc119-cox.R: timeROC with weighting = "cox" and "aalen" (1.19.0), first experiment. The weights' structure
# (IPCW.times, IPCW.subjectTimes, method, fit) and candidates written for this experiment for the Cox weights:
#   G(s | Z_i) from survival's coxph of the censoring, Surv(T, delta == 0) ~ marker (+ other_markers), predicted by
#   survfit (ties "efron" or "breslow"), at T_i- or T_i for the subjects and at t for the times;
#   then the AUC and TP / FP with those weights (cases 1 / G(T_i- | Z_i), controls 1 / G(t | Z_j), weighted).
# The data of tdroc119-basic.R, with one other marker.
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
other <- round(marker + rnorm(n), 1)
rc <- timeROC(T = T, delta = delta, marker = marker, other_markers = as.matrix(other), cause = 1, weighting = "cox", times = times)
rc0 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "cox", times = times)
ra <- tryCatch(timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "aalen", times = times), error = function(e) conditionMessage(e))
out$cox <- list(AUC = unname(rc$AUC), names_w = names(rc$weights), method = rc$weights$method,
                IPCW.times = unname(rc$weights$IPCW.times), IPCW.dim = dim(rc$weights$IPCW.times),
                IPCW.subjectTimes = unname(rc$weights$IPCW.subjectTimes), fit_class = class(rc$weights$fit),
                TP = lapply(1:3, function(j) unname(rc$TP[, j])), FP = lapply(1:3, function(j) unname(rc$FP[, j])))
out$cox0 <- list(AUC = unname(rc0$AUC), IPCW.times = unname(rc0$weights$IPCW.times), IPCW.subjectTimes = unname(rc0$weights$IPCW.subjectTimes))
out$aalen <- if (is.character(ra)) list(error = ra) else list(AUC = unname(ra$AUC), IPCW.times = unname(ra$weights$IPCW.times),
  IPCW.subjectTimes = unname(ra$weights$IPCW.subjectTimes), fit_class = class(ra$weights$fit))
out$cox_iid <- tryCatch({ x <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "cox", times = times, iid = TRUE); "ran" },
                        error = function(e) conditionMessage(e), warning = function(w) conditionMessage(w))
o <- order(T)
cand <- list()
for (ties in c("efron", "breslow")) for (cov in c("both", "marker")) {
  d <- data.frame(T, cd = as.numeric(delta == 0), marker, other)
  f <- if (cov == "both") coxph(Surv(T, cd) ~ marker + other, data = d, ties = ties) else coxph(Surv(T, cd) ~ marker, data = d, ties = ties)
  sf <- survfit(f, newdata = d)
  at <- function(s, left) { k <- if (left) which(sf$time < s) else which(sf$time <= s); if (length(k)) sf$surv[max(k), ] else rep(1, n) }
  Gt <- sapply(times, function(t) at(t, FALSE))                          # n x times
  Gsub_left <- sapply(seq_len(n), function(i) at(T[i], TRUE)[i])
  Gsub_right <- sapply(seq_len(n), function(i) at(T[i], FALSE)[i])
  cand[[paste(ties, cov, sep = ",")]] <- list(Gt = Gt, Gsub_left_sorted = Gsub_left[o], Gsub_right_sorted = Gsub_right[o],
                                              Gsub_left = Gsub_left, coef = unname(coef(f)))
}
out$cand <- cand
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
