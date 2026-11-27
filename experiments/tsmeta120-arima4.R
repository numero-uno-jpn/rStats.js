# tsmeta120-arima4.R: stats' arima, fourth experiment (1.20.0).
#   (1) var.coef, candidate R: the AR parameters as u = atanh(partial autocorrelations) (the help page's transform),
#       Hu = optimHess (default steps 1e-3) of the exact -loglik in (u, other coefficients), and var.coef =
#       J Hu^{-1} J' with J the FORWARD difference (step 1e-3) of the map u -> AR coefficients (identity for the
#       others). Suggested by tsmeta120-arima3: R's AR rows were off by exactly 1 - 1e-3 tanh(u) for AR(1).
#       Variants: J central (R2), J forward with Hu from fine steps (R3).
#   (2) The kappa prior of tsmeta120-arima3 computed stably: z = (y_1..y_nd, w_{nd+1}..w_n) is a unit lower
#       triangular map of y, so its sequential innovations are those of y; Cov(z) has the kappa-sized block only in
#       the first nd rows. Run R and the candidate with kappa = 1e4, 1e6, 1e8 and 1e12, for d = 1, d = 2 and the
#       airline model, to see whether R's differences come from the model or from rounding at a large kappa.
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
exactNegLL <- function(x, mu, arc, mac) {
  G <- gammaMatrix(arc, mac, length(x)); C <- chol(G); d <- diag(C)^2
  z <- backsolve(C, x - mu, transpose = TRUE); m <- length(x); s2 <- sum(z^2) / m
  0.5 * (m * log(2 * pi * s2) + sum(log(d)) + m)
}
pacfToAr <- function(r) {
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
  list(name = "lh_arma11", x = lh, p = 1, q = 1), list(name = "lh_ma2", x = lh, p = 0, q = 2),
  list(name = "lakehuron_xreg", x = LakeHuron, p = 2, q = 0, xreg = as.numeric(time(LakeHuron) - 1920))
)
for (cs in vcases) {
  x <- as.numeric(cs$x); p <- cs$p; q <- cs$q
  ft <- arima(cs$x, order = c(p, 0, q), xreg = cs$xreg, method = "ML", optim.control = list(reltol = 1e-15, maxit = 2000))
  cf <- unname(coef(ft)); k <- length(cf)
  f <- function(b) {
    mu <- b[p + q + 1] + (if (is.null(cs$xreg)) 0 else b[p + q + 2] * cs$xreg)
    exactNegLL(x, mu, b[seq_len(p)], b[p + seq_len(q)])
  }
  toNat <- function(u) if (p) c(pacfToAr(tanh(u[seq_len(p)])), u[-seq_len(p)]) else u
  u0 <- if (p) c(atanh(arToPacf(cf[seq_len(p)])), cf[-seq_len(p)]) else cf
  g <- function(u) f(toNat(u))
  Hu <- optimHess(u0, g); Hu3 <- hessAt(g, u0, 1e-5)
  Jf <- Jc <- matrix(0, k, k)
  for (j in 1:k) { du <- replace(numeric(k), j, 1e-3)
    Jf[, j] <- (toNat(u0 + du) - toNat(u0)) / 1e-3
    Jc[, j] <- (toNat(u0 + du) - toNat(u0 - du)) / 2e-3 }
  VR <- Jf %*% solve(Hu) %*% t(Jf); VR2 <- Jc %*% solve(Hu) %*% t(Jc); VR3 <- Jf %*% solve(Hu3) %*% t(Jf)
  rel <- function(V) max(abs(ft$var.coef / V - 1))
  out[[paste0("vcov_", cs$name)]] <- list(var_coef = ft$var.coef, VR = VR, rel_R = rel(VR), rel_R2 = rel(VR2),
                                          rel_R3 = rel(VR3), ratio_R = ft$var.coef / VR)
}

# (2) the kappa prior, stably
kappaStable <- function(y, arc, mac, dp, kappa) {
  n <- length(y); nd <- length(dp) - 1; cc <- -dp[-1]
  # y = A pre + B w (rows 1..n); z_t = y_t for t <= nd, w_t for t > nd
  A <- matrix(0, n + nd, nd); B <- matrix(0, n + nd, n)
  for (k in 1:nd) A[k, k] <- 1
  for (t in 1:n) {
    r <- nd + t
    for (k in 1:nd) { A[r, ] <- A[r, ] + cc[k] * A[r - k, ]; B[r, ] <- B[r, ] + cc[k] * B[r - k, ] }
    B[r, t] <- B[r, t] + 1
  }
  A <- A[nd + 1:n, , drop = FALSE]; B <- B[nd + 1:n, , drop = FALSE]
  G <- gammaMatrix(arc, mac, n)
  # z = Tz y with Tz unit lower triangular: z_t = sum_k dp[k+1] y_{t-k} for t > nd
  Lz <- matrix(0, n, n)
  for (t in 1:n) { if (t <= nd) Lz[t, t] <- 1 else Lz[t, t - 0:nd] <- dp }
  BzB <- Lz %*% B; Az <- Lz %*% A               # rows t > nd of Az are exactly 0
  Az[(nd + 1):n, ] <- 0
  S <- kappa * tcrossprod(Az) + BzB %*% G %*% t(BzB)
  zz <- drop(Lz %*% y)
  C <- chol(S); Fv <- diag(C)^2; e <- backsolve(C, zz, transpose = TRUE)
  keep <- (nd + 1):n
  s2 <- sum(e[keep]^2) / length(keep)
  list(sigma2 = s2, loglik = -0.5 * (length(keep) * log(2 * pi * s2) + sum(log(Fv[keep])) + length(keep)), resid = e)
}
kcases <- list(
  list(name = "lh_arima110", x = lh, order = c(1, 1, 0), seasonal = c(0, 0, 0)),
  list(name = "lh_arima120", x = lh, order = c(1, 2, 0), seasonal = c(0, 0, 0)),
  list(name = "usacc_airline", x = USAccDeaths, order = c(0, 1, 1), seasonal = c(0, 1, 1))
)
for (cs in kcases) {
  x <- as.numeric(cs$x); s <- frequency(cs$x)
  p <- cs$order[1]; d <- cs$order[2]; q <- cs$order[3]; P <- cs$seasonal[1]; D <- cs$seasonal[2]; Q <- cs$seasonal[3]
  dp <- diffPoly(d, D, s)
  ft <- arima(cs$x, order = cs$order, seasonal = cs$seasonal, method = "ML",
              optim.control = list(reltol = 1e-15, maxit = 2000))
  cf <- unname(coef(ft))
  res <- list(coef = cf)
  for (kap in c(1e4, 1e6, 1e8, 1e12)) {
    # R with this kappa at the same coefficients (fixed, so no refit)
    fk <- arima(cs$x, order = cs$order, seasonal = cs$seasonal, method = "ML", fixed = cf, transform.pars = FALSE,
                kappa = kap)
    e <- expandPoly(cf[seq_len(p)], cf[p + seq_len(q)], cf[p + q + seq_len(P)], cf[p + q + P + seq_len(Q)], s)
    k <- kappaStable(x, e$arc, e$mac, dp, kap)
    res[[paste0("kappa_", format(kap))]] <- list(loglik_R = fk$loglik, sigma2_R = fk$sigma2, loglik_c = k$loglik,
      sigma2_c = k$sigma2, d_loglik = fk$loglik - k$loglik, d_resid = max(abs(as.numeric(residuals(fk)) - k$resid)))
  }
  out[[cs$name]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
