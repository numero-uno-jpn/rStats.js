# tdroc119-survivalroc8.R: survivalROC's NNE (1.19.0), after tdroc119-survivalroc7.R (no window rule could be read off
# the KM windows; R's S_i are simple fractions such as 3/4 and 9/14, larger than the neighbours' KM, and a subject
# censored at 0 counted at risk in tdroc119-survivalroc5.R). Candidate: the risk set of each neighbourhood not reduced by
# censoring, i.e. product over event times of (1 - d / (N - D_before)) = 1 - D / N, D the neighbours' events by t,
# N the neighbourhood's size; neighbourhoods |F_n(M_i) - F_n(M_j)| < w span, w = 1, 1/2, 2, and also the windows
# of +-k ranks, k = 1..8. (The header of tdroc119-survivalroc7.R follows.)
# tdroc119-survivalroc7.R: survivalROC's NNE (1.19.0). On a continuous marker (every cut a single subject), R's S(t)
# and each subject's S_i(t) recovered from consecutive TP / FP steps (dTP = (1 - S_i) / (n (1 - S)), dFP = S_i / (n S));
# then, for each subject, every window of the subjects sorted by marker, a below and b above (a, b = 0..n), whose
# KM at t equals R's S_i, to read the rule of the neighbourhoods. span = 0.25 n^(-0.2) as in the help's example.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261129)
n <- 30
marker <- rnorm(n)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 1) + 0.1
status <- as.numeric(ttrue <= cens)
pt <- 6; span <- 0.25 * n^(-0.2)
nne <- survivalROC(Stime = T, status = status, marker = marker, predict.time = pt, span = span)
dTP <- -diff(nne$TP); dFP <- -diff(nne$FP)
S <- (1 - n * dTP) / (n * dFP - n * dTP)
out$S_steps <- S
St <- median(S)
Si_R <- n * dFP * St                                 # subjects in the order of the sorted marker
o <- order(marker); Ts <- T[o]; ds <- status[o]
kmw <- function(idx) { tt <- Ts[idx]; dd <- ds[idx]; s <- 1
  for (u in sort(unique(tt[dd == 1 & tt <= pt]))) s <- s * (1 - sum(tt == u & dd == 1) / sum(tt >= u)); s }
Fs <- ecdf(marker)(marker)[o]
prop <- function(K) sapply(seq_len(n), function(i) 1 - sum(K[i, ] * (Ts <= pt & ds == 1)) / sum(K[i, ]))
grid <- list()
for (w in c(1, 0.5, 2)) for (strict in c(TRUE, FALSE)) {
  K <- outer(Fs, Fs, function(a, b) if (strict) abs(a - b) < w * span else abs(a - b) <= w * span)
  grid[[paste("Fn", w, strict, sep = ",")]] <- max(abs(prop(K) - Si_R))
}
for (k in 1:8) { K <- outer(seq_len(n), seq_len(n), function(a, b) abs(a - b) <= k); grid[[paste("rank", k, sep = ",")]] <- max(abs(prop(K) - Si_R)) }
out$grid <- grid
out$St <- St; out$span_n <- span * n
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
