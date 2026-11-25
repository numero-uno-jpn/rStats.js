# regression117-betareg-bias.R: betareg's bias-corrected (type = "BC") and bias-reduced (type = "BR") estimators
# (1.17.0). The help page cites Kosmidis and Firth (2010) and Gruen, Kosmidis and Zeileis (2012). Candidate from the
# general method of Kosmidis and Firth (2010): the adjustment A_t = 1/2 tr(F^-1 (P_t + Q_t)) with F the expected
# information, P_t = E(U U' U_t), Q_t = E(-H U_t) (U the score, H the Hessian of the log-likelihood); the
# first-order bias b = -F^-1 A; BC = ML - b(ML); BR solves U + A = 0. The expectations are computed here per
# observation by numerical integration over the beta density (not from closed forms), in the two linear predictors
# eta1 (mean) and eta2 (precision) and carried to the coefficients by the model matrices. Compared with R: the
# `bias` field, the coefficients, vcov, loglik, for constant and modelled phi, two links and weights.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
out <- list(R = R.version.string, arch = R.version$arch, betareg = as.character(packageVersion("betareg")))
set.seed(20261128)
n <- 40
x1 <- rnorm(n); z1 <- rnorm(n); w <- rpois(n, 1.5) + 1
mu0 <- plogis(0.2 + 0.7 * x1); ph0 <- exp(2 + 0.6 * z1)
yv <- rbeta(n, mu0 * ph0, (1 - mu0) * ph0)
yc <- rbeta(n, mu0 * 15, (1 - mu0) * 15)
d <- data.frame(x1, z1, w, yv, yc)
assign("d", d, envir = globalenv())

linkinv <- list(logit = plogis, probit = pnorm, identity = function(e) e, log = exp)
mueta <- list(logit = function(e) plogis(e) * (1 - plogis(e)), probit = dnorm,
              identity = function(e) rep(1, length(e)), log = exp)

# per-observation score in (eta1, eta2) at y (vectorised over y)
score_eta <- function(y, e1, e2, lk, lkp) {
  mu <- linkinv[[lk]](e1); ph <- linkinv[[lkp]](e2)
  ys <- log(y) - log1p(-y); ms <- digamma(mu * ph) - digamma((1 - mu) * ph)
  s1 <- ph * (ys - ms) * mueta[[lk]](e1)
  s2 <- (mu * (ys - ms) + log1p(-y) - digamma((1 - mu) * ph) + digamma(ph)) * mueta[[lkp]](e2)
  cbind(s1, s2)
}
moments <- function(e1, e2, lk, lkp) {
  mu <- linkinv[[lk]](e1); ph <- linkinv[[lkp]](e2); h <- 1e-5
  E <- function(fun) integrate(function(y) fun(y) * dbeta(y, mu * ph, (1 - mu) * ph), 0, 1,
                               rel.tol = 1e-10, subdivisions = 1000L, stop.on.error = FALSE)$value
  S <- function(y) score_eta(y, e1, e2, lk, lkp)
  # Hessian in eta by central differences of the analytic score
  Hm <- function(y) {
    a1 <- (score_eta(y, e1 + h, e2, lk, lkp) - score_eta(y, e1 - h, e2, lk, lkp)) / (2 * h)
    a2 <- (score_eta(y, e1, e2 + h, lk, lkp) - score_eta(y, e1, e2 - h, lk, lkp)) / (2 * h)
    list(h11 = a1[, 1], h12 = a1[, 2], h22 = a2[, 2])
  }
  M <- array(0, c(2, 2, 2)); Q <- array(0, c(2, 2, 2)); F <- matrix(0, 2, 2)
  for (a in 1:2) for (b in 1:2) {
    F[a, b] <- E(function(y) S(y)[, a] * S(y)[, b])
    for (cc in 1:2) {
      M[a, b, cc] <- E(function(y) { s <- S(y); s[, a] * s[, b] * s[, cc] })
      Q[a, b, cc] <- E(function(y) { s <- S(y); hh <- Hm(y); hab <- if (a == 1 && b == 1) hh$h11 else if (a == 2 && b == 2) hh$h22 else hh$h12; -hab * s[, cc] })
    }
  }
  list(M = M, Q = Q, F = F)
}
adjustment <- function(th, X, Z, wt, lk, lkp) {
  p <- ncol(X); q <- ncol(Z); k <- p + q
  e1 <- as.vector(X %*% th[1:p]); e2 <- as.vector(Z %*% th[p + 1:q])
  mo <- lapply(seq_len(nrow(X)), function(i) moments(e1[i], e2[i], lk, lkp))
  J <- lapply(seq_len(nrow(X)), function(i) rbind(c(X[i, ], rep(0, q)), c(rep(0, p), Z[i, ])))  # 2 x k
  Fi <- Reduce(`+`, lapply(seq_along(J), function(i) wt[i] * t(J[[i]]) %*% mo[[i]]$F %*% J[[i]]))
  Finv <- solve(Fi)
  A <- numeric(k)
  for (t in seq_len(k)) {
    PQ <- matrix(0, k, k)
    for (i in seq_along(J)) for (cc in 1:2) {
      Jc <- J[[i]][cc, t]; if (Jc == 0) next
      PQ <- PQ + wt[i] * Jc * t(J[[i]]) %*% (mo[[i]]$M[, , cc] + mo[[i]]$Q[, , cc]) %*% J[[i]]
    }
    A[t] <- 0.5 * sum(diag(Finv %*% PQ))
  }
  list(A = A, bias = -as.vector(Finv %*% A), F = Fi)
}
score_theta <- function(th, X, Z, y, wt, lk, lkp) {
  p <- ncol(X); q <- ncol(Z)
  s <- score_eta(y, as.vector(X %*% th[1:p]), as.vector(Z %*% th[p + 1:q]), lk, lkp)
  c(colSums(wt * s[, 1] * X), colSums(wt * s[, 2] * Z))
}

cases <- list(
  list(name = "const logit", f = yc ~ x1, y = "yc", lk = "logit", lkp = "identity", Z = matrix(1, n, 1), w = FALSE),
  list(name = "const logit phi-log", f = yc ~ x1, y = "yc", lk = "logit", lkp = "log", Z = matrix(1, n, 1), w = FALSE),
  list(name = "var logit", f = yv ~ x1 | z1, y = "yv", lk = "logit", lkp = "log", Z = cbind(1, z1), w = FALSE),
  list(name = "var probit", f = yv ~ x1 | z1, y = "yv", lk = "probit", lkp = "log", Z = cbind(1, z1), w = FALSE),
  list(name = "const logit weights", f = yc ~ x1, y = "yc", lk = "logit", lkp = "identity", Z = matrix(1, n, 1), w = TRUE)
)
X <- cbind(1, x1)
res <- list()
for (cs in cases) {
  wt <- if (cs$w) w else rep(1, n)
  fits <- lapply(c(ML = "ML", BC = "BC", BR = "BR"), function(ty) {
    if (cs$w) betareg(cs$f, data = d, link = cs$lk, link.phi = cs$lkp, type = ty, weights = w)
    else betareg(cs$f, data = d, link = cs$lk, link.phi = cs$lkp, type = ty)
  })
  th <- lapply(fits, function(f) c(f$coefficients$mean, f$coefficients$precision))
  adjML <- adjustment(th$ML, X, cs$Z, wt, cs$lk, cs$lkp)
  adjBR <- adjustment(th$BR, X, cs$Z, wt, cs$lk, cs$lkp)
  adjBC <- adjustment(th$BC, X, cs$Z, wt, cs$lk, cs$lkp)
  res[[cs$name]] <- list(
    coef = lapply(th, unname), bias_field = lapply(fits, function(f) if (is.null(f$bias)) NULL else unname(f$bias)),
    loglik = sapply(fits, function(f) f$loglik), iterations = lapply(fits, function(f) c(f$optim$counts, scoring = f$scoring)),
    cand_bias_at_ML = adjML$bias, cand_bias_at_BC = adjBC$bias, cand_bias_at_BR = adjBR$bias,
    BC_minus_cand = unname(th$BC - (th$ML - adjML$bias)),
    BR_adjusted_score = unname(score_theta(th$BR, X, cs$Z, d[[cs$y]], wt, cs$lk, cs$lkp) + adjBR$A),
    ML_score = unname(score_theta(th$ML, X, cs$Z, d[[cs$y]], wt, cs$lk, cs$lkp)),
    vcov_BC_vs_Finv_at_BC = max(abs(solve(adjBC$F) - fits$BC$vcov)),
    vcov_BC_vs_Finv_at_ML = max(abs(solve(adjML$F) - fits$BC$vcov)),
    vcov_BR_vs_Finv_at_BR = max(abs(solve(adjBR$F) - fits$BR$vcov)),
    vcov_scale = max(abs(fits$ML$vcov)),
    print_BR = capture.output(print(summary(fits$BR)))[c(-1, -2, -3)])
}
out$cases <- res
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
