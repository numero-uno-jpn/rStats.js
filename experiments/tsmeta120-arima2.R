# tsmeta120-arima2.R: stats' arima, second experiment (1.20.0). Three questions, with candidates written for this
# experiment from the help page (Fitting methods: diffuse prior for the differenced components; CSS "treating all
# earlier innovations to be zero", "part log-likelihood ... half the log of the estimated mean square"):
#   (1) var.coef: candidate V1 = solve(optimHess(coef, -loglik)) with optimHess' default steps (1e-3), the -loglik of
#       tsmeta120-arima.R (exact, sigma2 concentrated out), at R's tight estimates;
#   (2) differenced models: candidate loglik / sigma2 / residuals = those of the exact ARMA likelihood of the
#       differenced series w = (1 - B)^d (1 - B^s)^D x (with a regressor: w - beta * the same differences of xreg);
#       candidate predict: the best linear predictor of the future w from the past w, integrated back; its error
#       covariance C = Gamma_ff - Gamma_fp Gamma_pp^{-1} Gamma_pf mapped by the psi weights of 1 / delta(B);
#   (3) method = "CSS": e_t = w_t - mu - sum a_i (w_{t-i} - mu) - sum b_j e_{t-j} from t = n.cond + 1 with earlier
#       e = 0; candidate sigma2 = SS / (number of terms); loglik candidates -0.5 nu (log(2 pi sigma2) + 1) and
#       -0.5 nu log(sigma2).
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
exactLik <- function(w, arc, mac, nahead = 0) {
  n <- length(w)
  G <- gammaMatrix(arc, mac, n + nahead)
  ok <- which(!is.na(w))
  Gp <- G[ok, ok, drop = FALSE]
  C <- chol(Gp); d <- diag(C)^2
  z <- backsolve(C, w[ok], transpose = TRUE)
  m <- length(ok); s2 <- sum(z^2) / m
  res <- list(sigma2 = s2, loglik = -0.5 * (m * log(2 * pi * s2) + sum(log(d)) + m), vstd = z, nused = m)
  if (nahead > 0) {
    fut <- n + seq_len(nahead)
    g <- G[ok, fut, drop = FALSE]; W <- solve(Gp, g)
    res$wpred <- drop(crossprod(W, w[ok]))
    res$wcov <- s2 * (G[fut, fut] - crossprod(g, W))
  }
  res
}
diffPoly <- function(d, D, s) {                 # delta(B) = (1 - B)^d (1 - B^s)^D, constant first
  p <- 1
  for (i in seq_len(d)) p <- polymul(p, c(1, -1))
  for (i in seq_len(D)) p <- polymul(p, seasonalPoly(1, s, -1))
  p
}
applyDiff <- function(x, dp) {
  k <- length(dp) - 1
  if (k == 0) return(x)
  sapply((k + 1):length(x), function(t) sum(dp * x[t - 0:k]))
}

cases <- list(
  list(name = "lh_ar3", x = lh, order = c(3, 0, 0), seasonal = c(0, 0, 0)),
  list(name = "lh_arima110", x = lh, order = c(1, 1, 0), seasonal = c(0, 0, 0)),
  list(name = "usacc_airline", x = USAccDeaths, order = c(0, 1, 1), seasonal = c(0, 1, 1)),
  list(name = "lakehuron_111_drift", x = LakeHuron, order = c(1, 1, 1), seasonal = c(0, 0, 0),
       xreg = as.numeric(seq_along(LakeHuron))),
  list(name = "lh_arma11", x = lh, order = c(1, 0, 1), seasonal = c(0, 0, 0))
)

for (cs in cases) {
  x <- as.numeric(cs$x); n <- length(x); s <- frequency(cs$x)
  p <- cs$order[1]; d <- cs$order[2]; q <- cs$order[3]; P <- cs$seasonal[1]; D <- cs$seasonal[2]; Q <- cs$seasonal[3]
  im <- d + D == 0
  dp <- diffPoly(d, D, s)
  fitR <- function(method, ctrl) arima(cs$x, order = cs$order, seasonal = cs$seasonal, xreg = cs$xreg,
                                       method = method, optim.control = ctrl)
  ft <- fitR("ML", list(reltol = 1e-15, maxit = 2000))
  split <- function(cf) {
    k <- 0; take <- function(m) { r <- if (m) cf[k + seq_len(m)] else numeric(0); k <<- k + m; unname(r) }
    phi <- take(p); theta <- take(q); Phi <- take(P); Theta <- take(Q)
    rest <- if (k < length(cf)) unname(cf[(k + 1):length(cf)]) else numeric(0)
    mu <- rep(0, n)
    if (im) { mu <- mu + rest[1]; rest <- rest[-1] }
    if (!is.null(cs$xreg)) mu <- mu + rest[1] * cs$xreg
    c(list(w = applyDiff(x - mu, dp)), expandPoly(phi, theta, Phi, Theta, s))
  }
  negll <- function(cf) { e <- split(cf); -exactLik(e$w, e$arc, e$mac)$loglik }
  e <- split(coef(ft))
  h <- 12
  cl <- exactLik(e$w, e$arc, e$mac, h)
  # integrate: x_t = w_t - sum_{k>=1} dp[k+1] x_{t-k}; the future errors are psi(1/delta) * w errors
  nd <- length(dp) - 1
  regpart <- numeric(n + h)
  if (!is.null(cs$xreg)) regpart <- coef(ft)[length(coef(ft))] * c(cs$xreg, max(cs$xreg) + 1:h)
  if (im) regpart <- regpart + coef(ft)[p + q + P + Q + 1]
  dev <- c(x - regpart[1:n], rep(NA, h))
  for (j in 1:h) {
    t <- n + j
    dev[t] <- cl$wpred[j] - (if (nd) sum(dp[-1] * dev[t - 1:nd]) else 0)
  }
  predc <- dev[n + 1:h] + regpart[n + 1:h]
  # psi weights of 1 / delta(B)
  inv <- numeric(h); inv[1] <- 1
  if (h > 1) for (j in 2:h) inv[j] <- -sum(dp[1 + seq_len(min(nd, j - 1))] * inv[j - seq_len(min(nd, j - 1))])
  M <- matrix(0, h, h); for (i in 1:h) for (j in 1:i) M[i, j] <- inv[i - j + 1]
  sec <- sqrt(diag(M %*% cl$wcov %*% t(M)))
  pr <- predict(ft, n.ahead = h, newxreg = if (!is.null(cs$xreg)) max(cs$xreg) + 1:h)
  V1 <- solve(optimHess(coef(ft), negll))
  rr <- as.numeric(residuals(ft))
  res <- list(
    coef = unname(coef(ft)), coef_names = names(coef(ft)), sigma2 = ft$sigma2, loglik = ft$loglik, aic = ft$aic,
    nobs = ft$nobs, n_cond = ft$n.cond, var_coef = ft$var.coef, residuals = rr,
    pred = as.numeric(pr$pred), se = as.numeric(pr$se),
    cand = list(sigma2 = cl$sigma2, loglik = cl$loglik, nused = cl$nused, vstd = cl$vstd, pred = predc, se = sec,
                V1 = V1),
    diff = list(loglik = ft$loglik - cl$loglik, sigma2 = ft$sigma2 / cl$sigma2 - 1,
                resid_tail = max(abs(rr[(nd + 1):n] - cl$vstd)), resid_head = rr[seq_len(nd)],
                pred = max(abs(pr$pred - predc)), se = max(abs(pr$se / sec - 1)),
                V1 = max(abs(ft$var.coef / V1 - 1)))
  )
  # CSS
  if (is.null(cs$xreg)) {
    fc <- fitR("CSS", list())
    fct <- fitR("CSS", list(reltol = 1e-15, maxit = 2000))
    ec <- split(coef(fct))
    w <- ec$w; arc <- ec$arc; mac <- ec$mac
    nc <- length(arc)                            # lags of w needed (n.cond beyond the differencing)
    ee <- numeric(length(w))
    for (t in seq_along(w)) {
      if (t <= nc) next
      ee[t] <- w[t] - (if (nc) sum(arc * w[t - seq_len(nc)]) else 0) -
        (if (length(mac)) { idx <- t - seq_along(mac); sum(mac * ifelse(idx > 0, ee[pmax(idx, 1)], 0)) } else 0)
    }
    used <- ee[(nc + 1):length(w)]
    nu <- length(used); s2c <- sum(used^2) / nu
    res$css <- list(coef = unname(coef(fc)), coef_tight = unname(coef(fct)), sigma2 = fct$sigma2,
                    loglik = fct$loglik, n_cond = fct$n.cond, nobs = fct$nobs, aic = fct$aic,
                    residuals = as.numeric(residuals(fct)), var_coef = fct$var.coef,
                    cand = list(nu = nu, sigma2 = s2c, ll1 = -0.5 * nu * (log(2 * pi * s2c) + 1),
                                ll2 = -0.5 * nu * log(s2c), resid = c(rep(0, nd + nc), used)))
  }
  out[[cs$name]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
