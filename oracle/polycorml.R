source("/oracle/_anova.R")
suppressPackageStartupMessages({library(polycor); library(Rmpfr)})

# Maximum-likelihood polychoric and polyserial correlations and the standard errors (fixture polycorML):
# polycor::polychor / polyserial with ML = TRUE and/or std.err = TRUE. Behaviour in oracle/polycor-behaviour.md.
#   Arguments: fn, x and y (or table), ML, std.err.
#   Written (R): rho, and with std.err var (the matrix, or 1 x 1), chisq, df, n, and the thresholds (row.cuts and
#   col.cuts, or cuts); warnings.
#   reference: the same fields at the exact maximum of the likelihood. R maximises with Nelder-Mead (ML) or BFGS (the
#   two-step estimate with std.err) and takes the Hessian by finite differences, so its values are only accurate to
#   about 1e-5. The reference solves the likelihood equations by Newton's method in 160-bit arithmetic: the
#   log-likelihood and its gradient analytically, the bivariate normal probabilities as Phi(h) Phi(k) plus the integral
#   of the bivariate normal density over the correlation from 0 to rho (Gauss-Legendre, 24 points on each of 21 panels
#   whose ends approach rho geometrically, so the error stays below 1e-35 whatever rho), the Hessian by central
#   differences of the gradient (step 1e-15). var is the inverse of the Hessian of the negative log-likelihood at the
#   maximum; chisq the same formula as R's at the maximum. In the two-step estimates the thresholds stay R's
#   (qnorm of the cumulative margins), and only rho is solved for.

BITS <- 160
mp <- function(v) mpfr(v, BITS)
gl_nodes <- local({
  n <- 24; x <- mp(cos(pi * (seq_len(n) - 0.25) / (n + 0.5)))
  for (it in 1:12) {
    p0 <- mp(rep(1, n)); p1 <- x
    for (k in 2:n) { p2 <- ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 <- p1; p1 <- p2 }
    dp <- n * (x * p1 - p0) / (x^2 - 1)
    x <- x - p1 / dp
  }
  p0 <- mp(rep(1, n)); p1 <- x
  for (k in 2:n) { p2 <- ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 <- p1; p1 <- p2 }
  dp <- n * (x * p1 - p0) / (x^2 - 1)
  list(x = x, w = 2 / ((1 - x^2) * dp^2))
})
rho_grid <- function(rho) {  # nodes and weights over [0, rho]
  ends <- c(mp(0), rho * (1 - mp(2)^(-(1:20))), rho)
  r <- list(); w <- list()
  for (k in 1:21) {
    a <- ends[k]; b <- ends[k + 1]; h <- (b - a) / 2; m <- (a + b) / 2
    r[[k]] <- m + h * gl_nodes$x; w[[k]] <- h * gl_nodes$w
  }
  list(r = do.call("c", r), w = do.call("c", w))
}
Phi <- function(x) Rmpfr::pnorm(x)
phi1 <- function(x) exp(-x^2 / 2) / sqrt(2 * Const("pi", BITS))
phi2 <- function(h, k, r) exp(-(h^2 - 2 * r * h * k + k^2) / (2 * (1 - r^2))) / (2 * Const("pi", BITS) * sqrt(1 - r^2))
# F(h, k) = P(X <= h, Y <= k) for the standard bivariate normal with correlation rho; h, k: mpfr or +-Inf (numeric)
bvn <- function(h, k, rho, grid) {
  if (is.numeric(h) && h == -Inf || is.numeric(k) && k == -Inf) return(mp(0))
  if (is.numeric(h) && h == Inf) return(if (is.numeric(k)) mp(1) else Phi(k))
  if (is.numeric(k) && k == Inf) return(Phi(h))
  Phi(h) * Phi(k) + sum(grid$w * phi2(h, k, grid$r))
}
dbvn_dh <- function(h, k, rho) {  # d F / d h
  if (is.numeric(h)) return(mp(0))
  if (is.numeric(k)) return(if (k == Inf) phi1(h) else mp(0))
  phi1(h) * Phi((k - rho * h) / sqrt(1 - rho^2))
}
dbvn_drho <- function(h, k, rho) if (is.numeric(h) || is.numeric(k)) mp(0) else phi2(h, k, rho)
cutlist <- function(v) c(list(-Inf), lapply(seq_along(v), function(i) v[i]), list(Inf))

# polychoric log-likelihood and gradient in (rho, row cuts, col cuts); free: which of them are parameters
pc_loglik_grad <- function(theta, tab, rc0, cc0, free_cuts) {
  r <- nrow(tab); c <- ncol(tab); rho <- theta[1]
  rc <- if (free_cuts) theta[2:r] else rc0; cc <- if (free_cuts) theta[(r + 1):(r + c - 1)] else cc0
  a <- cutlist(rc); b <- cutlist(cc); grid <- rho_grid(rho)
  Fm <- matrix(list(), r + 1, c + 1)
  for (i in 1:(r + 1)) for (j in 1:(c + 1)) Fm[[i, j]] <- bvn(a[[i]], b[[j]], rho, grid)
  ll <- mp(0); g <- mp(rep(0, if (free_cuts) r + c - 1 else 1))
  for (i in 1:r) for (j in 1:c) {
    if (tab[i, j] == 0) next
    P <- Fm[[i + 1, j + 1]] - Fm[[i, j + 1]] - Fm[[i + 1, j]] + Fm[[i, j]]
    ll <- ll + tab[i, j] * log(P)
    wt <- tab[i, j] / P
    g[1] <- g[1] + wt * (dbvn_drho(a[[i + 1]], b[[j + 1]], rho) - dbvn_drho(a[[i]], b[[j + 1]], rho) -
                         dbvn_drho(a[[i + 1]], b[[j]], rho) + dbvn_drho(a[[i]], b[[j]], rho))
    if (free_cuts) {
      if (i < r) g[1 + i] <- g[1 + i] + wt * (dbvn_dh(a[[i + 1]], b[[j + 1]], rho) - dbvn_dh(a[[i + 1]], b[[j]], rho))
      if (i > 1) g[i] <- g[i] - wt * (dbvn_dh(a[[i]], b[[j + 1]], rho) - dbvn_dh(a[[i]], b[[j]], rho))
      if (j < c) g[r + j] <- g[r + j] + wt * (dbvn_dh(b[[j + 1]], a[[i + 1]], rho) - dbvn_dh(b[[j + 1]], a[[i]], rho))
      if (j > 1) g[r + j - 1] <- g[r + j - 1] - wt * (dbvn_dh(b[[j]], a[[i + 1]], rho) - dbvn_dh(b[[j]], a[[i]], rho))
    }
  }
  list(ll = ll, g = g)
}
# polyserial log-likelihood and gradient in (rho, cuts)
ps_loglik_grad <- function(theta, z, yi, s, cuts0, free_cuts) {
  rho <- theta[1]; cuts <- if (free_cuts) theta[-1] else cuts0
  sq <- sqrt(1 - rho^2); zz <- mp(z)
  ll <- sum(-zz^2 / 2) - length(z) * log(sqrt(2 * Const("pi", BITS)))
  g <- mp(rep(0, if (free_cuts) s else 1))
  for (j in 1:s) {
    idx <- which(yi == j); if (length(idx) == 0) next
    zj <- zz[idx]
    hi <- if (j < s) (cuts[j] - rho * zj) / sq else NULL
    lo <- if (j > 1) (cuts[j - 1] - rho * zj) / sq else NULL
    D <- (if (is.null(hi)) 1 else Phi(hi)) - (if (is.null(lo)) 0 else Phi(lo))
    ll <- ll + sum(log(D))
    dr <- (if (is.null(hi)) 0 else phi1(hi) * (rho * cuts[j] - zj)) - (if (is.null(lo)) 0 else phi1(lo) * (rho * cuts[j - 1] - zj))
    g[1] <- g[1] + sum(dr / (sq^3 * D))
    if (free_cuts) {
      if (j < s) g[1 + j] <- g[1 + j] + sum(phi1(hi) / (sq * D))
      if (j > 1) g[j] <- g[j] - sum(phi1(lo) / (sq * D))
    }
  }
  list(ll = ll, g = g)
}
gauss_solve <- function(A, b) {  # A: list of mpfr rows
  n <- length(b)
  for (k in 1:n) {
    p <- which.max(abs(as.numeric(sapply(k:n, function(i) asNumeric(A[[i]][k]))))) + k - 1
    if (p != k) { t <- A[[k]]; A[[k]] <- A[[p]]; A[[p]] <- t; t <- b[k]; b[k] <- b[p]; b[p] <- t }
    if (k < n) for (i in (k + 1):n) { f <- A[[i]][k] / A[[k]][k]; A[[i]] <- A[[i]] - f * A[[k]]; b[i] <- b[i] - f * b[k] }
  }
  x <- mp(rep(0, n))
  for (i in n:1) x[i] <- (b[i] - (if (i < n) sum(A[[i]][(i + 1):n] * x[(i + 1):n]) else 0)) / A[[i]][i]
  x
}
newton_max <- function(fg, theta0) {
  theta <- mp(theta0)
  for (it in 1:30) {
    v <- fg(theta); n <- length(theta)
    H <- lapply(seq_len(n), function(i) { e <- mp(rep(0, n)); e[i] <- mp(1e-15)
      (fg(theta + e)$g - fg(theta - e)$g) / mp(2e-15) })
    step <- gauss_solve(H, v$g)
    theta <- theta - step
    if (max(abs(asNumeric(step))) < 1e-32) break
  }
  v <- fg(theta)
  n <- length(theta)
  H <- lapply(seq_len(n), function(i) { e <- mp(rep(0, n)); e[i] <- mp(1e-15)
    (fg(theta + e)$g - fg(theta - e)$g) / mp(2e-15) })
  Hs <- lapply(seq_len(n), function(i) (H[[i]] + do.call("c", lapply(H, function(row) row[i]))) / 2)
  # var = (-H)^-1, column by column
  V <- lapply(seq_len(n), function(j) { e <- mp(rep(0, n)); e[j] <- mp(-1); gauss_solve(Hs, e) })
  list(theta = theta, ll = v$ll, gmax = max(abs(asNumeric(v$g))), var = V, iter = it)
}

set.seed(20261127)
n <- 300
z <- MASS::mvrnorm(n, c(0, 0), matrix(c(1, 0.55, 0.55, 1), 2))
cut3 <- function(v, b) as.integer(cut(v, c(-Inf, b, Inf)))
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (o in list(c(TRUE, TRUE), c(FALSE, TRUE), c(TRUE, FALSE))) {
  add(fn = "polychor", x = I(cut3(z[, 1], 0)), y = I(cut3(z[, 2], 0.3)), ML = o[1], std.err = o[2])
  add(fn = "polychor", x = I(cut3(z[, 1], c(-0.5, 0.6))), y = I(cut3(z[, 2], c(-1, 0, 1))), ML = o[1], std.err = o[2])
  add(fn = "polyserial", x = I(round(z[, 1], 3)), y = I(cut3(z[, 2], c(-0.5, 0.6))), ML = o[1], std.err = o[2])
}
for (o in list(c(TRUE, TRUE), c(FALSE, TRUE))) {
  add(fn = "polychor", x = I(cut3(z[, 1], c(-1, -0.2, 0.4, 1.2))), y = I(cut3(-z[, 2], c(-0.7, 0.7))), ML = o[1], std.err = o[2])
  add(fn = "polychor", table = matrix(c(20, 5, 2, 8, 30, 6, 1, 9, 25), 3), ML = o[1], std.err = o[2])
  add(fn = "polychor", table = matrix(c(40, 0, 3, 0, 0, 0, 2, 0, 35), 3), ML = o[1], std.err = o[2])
  add(fn = "polychor", table = matrix(c(50, 4, 3, 48), 2), ML = o[1], std.err = o[2])
  add(fn = "polyserial", x = I(round(z[, 1], 3)), y = I(cut3(z[, 2], 0)), ML = o[1], std.err = o[2])
  add(fn = "polyserial", x = I(round(-z[, 1], 3)), y = I(cut3(z[, 2], c(-1, -0.2, 0.4, 1.2))), ML = o[1], std.err = o[2])
}

run_r <- function(a) {
  switch(a$fn,
    polychor = if (!is.null(a$table)) polychor(a$table, ML = a$ML, std.err = a$std.err)
               else polychor(unclass(a$x), unclass(a$y), ML = a$ML, std.err = a$std.err),
    polyserial = polyserial(unclass(a$x), unclass(a$y), ML = a$ML, std.err = a$std.err))
}
fields <- function(v, fn) {
  if (!is.list(v)) return(list(rho = num2str(v)))
  out <- list(rho = num2str(v$rho), var = lapply(seq_len(NROW(v$var)), function(i) I(num2str(as.matrix(v$var)[i, ]))),
              chisq = num2str(v$chisq), df = v$df, n = v$n)
  if (fn == "polychor") { out$row.cuts <- I(num2str(v$row.cuts)); out$col.cuts <- I(num2str(v$col.cuts)) }
  else out$cuts <- I(num2str(v$cuts))
  out
}
write_anova_fixture("polycorML", cases, function(a) {
  r <- with_warnings(function() run_r(a))
  c(fields(r$value, a$fn), list(warnings = r$warnings))
}, ref = function(a) {
  v <- suppressWarnings(run_r(a))
  if (a$fn == "polychor") {
    tab <- if (!is.null(a$table)) a$table else table(unclass(a$x), unclass(a$y))
    tab <- tab[rowSums(tab) > 0, , drop = FALSE]; tab <- tab[, colSums(tab) > 0, drop = FALSE]
    tab <- unclass(as.matrix(tab)); nn <- sum(tab); r <- nrow(tab); c <- ncol(tab)
    rc <- qnorm(cumsum(rowSums(tab)) / nn)[-r]; cc <- qnorm(cumsum(colSums(tab)) / nn)[-c]
    start <- if (is.list(v)) c(v$rho, if (a$ML) c(v$row.cuts, v$col.cuts)) else c(v, rc, cc)
    if (!a$ML) start <- start[1]
    fg <- function(th) pc_loglik_grad(th, tab, mp(rc), mp(cc), a$ML)
    m <- newton_max(fg, start)
    th <- m$theta
    out <- list(rho = num2str(asNumeric(th[1])))
    if (a$std.err) {
      out$var <- lapply(seq_along(m$var), function(i) I(num2str(asNumeric(do.call("c", lapply(m$var, function(col) col[i]))))))
      out$chisq <- num2str(asNumeric(2 * (-m$ll + sum(mp(tab) * log((mp(tab) + mp(1e-6)) / nn)))))
      out$row.cuts <- I(num2str(if (a$ML) asNumeric(th[2:r]) else rc))
      out$col.cuts <- I(num2str(if (a$ML) asNumeric(th[(r + 1):(r + c - 1)]) else cc))
    }
    out$gradient <- num2str(m$gmax); out$newtonIterations <- m$iter
    out
  } else {
    x <- unclass(a$x); y <- unclass(a$y); ok <- complete.cases(x, y); x <- x[ok]; y <- y[ok]
    zs <- as.vector(scale(x)); tabv <- table(y); s <- length(tabv); nn <- sum(tabv)
    cuts <- qnorm(cumsum(tabv) / nn)[-s]; yi <- as.numeric(as.factor(y))
    rho0 <- sqrt((nn - 1) / nn) * sd(yi) * cor(x, yi) / sum(dnorm(cuts))
    start <- if (is.list(v)) c(v$rho, if (a$ML) v$cuts) else c(v, cuts)
    if (!a$ML) start <- start[1]
    fg <- function(th) ps_loglik_grad(th, zs, yi, s, mp(cuts), a$ML)
    m <- newton_max(fg, start)
    th <- m$theta
    out <- list(rho = num2str(asNumeric(th[1])))
    if (a$std.err) {
      out$var <- lapply(seq_along(m$var), function(i) I(num2str(asNumeric(do.call("c", lapply(m$var, function(col) col[i]))))))
      # chisq as R's polyserial computes it (see the behaviour file): at the estimate for ML, at the closed-form
      # two-step start rho otherwise; the binned bivariate normal probabilities in high precision
      crho <- if (a$ML) th[1] else mp(rho0); ccuts <- if (a$ML) th[-1] else mp(cuts)
      xr <- cut(scale(yi), c(-Inf, asNumeric(ccuts), Inf)); yr <- cut(scale(zs), c(-Inf, qnorm(1:3 / 4), Inf))
      tb <- unclass(table(xr, yr)); ra <- cutlist(ccuts); cb <- cutlist(mp(qnorm(1:3 / 4))); grid <- rho_grid(crho)
      Fm <- matrix(list(), length(ra), length(cb))
      for (i in seq_along(ra)) for (j in seq_along(cb)) Fm[[i, j]] <- bvn(ra[[i]], cb[[j]], crho, grid)
      cs <- mp(0)
      for (i in 1:nrow(tb)) for (j in 1:ncol(tb)) {
        P <- Fm[[i + 1, j + 1]] - Fm[[i, j + 1]] - Fm[[i + 1, j]] + Fm[[i, j]]
        if (tb[i, j] > 0) cs <- cs + tb[i, j] * log((tb[i, j] + mp(1e-6)) / (P * nn))
      }
      out$chisq <- num2str(asNumeric(2 * cs))
      out$cuts <- I(num2str(if (a$ML) asNumeric(th[-1]) else cuts))
    }
    out$gradient <- num2str(m$gmax); out$newtonIterations <- m$iter
    out
  }
})
