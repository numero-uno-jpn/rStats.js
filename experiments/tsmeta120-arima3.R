# tsmeta120-arima3.R: stats' arima, third experiment (1.20.0).
#   (1) Differenced models with the help page's prior: "kappa: the prior variance (as a multiple of the innovations
#       variance) for the past observations in a differenced model". Candidate K: y = x - regression part follows
#       y_t = sum_k c_k y_{t-k} + w_t (c from delta(B)), with the nd = d + sD presample values y_0, ..., y_{1-nd}
#       iid N(0, kappa sigma^2) independent of the stationary ARMA w. Then Cov(y) / sigma^2 = kappa A A' + B Gamma B'
#       (y = A pre + B w). The sequential decomposition gives v_t, F_t for every t; the first nd observations
#       ("still controlled by the diffuse prior") are left out of sigma2 = sum_{t>nd} v_t^2 / F_t / (n - nd) and of
#       loglik; residuals = v_t / sqrt(F_t) for all t; predict = the conditional mean and variance of the future y.
#   (2) var.coef, for lh AR(1), AR(3), ARMA(1,1) and LakeHuron AR(2) + regressor: central-difference Hessians of the
#       exact -loglik (tsmeta120-arima.R) with steps h = 1e-1 ... 1e-6 (the optimHess form, absolute steps), and
#       candidate T: optimHess (steps 1e-3) in the space where AR parameters are atanh of the partial
#       autocorrelations, mapped back with the Jacobian (the help page's "inverse tanh of the partial
#       autocorrelations").
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)

polymul <- function(a, b) {
  r <- numeric(length(a) + length(b) - 1)
  for (i in seq_along(a)) r[i:(i + length(b) - 1)] <- r[i:(i + length(b) - 1)] + a[i] * b
  r
}
seasonalPoly <- function(cf, s, sign) {
  if (!length(cf)) return(1)
  p <- numeric(s * length(cf) + 1); p[1] <- 1; p[s * seq_along(cf) + 1] <- sign * cf; p
}
expandPoly <- function(phi, theta, Phi, Theta, s) {
  list(arc = -polymul(c(1, -phi), seasonalPoly(Phi, s, -1))[-1],
       mac = polymul(c(1, theta), seasonalPoly(Theta, s, 1))[-1])
}
gammaMatrix <- function(arc, mac, n) {
  psi <- if (length(arc) || length(mac)) ARMAtoMA(arc, mac, 20000) else 0
  g0 <- 1 + sum(psi^2)
  rho <- if (length(arc) || length(mac)) ARMAacf(arc, mac, lag.max = n - 1) else c(1, numeric(n - 1))
  toeplitz(unname(rho) * g0)
}
diffPoly <- function(d, D, s) {
  p <- 1
  for (i in seq_len(d)) p <- polymul(p, c(1, -1))
  for (i in seq_len(D)) p <- polymul(p, seasonalPoly(1, s, -1))
  p
}
# candidate K: the joint covariance of y_1..y_N (N = n + h) under the kappa prior, and the likelihood of y_1..y_n
kappaLik <- function(y, arc, mac, dp, kappa, h) {
  n <- length(y); N <- n + h; nd <- length(dp) - 1; cc <- -dp[-1]
  A <- matrix(0, N + nd, nd); B <- matrix(0, N + nd, N)  # rows: pre (nd rows, oldest first), then y_1..y_N
  if (nd) for (k in 1:nd) A[k, k] <- 1
  for (t in 1:N) {
    r <- nd + t
    if (nd) for (k in 1:nd) { A[r, ] <- A[r, ] + cc[k] * A[r - k, ]; B[r, ] <- B[r, ] + cc[k] * B[r - k, ] }
    B[r, t] <- B[r, t] + 1
  }
  A <- A[nd + 1:N, , drop = FALSE]; B <- B[nd + 1:N, , drop = FALSE]
  S <- kappa * tcrossprod(A) + B %*% gammaMatrix(arc, mac, N) %*% t(B)
  obs <- 1:n
  C <- chol(S[obs, obs]); Fv <- diag(C)^2
  z <- backsolve(C, y, transpose = TRUE)         # v_t / sqrt(F_t)
  keep <- (nd + 1):n
  s2 <- sum(z[keep]^2) / length(keep)
  ll <- -0.5 * (length(keep) * log(2 * pi * s2) + sum(log(Fv[keep])) + length(keep))
  fut <- n + seq_len(h)
  W <- solve(S[obs, obs], S[obs, fut])
  list(sigma2 = s2, loglik = ll, resid = z, F = Fv, pred = drop(crossprod(W, y)),
       se = sqrt(s2 * diag(S[fut, fut] - crossprod(S[obs, fut], W))))
}

cases <- list(
  list(name = "lh_arima110", x = lh, order = c(1, 1, 0), seasonal = c(0, 0, 0)),
  list(name = "lh_arima011", x = lh, order = c(0, 1, 1), seasonal = c(0, 0, 0)),
  list(name = "lh_arima210_d2", x = lh, order = c(1, 2, 0), seasonal = c(0, 0, 0)),
  list(name = "usacc_airline", x = USAccDeaths, order = c(0, 1, 1), seasonal = c(0, 1, 1)),
  list(name = "lakehuron_111_drift", x = LakeHuron, order = c(1, 1, 1), seasonal = c(0, 0, 0),
       xreg = as.numeric(seq_along(LakeHuron)))
)
for (cs in cases) {
  x <- as.numeric(cs$x); n <- length(x); s <- frequency(cs$x)
  p <- cs$order[1]; d <- cs$order[2]; q <- cs$order[3]; P <- cs$seasonal[1]; D <- cs$seasonal[2]; Q <- cs$seasonal[3]
  dp <- diffPoly(d, D, s); h <- 12
  ft <- arima(cs$x, order = cs$order, seasonal = cs$seasonal, xreg = cs$xreg, method = "ML",
              optim.control = list(reltol = 1e-15, maxit = 2000))
  cf <- unname(coef(ft))
  e <- expandPoly(cf[seq_len(p)], cf[p + seq_len(q)], cf[p + q + seq_len(P)], cf[p + q + P + seq_len(Q)], s)
  beta <- if (is.null(cs$xreg)) 0 else cf[length(cf)]
  xr <- if (is.null(cs$xreg)) numeric(n + h) else c(cs$xreg, max(cs$xreg) + 1:h)
  y <- x - beta * xr[1:n]
  k <- kappaLik(y, e$arc, e$mac, dp, 1e6, h)
  pr <- predict(ft, n.ahead = h, newxreg = if (!is.null(cs$xreg)) max(cs$xreg) + 1:h)
  rr <- as.numeric(residuals(ft))
  out[[cs$name]] <- list(
    coef = cf, sigma2 = ft$sigma2, loglik = ft$loglik, residuals = rr, pred = as.numeric(pr$pred),
    se = as.numeric(pr$se), nobs = ft$nobs,
    candK = list(sigma2 = k$sigma2, loglik = k$loglik, resid = k$resid, F = k$F, pred = k$pred + beta * xr[n + 1:h],
                 se = k$se),
    diff = list(loglik = ft$loglik - k$loglik, sigma2 = ft$sigma2 / k$sigma2 - 1, resid = max(abs(rr - k$resid)),
                pred = max(abs(pr$pred - k$pred - beta * xr[n + 1:h])), se = max(abs(pr$se / k$se - 1))))
}

# (2) var.coef
exactNegLL <- function(x, mu, arc, mac) {
  G <- gammaMatrix(arc, mac, length(x)); C <- chol(G); d <- diag(C)^2
  z <- backsolve(C, x - mu, transpose = TRUE); m <- length(x); s2 <- sum(z^2) / m
  0.5 * (m * log(2 * pi * s2) + sum(log(d)) + m)
}
pacfToAr <- function(r) {                        # Durbin-Levinson: partial autocorrelations to AR coefficients
  a <- numeric(0)
  for (k in seq_along(r)) a <- c(a - r[k] * rev(a), r[k])
  a
}
arToPacf <- function(a) {
  p <- length(a); r <- numeric(p)
  for (k in p:1) { r[k] <- a[k]; if (k > 1) a <- (a[1:(k - 1)] + r[k] * rev(a[1:(k - 1)])) / (1 - r[k]^2) }
  r
}
hessAt <- function(f, cf, h) {
  k <- length(cf); H <- matrix(0, k, k)
  for (i in 1:k) for (j in 1:k) {
    e1 <- replace(numeric(k), i, h); e2 <- replace(numeric(k), j, h)
    H[i, j] <- (f(cf + e1 + e2) - f(cf + e1 - e2) - f(cf - e1 + e2) + f(cf - e1 - e2)) / (4 * h * h)
  }
  (H + t(H)) / 2
}
vcases <- list(
  list(name = "lh_ar1", x = lh, p = 1, q = 0), list(name = "lh_ar3", x = lh, p = 3, q = 0),
  list(name = "lh_arma11", x = lh, p = 1, q = 1),
  list(name = "lakehuron_xreg", x = LakeHuron, p = 2, q = 0, xreg = as.numeric(time(LakeHuron) - 1920))
)
for (cs in vcases) {
  x <- as.numeric(cs$x); n <- length(x); p <- cs$p; q <- cs$q
  ft <- arima(cs$x, order = c(p, 0, q), xreg = cs$xreg, method = "ML", optim.control = list(reltol = 1e-15, maxit = 2000))
  cf <- unname(coef(ft))
  f <- function(b) {
    mu <- b[p + q + 1] + (if (is.null(cs$xreg)) 0 else b[p + q + 2] * cs$xreg)
    exactNegLL(x, mu, b[seq_len(p)], b[p + seq_len(q)])
  }
  grid <- 10^-(1:6)
  rel <- sapply(grid, function(h) max(abs(ft$var.coef / solve(hessAt(f, cf, h)) - 1)))
  # candidate T: AR part as atanh(pacf)
  toNat <- function(u) c(pacfToAr(tanh(u[seq_len(p)])), u[-seq_len(p)])
  u0 <- c(atanh(arToPacf(cf[seq_len(p)])), cf[-seq_len(p)])
  Ht <- optimHess(u0, function(u) f(toNat(u)))
  J <- matrix(0, length(cf), length(cf))
  for (j in seq_along(u0)) { du <- replace(numeric(length(u0)), j, 1e-7)
    J[, j] <- (toNat(u0 + du) - toNat(u0 - du)) / 2e-7 }
  VT <- J %*% solve(Ht) %*% t(J)
  out[[paste0("vcov_", cs$name)]] <- list(var_coef = ft$var.coef, grid = grid, rel_grid = rel,
    VT = VT, rel_T = max(abs(ft$var.coef / VT - 1)),
    rel_optimHess = max(abs(ft$var.coef / solve(optimHess(cf, f)) - 1)))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
