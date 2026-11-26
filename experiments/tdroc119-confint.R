# tdroc119-confint.R: confint and compare of timeROC (marginal weights, no competing risks; 1.19.0), after the iid
# representation of tdroc119-iid5.R. Candidates written for this experiment:
#   CI_AUC = 100 (AUC -+ qnorm((1 + level) / 2) sd), sd = vect_sd_1 (ReactiveStat's note: percent units);
#   CB_AUC = 100 (AUC -+ C.alpha sd), C.alpha = the level quantile of max_t |Z_t| over n.sim simulations, with
#     (a) Z = draws of mvrnorm(n.sim, 0, correlation of the iid columns), (b) Z = draws of the multiplier form
#     Z_t = sum_i xi_i iid_it / (sqrt(n - 1) sd_t sqrt(n))... (c) rnorm(n.sim * n) as xi, (d) mvrnorm with the
#     covariance; each after set.seed(1) before confint (and the same seed before the candidates);
#   compare: z_t = (AUC1_t - AUC2_t) / (sd(iid1_t - iid2_t) / sqrt(n)), p = 2 (1 - pnorm(|z|)); adjusted: the
#     correlation of the differences' iid columns.
# Two markers on the data of tdroc119-basic.R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(timeROC); library(MASS) })
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261126)
n <- 40
marker <- round(rnorm(n), 1)
ttrue <- rexp(n, exp(0.8 * marker) / 10)
cens <- rexp(n, 1 / 15)
T <- round(pmin(ttrue, cens), 0) + 1
delta <- as.numeric(ttrue <= cens)
times <- c(5, 10, 15)
marker2 <- round(marker + rnorm(n, 0, 1), 1)
r1 <- timeROC(T = T, delta = delta, marker = marker, cause = 1, weighting = "marginal", times = times, iid = TRUE)
r2 <- timeROC(T = T, delta = delta, marker = marker2, cause = 1, weighting = "marginal", times = times, iid = TRUE)
set.seed(1); ci <- confint(r1)
out$confint <- list(names = names(ci), CI = unname(ci$CI_AUC), CB = unname(ci$CB_AUC), C.alpha = unname(ci$C.alpha),
                    dimnames = dimnames(ci$CI_AUC))
set.seed(1); ci90 <- confint(r1, level = 0.9, n.sim = 500)
out$confint90 <- list(CI = unname(ci90$CI_AUC), C.alpha = unname(ci90$C.alpha))
sd1 <- r1$inference$vect_sd_1; iid1 <- r1$inference$mat_iid_rep_1
out$cand_CI <- cbind(100 * (r1$AUC - qnorm(0.975) * sd1), 100 * (r1$AUC + qnorm(0.975) * sd1))
cor1 <- cor(iid1)
quantmax <- function(Z) quantile(apply(abs(Z), 1, max), 0.95)
set.seed(1); out$cand_alpha_a <- unname(quantmax(mvrnorm(2000, rep(0, 3), cor1)))
set.seed(1); out$cand_alpha_d <- unname(quantmax(mvrnorm(2000, rep(0, 3), cov(iid1)) / matrix(apply(iid1, 2, sd), 2000, 3, byrow = TRUE)))
set.seed(1); xi <- matrix(rnorm(2000 * n), 2000, n)
std <- scale(iid1, center = TRUE, scale = FALSE)
out$cand_alpha_c <- unname(quantmax((xi %*% std) / sqrt(n - 1) / matrix(apply(iid1, 2, sd), 2000, 3, byrow = TRUE)))
set.seed(1); xi2 <- matrix(rnorm(2000 * n), n, 2000)
out$cand_alpha_c2 <- unname(quantmax(t(t(std) %*% xi2) / sqrt(n - 1) / matrix(apply(iid1, 2, sd), 2000, 3, byrow = TRUE)))

cmp <- compare(r1, r2)
cmpa <- compare(r1, r2, adjusted = TRUE)
out$compare <- list(names = names(cmp), p = lapply(cmp, unname), names_adj = names(cmpa), adj = lapply(cmpa, function(x) unname(x)))
dif <- r1$inference$mat_iid_rep_1 - r2$inference$mat_iid_rep_1
z <- (r1$AUC - r2$AUC) / (apply(dif, 2, sd) / sqrt(n))
out$cand_p <- 2 * pnorm(-abs(z)); out$cand_z <- z; out$cand_cor <- cor(dif)
out$AUC <- list(r1$AUC, r2$AUC)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
