# regression117-betareg-bias2.R (after regression117-betareg-bias.R, whose candidate missed R's bias): betareg's bias-corrected (type = "BC") and bias-reduced (type = "BR") estimators
# (1.17.0). The help page cites Kosmidis and Firth (2010) and Gruen, Kosmidis and Zeileis (2012). Candidate from the
# general method of Kosmidis and Firth (2010): the adjustment A_t = 1/2 tr(F^-1 (P_t + Q_t)) with F the expected
# information, P_t = E(U U' U_t), Q_t = E(-H U_t) (U the score, H the Hessian of the log-likelihood); the
# first-order bias b = -F^-1 A; BC = ML - b(ML); BR solves U + A = 0. The expectations are computed here per
# observation by numerical integration over the beta density (not from closed forms), in the two linear predictors
# eta1 (mean) and eta2 (precision) and carried to the coefficients by the model matrices. Compared with R: the
# `bias` field, the coefficients, vcov, loglik, for constant and modelled phi, two links and weights.
# This script splits the candidate adjustment into its P part (third moments of the score) and Q part (E(-H U_t)),
# and Q without the second derivatives of the links (the Hessian in mu and phi carried by the first derivatives only),
# and looks for the combination a P + b Q (least squares over the components) that gives R's `bias` at the ML fit.
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


d2fun <- list(logit = function(e) { m <- plogis(e); m * (1 - m) * (1 - 2 * m) }, probit = function(e) -e * dnorm(e),
              identity = function(e) rep(0, length(e)), log = exp)
# per-observation score in (mu, phi) at y
score_mp <- function(y, mu, ph) {
  ys <- log(y) - log1p(-y); ms <- digamma(mu * ph) - digamma((1 - mu) * ph)
  cbind(ph * (ys - ms), mu * (ys - ms) + log1p(-y) - digamma((1 - mu) * ph) + digamma(ph))
}
moments <- function(e1, e2, lk, lkp) {
  mu <- linkinv[[lk]](e1); ph <- linkinv[[lkp]](e2); h <- 1e-6
  dv <- c(mueta[[lk]](e1), mueta[[lkp]](e2)); d2 <- c(d2fun[[lk]](e1), d2fun[[lkp]](e2))
  E <- function(fun) integrate(function(y) fun(y) * dbeta(y, mu * ph, (1 - mu) * ph), 0, 1,
                               rel.tol = 1e-10, subdivisions = 1000L, stop.on.error = FALSE)$value
  S <- function(y) { s <- score_mp(y, mu, ph); cbind(s[, 1] * dv[1], s[, 2] * dv[2]) }
  Hmp <- function(y) {   # Hessian in (mu, phi), central differences of the analytic score
    a1 <- (score_mp(y, mu + h, ph) - score_mp(y, mu - h, ph)) / (2 * h)
    a2 <- (score_mp(y, mu, ph + h) - score_mp(y, mu, ph - h)) / (2 * h)
    list(a1[, 1], a1[, 2], a2[, 2])
  }
  hel <- function(y, a, b, full) {
    H <- Hmp(y); s <- score_mp(y, mu, ph)
    v <- (if (a == 1 && b == 1) H[[1]] else if (a == 2 && b == 2) H[[3]] else H[[2]]) * dv[a] * dv[b]
    if (full && a == b) v <- v + s[, a] * d2[a]
    v
  }
  M <- Q <- Q0 <- array(0, c(2, 2, 2)); F <- matrix(0, 2, 2)
  for (a in 1:2) for (b in 1:2) {
    F[a, b] <- E(function(y) S(y)[, a] * S(y)[, b])
    for (cc in 1:2) {
      M[a, b, cc] <- E(function(y) { s <- S(y); s[, a] * s[, b] * s[, cc] })
      Q[a, b, cc] <- E(function(y) -hel(y, a, b, TRUE) * S(y)[, cc])
      Q0[a, b, cc] <- E(function(y) -hel(y, a, b, FALSE) * S(y)[, cc])
    }
  }
  list(M = M, Q = Q, Q0 = Q0, F = F)
}
parts <- function(th, X, Z, wt, lk, lkp) {
  p <- ncol(X); q <- ncol(Z); k <- p + q
  e1 <- as.vector(X %*% th[1:p]); e2 <- as.vector(Z %*% th[p + 1:q])
  mo <- lapply(seq_len(nrow(X)), function(i) moments(e1[i], e2[i], lk, lkp))
  J <- lapply(seq_len(nrow(X)), function(i) rbind(c(X[i, ], rep(0, q)), c(rep(0, p), Z[i, ])))
  Fi <- Reduce(`+`, lapply(seq_along(J), function(i) wt[i] * t(J[[i]]) %*% mo[[i]]$F %*% J[[i]]))
  Finv <- solve(Fi)
  tr <- function(which) sapply(seq_len(k), function(t) {
    PQ <- matrix(0, k, k)
    for (i in seq_along(J)) for (cc in 1:2) {
      Jc <- J[[i]][cc, t]; if (Jc == 0) next
      PQ <- PQ + wt[i] * Jc * t(J[[i]]) %*% mo[[i]][[which]][, , cc] %*% J[[i]]
    }
    0.5 * sum(diag(Finv %*% PQ))
  })
  AP <- tr("M"); AQ <- tr("Q"); AQ0 <- tr("Q0")
  list(bP = -as.vector(Finv %*% AP), bQ = -as.vector(Finv %*% AQ), bQ0 = -as.vector(Finv %*% AQ0), Fdiff = Fi)
}
cases <- list(
  list(name = "const logit", f = yc ~ x1, lk = "logit", lkp = "identity", Z = matrix(1, n, 1)),
  list(name = "const logit phi-log", f = yc ~ x1, lk = "logit", lkp = "log", Z = matrix(1, n, 1)),
  list(name = "var logit", f = yv ~ x1 | z1, lk = "logit", lkp = "log", Z = cbind(1, z1)),
  list(name = "var probit", f = yv ~ x1 | z1, lk = "probit", lkp = "log", Z = cbind(1, z1))
)
X <- cbind(1, x1)
res <- list()
for (cs in cases) {
  fml <- betareg(cs$f, data = d, link = cs$lk, link.phi = cs$lkp, type = "ML")
  fbc <- betareg(cs$f, data = d, link = cs$lk, link.phi = cs$lkp, type = "BC")
  th <- c(fml$coefficients$mean, fml$coefficients$precision)
  pr <- parts(th, X, cs$Z, rep(1, n), cs$lk, cs$lkp)
  rb <- unname(fbc$bias)
  fitc <- function(B) { cf <- qr.solve(B, rb); list(coef = cf, resid = max(abs(B %*% cf - rb))) }
  res[[cs$name]] <- list(R_bias = rb, bP = pr$bP, bQ = pr$bQ, bQ0 = pr$bQ0,
                         fit_PQ = fitc(cbind(pr$bP, pr$bQ)), fit_PQ0 = fitc(cbind(pr$bP, pr$bQ0)),
                         fit_P_Q_Q0 = if (length(rb) >= 3) fitc(cbind(pr$bP, pr$bQ, pr$bQ0)) else NULL)
}
out$cases <- res
cat(toJSON(out, digits = 17, auto_unbox = TRUE, na = "null", null = "null"))
