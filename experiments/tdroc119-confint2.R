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
for (fill in c("row", "col")) for (root in c("sym", "chol")) {
  set.seed(1)
  Z <- matrix(rnorm(2000 * p), nrow = 2000, byrow = fill == "row") %*% (if (root == "sym") Rsym else Rchol)
  for (stat in c("abs", "max")) {
    m <- if (stat == "abs") apply(abs(Z), 1, max) else apply(Z, 1, max)
    for (ty in c(7, 1, 8)) res[[paste(fill, root, stat, ty, sep = ",")]] <- unname(quantile(m, 0.95, type = ty))
  }
}
out$cand <- res
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
