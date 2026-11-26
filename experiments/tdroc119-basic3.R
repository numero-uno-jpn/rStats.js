# tdroc119-basic3.R: the censoring weights of timeROC (1.19.0), after tdroc119-basic2.R: cases are T < t (Stats
# agreed), controls T > t (FP agreed), but the weights did not: IPCW.times (G at t) 0.5887 where the censoring KM with
# everyone at risk at their time gives 0.6306. Candidates for G: the censoring KM with the subjects who have an event
# at u removed from the risk set at u (events before censorings; candidate E), and IPCW.subjectTimes in the order of
# the sorted times. The same data as tdroc119-basic.R.
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
out$AUC <- unname(r$AUC); out$CumInc <- unname(r$CumulativeIncidence)
out$TPcol <- lapply(1:3, function(j) unname(r$TP[, j]))
out$IPCW.times <- unname(r$weights$IPCW.times); out$IPCW.subjectTimes <- unname(r$weights$IPCW.subjectTimes)
ut <- sort(unique(T))
kmG <- function(eventsFirst) {
  S <- 1; s <- numeric(length(ut))
  for (k in seq_along(ut)) {
    atrisk <- sum(T > ut[k]) + sum(T == ut[k] & (delta == 0 | !eventsFirst))
    S <- S * (1 - sum(T == ut[k] & delta == 0) / atrisk); s[k] <- S
  }
  s
}
Gs <- list(D = kmG(FALSE), E = kmG(TRUE))
G <- function(s, x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) s[max(k)] else 1 })
o <- order(T)
out$cand <- list()
for (nm in names(Gs)) for (left in c(TRUE, FALSE)) {
  s <- Gs[[nm]]
  key <- paste0(nm, ",left=", left)
  Gsub <- G(s, T, left)
  res <- lapply(times, function(t) {
    case <- T < t & delta == 1; ctrl <- T > t
    w <- 1 / Gsub[case]
    mc <- marker[case]; mj <- marker[ctrl]
    auc <- sum(outer(seq_along(mc), seq_along(mj), function(a, b) w[a] * ((mc[a] > mj[b]) + 0.5 * (mc[a] == mj[b])))) /
      (sum(w) * length(mj))
    cuts <- c(sort(unique(marker), decreasing = TRUE), -Inf)
    list(auc = auc, tp = sapply(cuts, function(c) sum(w * (mc > c)) / sum(w)), cuminc = sum(w) / n)
  })
  out$cand[[key]] <- list(res = res, Gt = G(s, times, FALSE), Gt_left = G(s, times, TRUE),
                          sub_data_order = Gsub, sub_sorted = Gsub[o])
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
