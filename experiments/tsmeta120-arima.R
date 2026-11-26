# tsmeta120-arima.R: stats' arima for ARMA models without differencing (1.20.0), first experiment. The definitions of
# loglik, sigma2, residuals, var.coef and predict, compared with candidate formulas written for this experiment from the
# help page and the textbooks it cites (Brockwell and Davis 1996, sections 3.3 and 8.3; Durbin and Koopman 2001):
#   the ARMA model X_t - mu = sum a_i (X_{t-i} - mu) + e_t + sum b_j e_{t-j}, seasonal parts multiplied out;
#   Gamma = the autocovariance matrix / sigma^2 (from ARMAacf and the psi weights of ARMAtoMA),
#   Gamma = L D L' with L unit lower triangular: v = L^{-1} (x - mu) are the one-step prediction errors, D their
#   variances / sigma^2;
#   candidate sigma2 = sum(v^2 / D) / n, loglik = -0.5 (n log(2 pi sigma2) + sum log D + n);
#   candidate residuals (a) v, (b) v / sqrt(D);
#   candidate predict: the best linear predictor from the finite past, mean = mu + g' Gamma^{-1} (x - mu),
#   se = sigma sqrt(gamma0 - g' Gamma^{-1} g) (exact), and the psi-weight approximation sigma sqrt(sum_{j<h} psi_j^2);
#   candidate var.coef = the inverse of a central-difference Hessian of -loglik (the candidate above, with sigma2
#   concentrated out) at R's estimates.
# Missing values: the rows and columns of the missing times are dropped from Gamma.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)

polymul <- function(a, b) {                     # coefficients of polynomials in B, constant term first
  r <- numeric(length(a) + length(b) - 1)
  for (i in seq_along(a)) r[i:(i + length(b) - 1)] <- r[i:(i + length(b) - 1)] + a[i] * b
  r
}
expandPoly <- function(phi, theta, Phi, Theta, s) {
  arpoly <- polymul(c(1, -phi), if (length(Phi)) { p <- numeric(s * length(Phi) + 1); p[1] <- 1
    p[s * seq_along(Phi) + 1] <- -Phi; p } else 1)
  mapoly <- polymul(c(1, theta), if (length(Theta)) { p <- numeric(s * length(Theta) + 1); p[1] <- 1
    p[s * seq_along(Theta) + 1] <- Theta; p } else 1)
  list(arc = -arpoly[-1], mac = mapoly[-1])
}
gammaMatrix <- function(arc, mac, n) {
  psi <- if (length(arc) || length(mac)) ARMAtoMA(arc, mac, 20000) else 0
  g0 <- 1 + sum(psi^2)
  rho <- if (length(arc) || length(mac)) ARMAacf(arc, mac, lag.max = n - 1) else c(1, numeric(n - 1))
  list(G = toeplitz(unname(rho) * g0), psiw = c(1, psi), g0 = g0)
}
candidate <- function(x, mu, arc, mac, nahead = 0) {
  n <- length(x)
  gm <- gammaMatrix(arc, mac, n + nahead)
  ok <- which(!is.na(x))
  G <- gm$G[ok, ok, drop = FALSE]
  r <- x[ok] - mu[ok]
  C <- chol(G)                                   # G = C'C; with D = diag(C)^2, L = t(C) / diag(C)
  d <- diag(C)^2
  z <- backsolve(C, r, transpose = TRUE)         # z = C'^{-1} r: standardized innovations times sqrt(d)/sqrt(d)
  v <- z * sqrt(d)                               # one-step prediction errors
  m <- length(ok)
  s2 <- sum(z^2) / m
  ll <- -0.5 * (m * log(2 * pi * s2) + sum(log(d)) + m)
  res <- list(sigma2 = s2, loglik = ll, v = v, vstd = z, nused = m)
  if (nahead > 0) {
    fut <- n + seq_len(nahead)
    g <- gm$G[ok, fut, drop = FALSE]
    w <- solve(G, g)
    res$pred <- drop(crossprod(w, r))
    res$se_exact <- sqrt(s2 * (diag(gm$G[fut, fut, drop = FALSE]) - colSums(g * w)))
    res$se_psi <- sqrt(s2 * cumsum(gm$psiw[seq_len(nahead)]^2))
  }
  res
}

cases <- list(
  list(name = "lh_ar1", x = lh, order = c(1, 0, 0)),
  list(name = "lh_ar3", x = lh, order = c(3, 0, 0)),
  list(name = "lh_arma11", x = lh, order = c(1, 0, 1)),
  list(name = "lh_ma2_nomean", x = lh - 2.4, order = c(0, 0, 2), mean = FALSE),
  list(name = "presidents_ar1_na", x = presidents, order = c(1, 0, 0)),
  list(name = "presidents_sar", x = presidents, order = c(2, 0, 1), seasonal = c(1, 0, 0)),
  list(name = "lakehuron_xreg", x = LakeHuron, order = c(2, 0, 0), xreg = as.numeric(time(LakeHuron) - 1920))
)

for (cs in cases) {
  im <- if (is.null(cs$mean)) TRUE else cs$mean
  sea <- if (is.null(cs$seasonal)) c(0, 0, 0) else cs$seasonal
  fitR <- function(ctrl, method = "CSS-ML") arima(cs$x, order = cs$order, seasonal = sea, xreg = cs$xreg,
                                                   include.mean = im, method = method, optim.control = ctrl)
  f <- fitR(list())
  ft <- fitR(list(reltol = 1e-15, maxit = 2000), method = "ML")
  x <- as.numeric(cs$x); n <- length(x); s <- frequency(cs$x)
  p <- cs$order[1]; q <- cs$order[3]; P <- sea[1]; Q <- sea[3]
  split <- function(cf) {
    k <- 0; take <- function(m) { r <- if (m) cf[k + seq_len(m)] else numeric(0); k <<- k + m; unname(r) }
    phi <- take(p); theta <- take(q); Phi <- take(P); Theta <- take(Q)
    rest <- if (k < length(cf)) unname(cf[(k + 1):length(cf)]) else numeric(0)
    mu <- rep(0, n)
    if (im) { mu <- mu + rest[1]; rest <- rest[-1] }
    if (!is.null(cs$xreg)) mu <- mu + rest[1] * cs$xreg
    c(list(mu = mu), expandPoly(phi, theta, Phi, Theta, s))
  }
  negll <- function(cf) { e <- split(cf); -candidate(x, e$mu, e$arc, e$mac)$loglik }
  cand <- function(cf, h = 0) { e <- split(cf); candidate(x, e$mu, e$arc, e$mac, h) }
  # central-difference Hessian with steps relative to the coefficients
  hess <- function(cf) {
    k <- length(cf); H <- matrix(0, k, k); hstep <- 1e-4 * pmax(abs(cf), 1e-2)
    for (i in 1:k) for (j in 1:k) {
      e1 <- replace(numeric(k), i, hstep[i]); e2 <- replace(numeric(k), j, hstep[j])
      H[i, j] <- (negll(cf + e1 + e2) - negll(cf + e1 - e2) - negll(cf - e1 + e2) + negll(cf - e1 - e2)) /
        (4 * hstep[i] * hstep[j])
    }
    H
  }
  cd <- cand(coef(f), 10); ct <- cand(coef(ft), 10)
  pr <- predict(f, n.ahead = 10, newxreg = if (!is.null(cs$xreg)) max(cs$xreg) + 1:10)
  prt <- predict(ft, n.ahead = 10, newxreg = if (!is.null(cs$xreg)) max(cs$xreg) + 1:10)
  # the xreg forecast mean: the candidate's predictor is for the deviation; add the regression part
  addx <- if (!is.null(cs$xreg)) coef(ft)[length(coef(ft))] * (max(cs$xreg) + 1:10) else 0
  addm <- if (im) coef(ft)[p + q + P + Q + 1] else 0
  out[[cs$name]] <- list(
    coef = unname(coef(f)), coef_names = names(coef(f)), sigma2 = f$sigma2, loglik = f$loglik, aic = f$aic,
    var_coef = unname(f$var.coef), nobs = f$nobs, n_cond = f$n.cond, code = f$code, arma = f$arma,
    residuals = as.numeric(residuals(f)),
    tight = list(coef = unname(coef(ft)), sigma2 = ft$sigma2, loglik = ft$loglik, var_coef = unname(ft$var.coef),
                 residuals = as.numeric(residuals(ft)), code = ft$code, pred = as.numeric(prt$pred),
                 se = as.numeric(prt$se)),
    pred = as.numeric(pr$pred), se = as.numeric(pr$se),
    cand = list(sigma2 = ct$sigma2, loglik = ct$loglik, v = ct$v, vstd = ct$vstd, nused = ct$nused,
                pred = ct$pred + addm + addx, se_exact = ct$se_exact, se_psi = ct$se_psi,
                var_coef_hess = solve(hess(coef(ft))), loglik_at_default = cd$loglik, sigma2_at_default = cd$sigma2),
    diff = list(
      loglik = ft$loglik - ct$loglik, sigma2 = ft$sigma2 / ct$sigma2 - 1,
      resid_v = max(abs(as.numeric(residuals(ft))[!is.na(x)] - ct$v)),
      resid_vstd = max(abs(as.numeric(residuals(ft))[!is.na(x)] - ct$vstd)),
      pred = max(abs(as.numeric(prt$pred) - (ct$pred + addm + addx))),
      se_exact = max(abs(as.numeric(prt$se) / ct$se_exact - 1)),
      se_psi = max(abs(as.numeric(prt$se) / ct$se_psi - 1)),
      var_coef = max(abs(ft$var.coef / solve(hess(coef(ft))) - 1)),
      loglik_default = f$loglik - cd$loglik
    )
  )
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
