# mediation116.R: MASS's mvrnorm and mediation's mediate (quasi-Bayesian, boot = FALSE) under set.seed, public
# functions only (1.16.0). Settles: how mvrnorm turns R's normal draws into multivariate ones (the decomposition, the
# order of the draws, the signs of the eigenvectors), and how mediate uses the generator for lm / lm models with a
# continuous and a binary treatment (which parameter draws, in which order, and what else it draws).
# Candidate formulas are written here and compared with the output; nothing reads the packages' code.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(R = R.version.string, arch = R.version$arch, MASS = as.character(packageVersion("MASS")),
            mediation = as.character(packageVersion("mediation")))

## 1. mvrnorm: candidate = mu + V diag(sqrt(lambda)) Z' with Z an n x p matrix of rnorm filled by column
cand_mvr <- function(n, mu, S) {
  p <- length(mu); e <- eigen(S, symmetric = TRUE)
  Z <- matrix(rnorm(n * p), n)
  t(mu + e$vectors %*% diag(sqrt(pmax(e$values, 0)), p) %*% t(Z))
}
cand_mvr_rowwise <- function(n, mu, S) {
  p <- length(mu); e <- eigen(S, symmetric = TRUE)
  Z <- matrix(rnorm(n * p), n, byrow = TRUE)
  t(mu + e$vectors %*% diag(sqrt(pmax(e$values, 0)), p) %*% t(Z))
}
sigmas <- list(
  p2 = matrix(c(2, 0.6, 0.6, 1), 2),
  p2neg = matrix(c(1, -0.8, -0.8, 3), 2),
  p3 = matrix(c(4, 1, 0.5, 1, 2, -0.3, 0.5, -0.3, 1), 3),
  p5 = { set.seed(7); A <- matrix(rnorm(25), 5); crossprod(A) + diag(5) },
  p2diag = diag(c(1, 4)),
  p3singular = { v <- c(1, 2, 3); tcrossprod(v) })
out$mvrnorm <- lapply(names(sigmas), function(nm) {
  S <- sigmas[[nm]]; p <- nrow(S); mu <- seq_len(p) / 10; n <- 7
  set.seed(42); got <- mvrnorm(n, mu, S)
  set.seed(42); c1 <- cand_mvr(n, mu, S)
  set.seed(42); c2 <- cand_mvr_rowwise(n, mu, S)
  set.seed(42); one <- mvrnorm(1, mu, S)
  set.seed(42); c1one <- cand_mvr(1, mu, S)
  e <- eigen(S, symmetric = TRUE)
  list(name = nm, Sigma = S, got = got, eigen_values = e$values, eigen_vectors = e$vectors,
       diff_colwise = max(abs(got - c1)), diff_rowwise = max(abs(got - c2)),
       one = one, diff_one = max(abs(one - c1one)), dimnames_got = dimnames(got))
})
names(out$mvrnorm) <- names(sigmas)
# names of mu become column names; empirical = TRUE
set.seed(42); out$mvrnorm_named <- mvrnorm(3, c(a = 1, b = 2), sigmas$p2)
set.seed(42); out$mvrnorm_empirical <- run(mvrnorm(5, c(0, 0), sigmas$p2, empirical = TRUE))
# a non positive definite Sigma
out$mvrnorm_notpd <- run(mvrnorm(2, c(0, 0), matrix(c(1, 2, 2, 1), 2)))

## 2. mediate with lm / lm
set.seed(20261125)
n <- 60
C <- rnorm(n)
X <- rnorm(n, 5, 2)
Xb <- rbinom(n, 1, 0.5)
M <- 0.5 * X + 0.3 * C + rnorm(n)
Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Y <- 0.4 * M + 0.2 * X - 0.2 * C + rnorm(n)
Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
d <- data.frame(C, X, Xb, M, Mb, Y, Yb)
assign("d", d, envir = globalenv())
fm <- lm(M ~ X + C, data = d)
fy <- lm(Y ~ X + M + C, data = d)
sims <- 50
cx <- mean(X) - sd(X); tx <- mean(X) + sd(X)

med_parts <- function(r) list(
  d0 = r$d0, d1 = r$d1, z0 = r$z0, z1 = r$z1, tau = r$tau.coef, n0 = r$n0, n1 = r$n1, d.avg = r$d.avg,
  z.avg = r$z.avg, n.avg = r$n.avg, d0.ci = r$d0.ci, d1.ci = r$d1.ci, z0.ci = r$z0.ci, tau.ci = r$tau.ci,
  n0.ci = r$n0.ci, d0.p = r$d0.p, d1.p = r$d1.p, z0.p = r$z0.p, tau.p = r$tau.p, n0.p = r$n0.p,
  d0.sims = as.vector(r$d0.sims), d1.sims = as.vector(r$d1.sims), z0.sims = as.vector(r$z0.sims),
  z1.sims = as.vector(r$z1.sims), tau.sims = as.vector(r$tau.sims), n0.sims = as.vector(r$n0.sims),
  boot = r$boot, boot.ci.type = r$boot.ci.type, treat.value = r$treat.value, control.value = r$control.value,
  conf.level = r$conf.level, sims = r$sims, robustSE = r$robustSE, INT = r$INT, names = names(r))

set.seed(1234)
r1 <- mediate(fm, fy, treat = "X", mediator = "M", control.value = cx, treat.value = tx, boot = FALSE, sims = sims)
state_after <- .Random.seed
out$mediate_lm_cont <- med_parts(r1)

# candidate: the mediator model's draws, then the outcome model's draws
set.seed(1234)
A <- mvrnorm(sims, coef(fm), vcov(fm))
B <- mvrnorm(sims, coef(fy), vcov(fy))
state_AB <- .Random.seed
acme_AB <- A[, "X"] * B[, "M"] * (tx - cx)
ade_AB <- B[, "X"] * (tx - cx)
set.seed(1234)
B2 <- mvrnorm(sims, coef(fy), vcov(fy))
A2 <- mvrnorm(sims, coef(fm), vcov(fm))
acme_BA <- A2[, "X"] * B2[, "M"] * (tx - cx)
out$mediate_lm_cont_candidates <- list(
  diff_acme_AB = max(abs(as.vector(r1$d0.sims) - acme_AB)), diff_ade_AB = max(abs(as.vector(r1$z0.sims) - ade_AB)),
  diff_acme_BA = max(abs(as.vector(r1$d0.sims) - acme_BA)),
  state_same_after_AB = identical(state_after, state_AB))
# how many further normal or uniform draws bring the generator from state_AB to the state after mediate
count_draws <- function(start_seed, target, draw, limit) {
  set.seed(start_seed); invisible(mvrnorm(sims, coef(fm), vcov(fm))); invisible(mvrnorm(sims, coef(fy), vcov(fy)))
  if (identical(.Random.seed, target)) return(0)
  for (k in seq_len(limit)) { draw(); if (identical(.Random.seed, target)) return(k) }
  NA
}
out$mediate_lm_cont_extra_normals <- count_draws(1234, state_after, function() rnorm(1), 3 * sims * n)
out$mediate_lm_cont_extra_uniforms <- count_draws(1234, state_after, function() runif(1), 6 * sims * n)

# binary treatment, default treat.value = 1 and control.value = 0
fmb <- lm(Mb ~ Xb + C, data = d)
fyb <- lm(Yb ~ Xb + Mb + C, data = d)
set.seed(1234)
r2 <- mediate(fmb, fyb, treat = "Xb", mediator = "Mb", boot = FALSE, sims = sims)
state_after2 <- .Random.seed
out$mediate_lm_bin <- med_parts(r2)
set.seed(1234)
A <- mvrnorm(sims, coef(fmb), vcov(fmb))
B <- mvrnorm(sims, coef(fyb), vcov(fyb))
out$mediate_lm_bin_candidates <- list(
  diff_acme_AB = max(abs(as.vector(r2$d0.sims) - A[, "Xb"] * B[, "Mb"])),
  diff_ade_AB = max(abs(as.vector(r2$z0.sims) - B[, "Xb"])),
  state_same_after_AB = identical(state_after2, .Random.seed))

# the interaction of treatment and mediator in the outcome model (d0 != d1)
fyi <- lm(Yb ~ Xb * Mb + C, data = d)
set.seed(1234)
r3 <- mediate(fmb, fyi, treat = "Xb", mediator = "Mb", boot = FALSE, sims = sims)
out$mediate_lm_int <- med_parts(r3)
set.seed(1234)
A <- mvrnorm(sims, coef(fmb), vcov(fmb))
B <- mvrnorm(sims, coef(fyi), vcov(fyi))
out$mediate_lm_int_candidates <- list(
  diff_d0 = max(abs(as.vector(r3$d0.sims) - A[, "Xb"] * B[, "Mb"])),
  diff_d1 = max(abs(as.vector(r3$d1.sims) - A[, "Xb"] * (B[, "Mb"] + B[, "Xb:Mb"]))),
  state_same_after_AB = identical(.Random.seed, { set.seed(1234); r3b <- mediate(fmb, fyi, treat = "Xb",
    mediator = "Mb", boot = FALSE, sims = sims); .Random.seed }))

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
