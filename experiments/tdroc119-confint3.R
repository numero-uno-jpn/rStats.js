# tdroc119-confint3.R: as tdroc119-confint2.R, the multiplier form: R's C.alpha moves much with the seed (2.264 with
# seed 1, 2.420 with seed 2), as a multiplier bootstrap over 40 subjects would. Z_t = sum_i xi_i X_it / (s_t d) with
# xi drawn per simulation (rnorm(n) in turn, i.e. an n x n.sim matrix by column) or all at once by row, X the iid
# columns centred or not, s_t their sd (n - 1) or root mean square, d = sqrt(n) or sqrt(n - 1).
# (The header of tdroc119-confint2.R follows.)
# tdroc119-confint2.R: the simultaneous band's C.alpha of timeROC's confint (1.19.0), after tdroc119-confint.R (R
# 2.264305 with set.seed(1), n.sim = 2000; the mvrnorm and multiplier candidates gave 2.30 to 2.44). Candidates written
# for this experiment: draws of N(0, C) (C the correlation of the iid columns) as rnorm(n.sim * p) filled by row (or
# by column) times the symmetric square root V diag(sqrt(lambda)) V' (or the Cholesky factor), then the quantile (types
# 7, 1, 8) of max_t |Z_t| (or of max_t Z_t). The same data and markers as tdroc119-confint.R.
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
r1 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, iid = TRUE)
set.seed(1); out$R_alpha <- unname(confint(r1)$C.alpha)
set.seed(2); out$R_alpha_seed2 <- unname(confint(r1)$C.alpha)
iid1 <- r1$inference$mat_iid_rep_1
C <- cor(iid1); p <- ncol(C)
ev <- eigen(C, symmetric = TRUE)
Rsym <- ev$vectors %*% diag(sqrt(pmax(ev$values, 0))) %*% t(ev$vectors)
Rchol <- chol(C)
res <- list()
for (fill in c("col", "row")) for (centre in c(TRUE, FALSE)) for (sdk in c("sd", "rms")) for (dk in c("n", "n1")) {
  set.seed(1)
  xi <- if (fill == "col") matrix(rnorm(n * 2000), n, 2000) else matrix(rnorm(n * 2000), n, 2000, byrow = TRUE)
  X <- if (centre) scale(iid1, center = TRUE, scale = FALSE) else iid1
  s_t <- if (sdk == "sd") apply(iid1, 2, sd) else apply(iid1, 2, function(v) sqrt(mean(v^2)))
  d <- if (dk == "n") sqrt(n) else sqrt(n - 1)
  Z <- t(t(X) %*% xi) / d / matrix(s_t, 2000, p, byrow = TRUE)
  m <- apply(abs(Z), 1, max)
  res[[paste(fill, centre, sdk, dk, sep = ",")]] <- unname(quantile(m, 0.95))
}
out$cand <- res
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
