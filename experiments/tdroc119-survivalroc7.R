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
out$windows <- lapply(seq_len(n), function(i) {
  hits <- list()
  for (a in 0:(i - 1)) for (b in 0:(n - i)) if (abs(kmw((i - a):(i + b)) - Si_R[i]) < 1e-9) hits[[length(hits) + 1]] <- c(a, b)
  list(i = i, Si = Si_R[i], hits = hits)
})
out$St <- St; out$span_n <- span * n
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
