# tdroc119-edge2.R: after tdroc119-edge.R (1.19.0): (1) survivalROC's last cut: tdroc119-survivalroc9.R gave (0, 0) at
# the last of several given cuts, tdroc119-edge.R computed a single given cut 0 normally; here single cuts 1.0 and 1.5,
# pairs, and the subsets' sizes and Kaplan-Meier at predict.time (candidate: the point is (0, 0) when the subset above
# the cut has no subject at risk at predict.time, or its KM is 0); (2) survivalROC with predict.time before the first
# time (Survival 0.95 in tdroc119-edge.R); (3) timeROC's aalen weights on the data without ties with the marker only,
# a collinear other marker, a constant other marker.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch)
make <- function(seed, n, cr, ties) {
  set.seed(seed)
  marker <- round(rnorm(n), if (ties) 1 else 6)
  other <- round(marker + rnorm(n), 6)
  t1 <- rexp(n, exp(0.8 * marker) / 10); t2 <- rexp(n, 1 / 15); cc <- rexp(n, 1 / 15)
  tt <- if (cr) pmin(t1, t2, cc) else pmin(t1, cc)
  T <- if (ties) round(tt) + 1 else round(tt, 6) + 0.5
  delta <- if (cr) ifelse(cc <= pmin(t1, t2), 0, ifelse(t1 <= t2, 1, 2)) else as.numeric(t1 <= cc)
  list(T = T, delta = delta, marker = marker, other = other)
}
s <- make(20261202, 45, FALSE, FALSE)
d <- make(20261201, 40, FALSE, TRUE)
pt <- 6.3
sr <- function(cuts) { r <- survivalROC(Stime = s$T, status = s$delta, marker = s$marker, predict.time = pt, method = "KM", cut.values = cuts); list(cut = unname(r$cut.values), TP = unname(r$TP), FP = unname(r$FP)) }
sub <- function(c) { sel <- s$marker > c; km <- if (any(sel)) { f <- survfit(Surv(s$T[sel], s$delta[sel]) ~ 1); v <- f$surv[f$time <= pt]; if (length(v)) tail(v, 1) else 1 } else NA
  list(c = c, above = sum(sel), atRiskAtPt = sum(sel & s$T > pt), km = km) }
out$cuts <- list(c10 = sr(1.0), c15 = sr(1.5), c0_10 = sr(c(0, 1.0)), c10_30 = sr(c(1.0, 3)), c0_05 = sr(c(0, 0.5)), c05_0 = sr(c(0.5, 0)), c0_0 = sr(c(0, 0)))
out$subsets <- lapply(c(0, 0.5, 1.0, 1.5, 3), sub)
out$beforeFirst <- { r <- survivalROC(Stime = d$T, status = d$delta, marker = d$marker, predict.time = 0.5, method = "KM"); list(Survival = r$Survival, AUC = r$AUC, TP = unname(r$TP[1:4]), FP = unname(r$FP[1:4])) }
out$firstTimes <- list(min = min(d$T), eventsAtMin = sum(d$T == min(d$T) & d$delta == 1), n = length(d$T))
out$beforeFirst2 <- { r <- survivalROC(Stime = d$T, status = d$delta, marker = d$marker, predict.time = 1, method = "KM"); list(Survival = r$Survival) }
ta <- function(...) unname(timeROC(T = s$T, delta = s$delta, marker = s$marker, cause = 1, times = c(4.1, 8.3), weighting = "aalen", ...)$AUC)
out$aalen <- list(markerOnly = ta(), collinear = ta(other_markers = as.matrix(2 * s$marker)), constant = ta(other_markers = as.matrix(rep(1, 45))),
                  marginal = unname(timeROC(T = s$T, delta = s$delta, marker = s$marker, cause = 1, times = c(4.1, 8.3))$AUC),
                  unweighted = sapply(c(4.1, 8.3), function(t) { isCase <- s$T < t & s$delta == 1; isCtrl <- s$T > t; mean(outer(s$marker[isCase], s$marker[isCtrl], function(a, b) (a > b) + 0.5 * (a == b))) }))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
