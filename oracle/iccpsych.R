# oracle-memory: 1g
source("/oracle/_htest.R")

# The six intraclass correlations of Shrout and Fleiss: psych::ICC(x, missing = TRUE, alpha = 0.05, lmer = TRUE,
# check.keys = FALSE) (fixture iccPsych). See oracle/methodcomparison-behaviour.md, section 3.
#
# Arguments: x (n subjects × k raters, as rows; "NA" for a missing rating), and where given alpha, lmer, missing.
# Expected:
#   results   one entry per type (ICC1, ICC2, ICC3, ICC1k, ICC2k, ICC3k): [ICC, F, df1, df2, p, lower bound,
#             upper bound]
#   stats     psych's table: rows df, SumSq, MS, F, p; each [subjects, Judges, Residual] ("NA" where empty)
#   MSW       the within-subject mean square used by ICC1 and ICC1k
#   lme       (lmer = TRUE only) the variance components [ID, Items, Residual, Total] and their Percent
#   n.obs, n.judge
#   warnings  R's warnings; messages: R's messages (psych's "Warning, missing data ..." and lme4's "boundary
#             (singular) fit: ..." are messages, not warnings)
# Errors as {"error": message}.
#
# Reference (refKind):
#   "anova"  complete data: the mean squares as exact rationals (gmp, from the doubles), the coefficients and F
#            values from them, p = R's pf() upper tail at the exact F, bounds with R's qf() and 256-bit arithmetic.
#            For lmer = TRUE this is what REML gives exactly when neither variance component is at its boundary
#            (MSB >= MSE and MSJ >= MSE); lme4's optimiser stops about 1e-7 away from it. For lmer = FALSE it is
#            the same model; aov's values are within rounding of it.
#   "reml"   lmer = TRUE, complete data, a variance component at its boundary (MSB < MSE or MSJ < MSE): the exact REML
#            estimate on the boundary (the balanced one-way model without that component, in closed form; of the two
#            faces the one with the smaller REML criterion), and psych's formulas applied to it.
#   No reference for missing ratings with lmer = TRUE: REML has no closed form there, and a tightened lme4 fit is still
#   only about 1e-8 accurate (see the behaviour file).

suppressPackageStartupMessages({library(psych); library(gmp)})

set.seed(20261109)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

sf <- matrix(c(9, 2, 5, 8, 6, 1, 3, 2, 8, 4, 6, 8, 7, 1, 2, 6, 10, 5, 6, 9, 6, 2, 4, 7), 6, byrow = TRUE)  # Shrout & Fleiss 1979
r10 <- round(matrix(rnorm(40, 5), 10) + rnorm(10) * 2, 1)
r30 <- round(matrix(rnorm(90, 50, 4), 30) + rnorm(30, 0, 8) + rep(c(0, 1.5, -1), each = 30), 1)
r8 <- round(matrix(rnorm(16, 3), 8) + rnorm(8), 2)                       # two raters
neg <- matrix(c(1, 5, 5, 1, 2, 4, 4, 2, 3, 3.2), 5, byrow = TRUE)         # ICC < 0: MSB < MSE
nojudge <- round(matrix(rnorm(24), 8) + rnorm(8) * 3, 2)                  # rater effect below noise
nojudge <- nojudge - rep(colMeans(nojudge), each = 8) + rep(c(0.01, -0.02, 0.01), each = 8)
small <- matrix(c(1, 2, 3, 3, 5, 4), 3, byrow = TRUE)                     # n = 3, k = 2

for (m in list(sf, r10, r30, r8, small)) for (lm in c(TRUE, FALSE)) add(x = m, lmer = lm)
for (lm in c(TRUE, FALSE)) { add(x = neg, lmer = lm); add(x = nojudge, lmer = lm) }
for (a in c(0.1, 0.01)) add(x = sf, alpha = a, lmer = FALSE)
add(x = sf, alpha = 0.1)
add(x = sf + 1e6, lmer = FALSE)
add(x = sf + 1e6)
# perfect agreement / consistency, constant data
add(x = cbind(1:5, 1:5, 1:5), lmer = FALSE)
add(x = cbind(1:5, 2:6, 4:8), lmer = FALSE)
add(x = matrix(3, 4, 3), lmer = FALSE)
# one rater, one subject
add(x = sf[, 1, drop = FALSE], lmer = FALSE)
add(x = sf[1, , drop = FALSE], lmer = FALSE)
# missing ratings
m1 <- sf; m1[2, 3] <- NA
m2 <- r10; m2[c(1, 5, 9), c(2, 4, 1)] <- NA
add(x = m1)
add(x = m2)
add(x = m1, lmer = FALSE)
add(x = m1, lmer = FALSE, missing = FALSE)
add(x = m2, lmer = FALSE, missing = FALSE)
# scaling by powers of two
for (e in c(-540, 520)) add(x = sf * 2^e, lmer = FALSE)

icc_fields <- function(r) {
  res <- r$results
  out <- list(results = setNames(lapply(seq_len(nrow(res)), function(i) I(num2str(unlist(res[i, 2:8])))), res$type))
  st <- r$stats
  out$stats <- setNames(lapply(rownames(st), function(nm) I(num2str(unname(st[nm, ])))), rownames(st))
  out$MSW <- num2str(r$MSW)
  if (!is.null(r$lme)) out$lme <- list(variance = I(num2str(r$lme$variance)), Percent = I(num2str(unlist(r$lme$Percent))))
  out$n.obs <- num2str(r$n.obs); out$n.judge <- num2str(r$n.judge)
  out
}

run_icc <- function(a) {
  msgs <- character(0)
  r <- withCallingHandlers(call_with(ICC, list(x = a$x, alpha = a$alpha, lmer = a$lmer, missing = a$missing)),
    message = function(m) { msgs <<- c(msgs, sub("\n$", "", conditionMessage(m))); invokeRestart("muffleMessage") })
  list(r = r, messages = unique(msgs))
}

# psych's formulas from the mean squares (MSB, MSJ, MSE, MSW: mpfr), n, k, alpha (qf in double)
icc_from_ms <- function(MSB, MSJ, MSE, MSW, n, k, alpha) {
  v <- function(z) asNumeric(z)
  ICC1 <- (MSB - MSW) / (MSB + (k - 1) * MSW)
  ICC2 <- (MSB - MSE) / (MSB + (k - 1) * MSE + k * (MSJ - MSE) / n)
  ICC3 <- (MSB - MSE) / (MSB + (k - 1) * MSE)
  ICC12 <- (MSB - MSW) / MSB
  ICC22 <- (MSB - MSE) / (MSB + (MSJ - MSE) / n)
  ICC32 <- (MSB - MSE) / MSB
  F11 <- MSB / MSW; F21 <- MSB / MSE
  d1 <- n - 1; d11 <- n * (k - 1); d21 <- (n - 1) * (k - 1)
  p11 <- -expm1(pf(v(F11), d1, d11, log.p = TRUE)); p21 <- -expm1(pf(v(F21), d1, d21, log.p = TRUE))
  F1L <- F11 / qf(1 - alpha / 2, d1, d11); F1U <- F11 * qf(1 - alpha / 2, d11, d1)
  F3L <- F21 / qf(1 - alpha / 2, d1, d21); F3U <- F21 * qf(1 - alpha / 2, d21, d1)
  Fj <- MSJ / MSE
  vn <- (k - 1) * (n - 1) * (k * ICC2 * Fj + n * (1 + (k - 1) * ICC2) - k * ICC2)^2
  vd <- (n - 1) * k^2 * ICC2^2 * Fj^2 + (n * (1 + (k - 1) * ICC2) - k * ICC2)^2
  vv <- v(vn / vd)
  G1 <- qf(1 - alpha / 2, n - 1, vv); G2 <- qf(1 - alpha / 2, vv, n - 1)
  L3 <- n * (MSB - G1 * MSE) / (G1 * (k * MSJ + (k * n - k - n) * MSE) + n * MSB)
  U3 <- n * (G2 * MSB - MSE) / (k * MSJ + (k * n - k - n) * MSE + n * G2 * MSB)
  rows <- list(
    ICC1 = c(ICC1, F11, d1, d11, p11, (F1L - 1) / (F1L + k - 1), (F1U - 1) / (F1U + k - 1)),
    ICC2 = c(ICC2, F21, d1, d21, p21, L3, U3),
    ICC3 = c(ICC3, F21, d1, d21, p21, (F3L - 1) / (F3L + k - 1), (F3U - 1) / (F3U + k - 1)),
    ICC1k = c(ICC12, F11, d1, d11, p11, 1 - 1 / F1L, 1 - 1 / F1U),
    ICC2k = c(ICC22, F21, d1, d21, p21, L3 * k / (1 + L3 * (k - 1)), U3 * k / (1 + U3 * (k - 1))),
    ICC3k = c(ICC32, F21, d1, d21, p21, 1 - 1 / F3L, 1 - 1 / F3U))
  lapply(rows, function(z) I(num2str(vapply(z, function(e) asNumeric(e), 0))))
}

ref_icc <- function(a) {
  x <- a$x; n <- nrow(x); k <- ncol(x)
  alpha <- if (is.null(a$alpha)) 0.05 else a$alpha
  lm <- if (is.null(a$lmer)) TRUE else a$lmer
  if (n < 2 || k < 2) return(NULL)
  if (!anyNA(x)) {
    X <- as.bigq(x)
    g <- sum(X) / (n * k)
    rm <- as.bigq(rep(0, n)); cm <- as.bigq(rep(0, k))
    for (i in 1:n) rm[i] <- sum(X[i, ]) / k
    for (j in 1:k) cm[j] <- sum(X[, j]) / n
    SSB <- k * sum((rm - g)^2); SSJ <- n * sum((cm - g)^2); SST <- sum((X - g)^2)
    SSE <- SST - SSB - SSJ
    if (SSE == 0) return(NULL)
    MSB <- SSB / (n - 1); MSJ <- SSJ / (k - 1); MSE <- SSE / ((n - 1) * (k - 1)); MSW <- (SSJ + SSE) / (n * (k - 1))
    q <- function(z) Rmpfr::mpfr(z, HTEST_BITS)   # bigq -> mpfr exactly rounded
    if (!lm || (MSB >= MSE && MSJ >= MSE))
      return(list(refKind = "anova", results = icc_from_ms(q(MSB), q(MSJ), q(MSE), q(MSW), n, k, alpha),
                  MSW = num2str(asNumeric(q(MSW)))))
    # REML with a variance component at its boundary: the maximum lies on a face, where the model is a balanced
    # one-way model with a closed-form REML estimate. Candidates: rater variance 0 (groups = subjects), subject
    # variance 0 (groups = raters); each clipped at 0 in turn. The face with the smaller REML criterion is taken.
    zero <- as.bigq(0)
    cand <- list()
    MSa <- MSB; MSwa <- (SSJ + SSE) / (n * (k - 1))                          # rater variance 0
    sid <- (MSa - MSwa) / k
    cand[[1]] <- if (sid >= 0) c(sid, zero, MSwa) else c(zero, zero, SST / (n * k - 1))
    MSb <- MSJ; MSwb <- (SSB + SSE) / (k * (n - 1))                          # subject variance 0
    sit <- (MSb - MSwb) / n
    cand[[2]] <- if (sit >= 0) c(zero, sit, MSwb) else c(zero, zero, SST / (n * k - 1))
    yv <- as.vector(x)
    Zid <- kronecker(matrix(1, k, 1), diag(n)); Zit <- kronecker(diag(k), matrix(1, n, 1))
    crit <- vapply(cand, function(cc) {
      s <- asNumeric(cc)
      V <- s[1] * tcrossprod(Zid) + s[2] * tcrossprod(Zit) + s[3] * diag(n * k)
      Vi <- solve(V); one <- rep(1, n * k)
      a <- sum(Vi %*% one); P <- Vi - (Vi %*% one) %*% (one %*% Vi) / a
      as.numeric(determinant(V)$modulus + log(a) + t(yv) %*% P %*% yv)
    }, 0)
    cc <- cand[[which.min(crit)]]
    e <- cc[3]
    return(list(refKind = "reml", results = icc_from_ms(q(k * cc[1] + e), q(n * cc[2] + e), q(e), q(e + cc[2]), n, k, alpha),
                MSW = num2str(asNumeric(q(e + cc[2])))))
  }
  NULL
}

write_htest_fixture("iccPsych", cases, function(a) {
  r <- run_icc(a)
  c(icc_fields(r$r), list(messages = I(r$messages)))
}, ref_icc, warnings = TRUE)
