# tdroc119-survivalroc4.R: survivalROC's NNE (1.19.0). From R's TP and FP of tdroc119-survivalroc.R, each one-subject
# step gives S(t) = 0.508503 (neither the KM 0.450 nor the candidates' means) and the subject's S_i(t) = n dFP S(t).
# Here the implied S_i next to candidate neighbourhoods written for this experiment: by the marker's value,
# |M_i - M_j| < span (or <=, or < span / 2), and by F_n as before; S_i the KM of the neighbours (unweighted).
# The data of tdroc119-survivalroc.R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(survivalROC) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261128)
n <- 30
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 1)
status <- as.numeric(ttrue <= cens)
pt <- 6; span <- 0.25 * n^(-0.2)
nne <- survivalROC(Stime = T, status = status, marker = marker, predict.time = pt, span = span)
u <- sort(unique(marker)); cnt <- as.vector(table(factor(marker, levels = u)))
dFP <- -diff(nne$FP); St <- 0.508503
out$implied <- list(value = u, count = cnt, groupSum = dFP * n * St)   # sum of S_i over the subjects at each value
ts <- sort(unique(T[status == 1 & T <= pt]))
Sfor <- function(K) sapply(seq_len(n), function(i) prod(sapply(ts, function(s) { y <- sum(K[i, ] * (T >= s)); if (y > 0) 1 - sum(K[i, ] * (T == s & status == 1)) / y else 1 })))
grp <- function(Si) sapply(u, function(v) sum(Si[marker == v]))
cands <- list(
  value_lt = outer(marker, marker, function(a, b) abs(a - b) < span),
  value_le = outer(marker, marker, function(a, b) abs(a - b) <= span),
  value_half = outer(marker, marker, function(a, b) abs(a - b) < span / 2),
  Fn_lt = { e <- ecdf(marker)(marker); outer(e, e, function(a, b) abs(a - b) < span) })
out$cand <- lapply(cands, function(K) { Si <- Sfor(K); list(group = grp(Si), mean = mean(Si)) })
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
