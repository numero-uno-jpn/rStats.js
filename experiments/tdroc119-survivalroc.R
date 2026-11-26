# tdroc119-survivalroc.R: survivalROC's KM and NNE estimators (1.19.0), first experiment. The structure of the result
# and candidates written for this experiment from the help and Heagerty, Lumley and Pepe (2000):
#   S(c, t) = P(M > c, T > t); TP(c) = (P(M > c) - S(c, t)) / (1 - S(t)); FP(c) = S(c, t) / S(t); S(t) = S(-Inf, t);
#   KM: S(c, t) = KM_{M > c}(t) P(M > c) (the KM of the subjects with M > c, P the empirical proportion), S(t) the KM;
#   NNE: S(c, t) = sum_i S_i(t) [M_i > c] / n, S_i(t) = prod_{s <= t} (1 - sum_j K_ij dN_j(s) / sum_j K_ij Y_j(s)), K_ij =
#   [|F_n(M_i) - F_n(M_j)| < span] (or <=), F_n the empirical distribution of the marker (with ties: the max rank);
#   AUC the trapezoid over (FP, TP) with the points in the order of cut.values, closed at (0, 0) and (1, 1).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch, survivalROC = as.character(packageVersion("survivalROC")))
set.seed(20261128)
n <- 30
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 1)
status <- as.numeric(ttrue <= cens)
pt <- 6
km <- survivalROC(Stime = T, status = status, marker = marker, predict.time = pt, method = "KM")
nne <- survivalROC(Stime = T, status = status, marker = marker, predict.time = pt, span = 0.25 * n^(-0.2))
out$km <- lapply(km, unname); out$km_names <- names(km)
out$nne <- lapply(nne, unname)
out$span <- 0.25 * n^(-0.2)
KMt <- function(Ts, ds, t) { if (!length(Ts)) return(NA); s <- survfit(Surv(Ts, ds) ~ 1); v <- s$surv[s$time <= t]; if (length(v)) tail(v, 1) else 1 }
cand_km <- function(cuts) {
  St <- KMt(T, status, pt)
  r <- t(sapply(cuts, function(c) { sel <- marker > c; p <- mean(sel); Sc <- if (p > 0) KMt(T[sel], status[sel], pt) * p else 0
    c(TP = (p - Sc) / (1 - St), FP = Sc / St) }))
  list(St = St, TP = r[, "TP"], FP = r[, "FP"])
}
out$cand_km <- cand_km(km$cut.values)
Fn <- ecdf(marker)
nne_S <- function(span, strict) {
  u <- Fn(marker)
  K <- outer(u, u, function(a, b) if (strict) abs(a - b) < span else abs(a - b) <= span)
  ts <- sort(unique(T[status == 1 & T <= pt]))
  # (replaced: 0 / 0 where no neighbour is at risk gave NaN; such times are skipped)
  Si <- sapply(seq_len(n), function(i) prod(sapply(ts, function(s) { y <- sum(K[i, ] * (T >= s)); if (y > 0) 1 - sum(K[i, ] * (T == s & status == 1)) / y else 1 })))
  Si
}
trap <- function(fp, tp) { o <- order(fp, tp); x <- c(0, fp[o], 1); y <- c(0, tp[o], 1); sum(diff(x) * (head(y, -1) + tail(y, -1)) / 2) }
out$cand_nne <- list()
for (strict in c(TRUE, FALSE)) {
  Si <- nne_S(out$span, strict); St <- mean(Si)
  r <- t(sapply(nne$cut.values, function(c) { Sc <- sum(Si * (marker > c)) / n; p <- mean(marker > c); c(TP = (p - Sc) / (1 - St), FP = Sc / St) }))
  out$cand_nne[[paste0("strict=", strict)]] <- list(St = St, TP = r[, "TP"], FP = r[, "FP"], auc = trap(r[, "FP"], r[, "TP"]))
}
out$cand_km_auc <- trap(out$cand_km$FP, out$cand_km$TP)
out$km_auc_inorder <- { x <- km$FP; y <- km$TP; sum(abs(diff(x)) * (head(y, -1) + tail(y, -1)) / 2) }
# (replaced: the call without span or lambda printed its message to stdout, which broke the JSON; now captured)
# (replaced again: it is an error whose message is "0", after the text printed to stdout)
msg <- capture.output(err <- tryCatch(survivalROC(Stime = T, status = status, marker = marker, predict.time = pt), error = function(e) conditionMessage(e)))
out$errors <- list(no_span_output = msg, no_span_error = err)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
