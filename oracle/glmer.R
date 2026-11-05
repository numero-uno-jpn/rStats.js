source("/oracle/_anova.R")
suppressPackageStartupMessages({library(lme4); library(Rmpfr)})

# Fitted generalised linear mixed models: lme4's glmer() and its methods (fixture glmer). Behaviour in
# oracle/glmer-behaviour.md ("The fit and its results"). Each case has
#   formula, data   as in the fixture glmerDeviance (a binomial response may be cbind(successes, failures))
#   family, link    the glm family and its link
#   weights, offset optional, one value per row of data (glmer's arguments weights = and offset =)
#   nAGQ            "1" (Laplace) or "0"
# Written (expected: lme4's glmer with its default control, then the methods):
#   theta           getME(fit, "theta")
#   fixef, stdError, zValue   coef(summary(fit)) (Estimate, Std. Error, and the third column, which R labels
#                   "z value" for binomial and poisson and "t value" for the other families)
#   vcov            vcov(fit), one array per row; vcovFrom: "hessian" if lme4 computed it from its finite-difference
#                   Hessian of the deviance in (theta, beta) (its default when that Hessian exists), "RX" otherwise
#   sigma           sigma(fit)
#   varCorr, ranef  as in the fixture lmer (VarCorr(fit), ranef(fit))
#   fitted          fitted(fit) (the means mu); linearPredictor predict(fit) (the linear predictor, offset included)
#   residuals       residuals(fit) (deviance residuals, R's default for glmer); pearsonResiduals, workingResiduals,
#                   responseResiduals: residuals(fit, type = "pearson" / "working" / "response")
#   deviance        deviance(fit) (the sum of the squared deviance residuals: NOT -2 logLik)
#   logLik, df      logLik(fit) and its df; AIC, BIC; nObs nobs(fit)
#   singular        isSingular(fit)
#   messages, warnings  R's messages and warnings
# reference: the same fields (except vcovFrom, whose rule is in the behaviour document) at the exact optimum: the
#   minimiser of the Laplace deviance of oracle/glmerdev.R (the deviance at the exact conditional mode) over
#   (theta, beta) for nAGQ = 1, over theta (beta from the joint mode) for nAGQ = 0. Computed as follows.
#   1. The deviance in double precision (the conditional mode by Fisher scoring, then Newton's method, to rounding
#      error) is minimised with nlminb (PORT, the lower bounds of theta, rel.tol 1e-15) from lme4's estimate; then
#      every random-effects term whose block is not 0 is removed in turn (its block held at 0, the rest minimised
#      again): if that is lower by more than 1e-8 (relative), the minimisation starts again from there.
#   2. Diagonal elements of theta below 1e-6 are fixed at 0; the one-sided derivative of the deviance there must
#      be positive (checked in 110-bit arithmetic), so the optimum is on the boundary.
#   3. Newton's method on the free elements in 110-bit arithmetic (Rmpfr): the deviance with the conditional mode
#      found by Newton's method from the double-precision mode until a step is below 1e-14 (relative; the mode is
#      then accurate to about 1e-30), the gradient by central differences (step 1e-13, accurate to about 1e-16),
#      the inverse Hessian once from central differences of the double-precision deviance (step 1e-4), until the
#      Newton step is below 1e-16 or stops shrinking below 1e-14. "newtonSteps" records the steps taken and
#      "gradient" the largest absolute element of the gradient at the result (free elements; 1e-15 or less, 1e-17
#      in most cases).
#   4. All fields at that optimum in 110-bit arithmetic. vcov: 2 [H^-1]_(beta, beta) with H the Hessian of the
#      deviance in (theta, beta) (central differences in 110-bit arithmetic, step 1e-7, at the optimum; accurate
#      to about 1e-14) when nAGQ = 1, the fit is not singular, nObs < 10000 and length(theta) + length(beta) < 20;
#      otherwise sigma^2 (RX'RX)^-1 with RX'RX = X'WX - X'W Z Lambda (Lambda'Z'W Z Lambda + I)^-1 Lambda'Z'WX and W
#      the working weights at the conditional mode. sigma: 1 for binomial and poisson, otherwise
#      sqrt((sum of the squared Pearson residuals + |u|^2) / nObs).
#   messages: lme4's messages without "boundary (singular) fit: see help('isSingular')", followed by it if the
#   reference is singular; warnings: lme4's warnings without those of its optimiser and its convergence checks.
#   "devianceAtLme4" is the exact Laplace deviance at lme4's estimates (theta, beta), which is never lower than
#   -2 logLik of the reference; "start" says where step 1 ended up starting.
#   The response yn is a factor in R (a character response is an error in lme4); the fixture writes it as strings.

BITS <- 110
mp <- function(v) mpfr(v, BITS)
colv <- function(v) { dim(v) <- c(length(v), 1L); v }
is_mp <- function(x) isS4(x)
PI <- function(x) if (is_mp(x)) Const("pi", BITS) else pi

# ---- families (without lme4's clamps; none is active at the fixture's optima) ----
linkinv <- function(eta, link) {
  switch(link,
    logit = { m <- 1 / (1 + exp(-eta)); list(mu = m, d = m * (1 - m)) },
    probit = list(mu = pnorm(eta), d = exp(-eta^2 / 2) / sqrt(2 * PI(eta))),
    cloglog = list(mu = -expm1(-exp(eta)), d = exp(eta - exp(eta))),
    log = list(mu = exp(eta), d = exp(eta)),
    identity = list(mu = eta, d = eta * 0 + 1),
    inverse = list(mu = 1 / eta, d = -1 / eta^2),
    sqrt = list(mu = eta^2, d = 2 * eta),
    "1/mu^2" = list(mu = 1 / sqrt(eta), d = -1 / (2 * eta^1.5)),
    stop("link ", link))
}
variance <- function(mu, family)
  switch(family, binomial = mu * (1 - mu), poisson = mu, Gamma = mu^2, inverse.gaussian = mu^3, gaussian = mu * 0 + 1)
ylogy <- function(y, mu) { r <- y * log(y / mu); r[y == 0] <- 0; r }
xlogm <- function(x, m) { r <- x * log(m); r[x == 0] <- 0; r }
devres <- function(y, mu, wt, family)
  switch(family,
    binomial = 2 * wt * (ylogy(y, mu) + ylogy(1 - y, 1 - mu)),
    poisson = 2 * wt * (ylogy(y, mu) - (y - mu)),
    Gamma = -2 * wt * (log(y / mu) - (y - mu) / mu),
    inverse.gaussian = wt * (y - mu)^2 / (y * mu^2),
    gaussian = wt * (y - mu)^2)
aic_of <- function(y, nb, mu, wt, dev, family) {
  cv <- if (is_mp(mu)) mp else identity
  twopi <- 2 * PI(mu)
  switch(family,
    binomial = {
      m <- if (any(nb > 1)) nb else wt
      yy <- round(m * y); m <- round(m)
      keep <- m > 0
      k <- cv(yy[keep]); mm <- cv(m[keep]); mk <- mu[keep]
      ld <- lgamma(mm + 1) - lgamma(k + 1) - lgamma(mm - k + 1) + xlogm(k, mk) + xlogm(mm - k, 1 - mk)
      -2 * sum((wt[keep] / m[keep]) * ld)
    },
    poisson = -2 * sum(wt * (xlogm(cv(y), mu) - mu - lgamma(cv(y) + 1))),
    Gamma = {
      disp <- dev / sum(wt); a <- 1 / disp; s <- mu * disp
      -2 * sum(wt * (-lgamma(a) - a * log(s) + (a - 1) * log(cv(y)) - cv(y) / s)) + 2
    },
    inverse.gaussian = sum(wt) * (log(dev / sum(wt) * twopi) + 1) + 3 * sum(log(cv(y)) * wt) + 2,
    gaussian = length(y) * (log(twopi * dev / length(y)) + 1) + 2 - sum(log(cv(wt))))
}

# ---- the model, from lme4's own processing of the inputs ----
lme4_args <- function(a) {
  dat <- a$data
  extra <- list()
  if (!is.null(a$weights)) { dat$.w <- as.numeric(a$weights); extra$weights <- quote(.w) }
  if (!is.null(a$offset)) { dat$.o <- as.numeric(a$offset); extra$offset <- quote(.o) }
  list(dat = dat, fam = get(a$family, mode = "function")(link = a$link), extra = extra)
}
fit_lme4 <- function(a) {
  la <- lme4_args(a)
  do.call(glmer, c(list(formula = as.formula(a$formula), data = la$dat, family = la$fam,
                        nAGQ = as.integer(a$nAGQ)), la$extra))
}
prepare <- function(a) {
  la <- lme4_args(a)
  glmod <- suppressMessages(suppressWarnings(do.call(glFormula, c(list(formula = as.formula(a$formula),
    data = la$dat, family = la$fam), la$extra))))
  resp <- suppressWarnings(mkRespMod(glmod$fr, family = la$fam))
  rt <- glmod$reTrms
  X <- glmod$X
  s <- list(y = as.numeric(resp$y), wt = as.numeric(resp$weights), nb = as.numeric(resp$n),
       off = as.numeric(resp$offset), X = X, Z = t(as.matrix(rt$Zt)), Lt = rt$Lambdat, Lind = rt$Lind,
       lower = rt$lower, rt = rt, n = nrow(X), p = ncol(X), q = nrow(rt$Zt), nth = length(rt$lower),
       family = a$family, link = a$link, nagq = as.integer(a$nAGQ),
       useSc = !(a$family %in% c("binomial", "poisson")))
  # sparse layout for the mpfr computations: the columns of Z Lambda (rows where they can be nonzero, and their
  # terms Z[, k] theta_t), the columns of X, and the pairs of columns whose rows overlap
  Lt <- s$Lt; Lt@x <- as.numeric(seq_along(s$Lind)); pos <- t(as.matrix(Lt))   # pos[k, j]: Lambda[k, j]'s entry
  s$lam <- lapply(which(pos != 0), function(e) { k <- (e - 1) %% s$q + 1; j <- (e - 1) %/% s$q + 1
    c(k = k, j = j, t = s$Lind[pos[e]]) })
  s$zcols <- lapply(seq_len(s$q), function(j) {
    ks <- which(pos[, j] != 0)
    rows <- sort(unique(unlist(lapply(ks, function(k) which(s$Z[, k] != 0)))))
    list(i = rows, terms = lapply(ks, function(k) list(z = s$Z[rows, k], t = s$Lind[pos[k, j]])))
  })
  s$xcols <- lapply(seq_len(s$p), function(j) mp(s$X[, j]))
  sup <- c(lapply(s$zcols, `[[`, "i"), rep(list(seq_len(s$n)), s$p))
  s$pairs <- lapply(seq_along(sup), function(j) {
    out <- list()
    for (l in j:length(sup)) {
      r <- intersect(sup[[j]], sup[[l]])
      if (length(r)) out[[length(out) + 1]] <- list(l = l, r = r, a = match(r, sup[[j]]), b = match(r, sup[[l]]))
    }
    out
  })
  s
}

# ---- the deviance in double precision (for the search) ----
# The Laplace deviance at (theta, beta) (nAGQ = 1) or theta (nAGQ = 0), at the exact conditional mode (Fisher
# scoring, then Newton's method, with step halving, to rounding error). v0: start of the unknowns (u, or (u, beta)).
evaluate_d <- function(s, theta, beta = NULL, v0 = NULL) {
  Lt <- s$Lt; Lt@x <- theta[s$Lind]; ZL <- s$Z %*% t(as.matrix(Lt))
  q <- s$q; p <- s$p; iu <- seq_len(q)
  yv <- s$y; wt <- s$wt; fam <- s$family; link <- s$link
  if (s$nagq >= 1L) { M <- ZL; off <- s$off + as.vector(s$X %*% beta) } else { M <- cbind(ZL, s$X); off <- s$off }
  v <- if (is.null(v0)) numeric(ncol(M)) else v0
  score <- function(eta) { li <- linkinv(eta, link); wt * (yv - li$mu) * li$d / variance(li$mu, fam) }
  pdev <- function(v) {
    li <- linkinv(off + as.vector(M %*% v), link)
    sum(devres(yv, li$mu, wt, fam)) + sum(v[iu]^2)
  }
  f0 <- pdev(v)
  if (!is.finite(f0)) stop("the start is not valid")
  newton <- FALSE; conv <- FALSE
  for (it in 1:400) {
    eta <- off + as.vector(M %*% v)
    li <- linkinv(eta, link)
    g <- as.vector(crossprod(M, score(eta))); g[iu] <- g[iu] - v[iu]   # minus half the gradient of pdev
    Hof <- function(C) { H <- crossprod(M * C, M); diag(H)[iu] <- diag(H)[iu] + 1; H }
    step <- NULL
    if (newton) {
      h <- 1e-6 * pmax(1, abs(eta))
      step <- tryCatch(solve(Hof(-(score(eta + h) - score(eta - h)) / (2 * h)), g), error = function(e) NULL)
    }
    if (is.null(step)) step <- solve(Hof(wt * li$d^2 / variance(li$mu, fam)), g)
    vn <- v + step; f1 <- pdev(vn); hc <- 0
    while ((!is.finite(f1) || f1 > f0 + 1e-12 * abs(f0)) && hc < 40) { step <- step / 2; vn <- v + step; f1 <- pdev(vn); hc <- hc + 1 }
    if (!is.finite(f1)) stop("no valid step")
    f0 <- f1; v <- vn
    sz <- max(abs(step)) / max(1, max(abs(v)))
    if (sz < 1e-4) newton <- TRUE
    if (sz < 1e-14 || (it > 60 && sz < 1e-12)) { conv <- TRUE; break }
  }
  if (!conv) stop("the conditional mode did not converge")
  eta <- off + as.vector(M %*% v)
  li <- linkinv(eta, link)
  W <- wt * li$d^2 / variance(li$mu, fam)
  A <- crossprod(ZL * W, ZL); diag(A) <- diag(A) + 1
  dr <- sum(devres(yv, li$mu, wt, fam))
  list(dev = 2 * sum(log(diag(chol(A)))) + sum(v[iu]^2) + aic_of(s$y, s$nb, li$mu, wt, dr, fam), v = v)
}

# ---- the deviance in mpfr, on the sparse layout (Rmpfr's matrices are too slow) ----
# Cholesky factor of a symmetric matrix given as rows (rows[[j]] = A[j, j:k]); the factor in the same layout
mpv_chol <- function(rows) {
  k <- length(rows)
  for (j in seq_len(k)) {
    r <- rows[[j]]
    if (!(r[1] > 0)) stop("matrix not positive definite")
    r <- r / sqrt(r[1]); rows[[j]] <- r
    if (j < k) for (i in (j + 1):k) {
      f <- r[i - j + 1]
      if (f != 0) rows[[i]] <- rows[[i]] - f * r[(i - j + 1):(k - j + 1)]
    }
  }
  rows
}
mpv_solve <- function(R, b) {   # (R'R) x = b
  k <- length(R); y <- mp(b)
  for (j in seq_len(k)) {
    y[j] <- y[j] / R[[j]][1]
    if (j < k) y[(j + 1):k] <- y[(j + 1):k] - y[j] * R[[j]][-1]
  }
  x <- y
  for (i in k:1) {
    if (i < k) x[i] <- x[i] - sum(R[[i]][-1] * x[(i + 1):k])
    x[i] <- x[i] / R[[i]][1]
  }
  x
}
mpv_inverse <- function(R) {
  k <- length(R)
  lapply(seq_len(k), function(j) mpv_solve(R, as.numeric(seq_len(k) == j)))   # columns of the inverse
}
mpv_logdet <- function(R) 2 * sum(log(do.call(c, lapply(R, function(r) r[1]))))
# Gram matrix sum_i C_i col_j[i] col_l[i] of the columns (values on their rows), plus 1 on the first `ones` diagonals
mpv_gram <- function(s, cols, C, ones) {
  k <- length(cols)
  lapply(seq_len(k), function(j) {
    r <- mp(numeric(k - j + 1))
    for (pr in s$pairs[[j]]) if (pr$l <= k) r[pr$l - j + 1] <- sum(C[pr$r] * cols[[j]][pr$a] * cols[[pr$l]][pr$b])
    if (j <= ones) r[1] <- r[1] + 1
    r
  })
}

# The deviance in mpfr at the mode reached by Newton's method from v0 (a double-precision mode at nearby
# parameters): steps until one is below 1e-14 (relative), which leaves an error of about 1e-30
evaluate_mp <- function(s, theta, beta = NULL, v0, full = FALSE) {
  q <- s$q; p <- s$p; n <- s$n; iu <- seq_len(q)
  yv <- mp(s$y); wt <- s$wt; fam <- s$family; link <- s$link
  zl <- lapply(s$zcols, function(zc) Reduce(`+`, lapply(zc$terms, function(tt) tt$z * theta[tt$t])))
  cols <- if (s$nagq >= 1L) zl else c(zl, s$xcols)
  rows_of <- c(lapply(s$zcols, `[[`, "i"), rep(list(seq_len(n)), p))
  k <- length(cols)
  off <- mp(s$off)
  if (s$nagq >= 1L) for (j in seq_len(p)) off <- off + beta[j] * s$xcols[[j]]
  eta_of <- function(v) { e <- off; for (j in seq_len(k)) { i <- rows_of[[j]]; e[i] <- e[i] + v[j] * cols[[j]] }; e }
  score <- function(eta) { li <- linkinv(eta, link); wt * (yv - li$mu) * li$d / variance(li$mu, fam) }
  v <- mp(v0)
  for (it in 1:20) {
    eta <- eta_of(v); sc <- score(eta)
    g <- do.call(c, lapply(seq_len(k), function(j) sum(sc[rows_of[[j]]] * cols[[j]])))
    g[iu] <- g[iu] - v[iu]
    h <- mp(2^-50) * (1 + abs(eta))
    C <- -(score(eta + h) - score(eta - h)) / (2 * h)
    step <- mpv_solve(mpv_chol(mpv_gram(s, cols, C, q)), g)
    v <- v + step
    if (max(abs(asNumeric(step))) / max(1, max(abs(asNumeric(v)))) < 1e-14) break
  }
  if (it == 20) stop("the mpfr mode did not converge")
  eta <- eta_of(v)
  li <- linkinv(eta, link); mu <- li$mu
  W <- wt * li$d^2 / variance(mu, fam)
  RA <- mpv_chol(mpv_gram(s, cols[iu], W, q))
  u <- v[iu]
  di <- devres(yv, mu, wt, fam)
  dr <- sum(di); ussq <- sum(u^2)
  dev <- mpv_logdet(RA) + ussq + aic_of(s$y, s$nb, mu, wt, dr, fam)
  if (!full) return(dev)
  b <- mp(numeric(q))
  for (e in s$lam) b[e[["k"]]] <- b[e[["k"]]] + theta[e[["t"]]] * u[e[["j"]]]
  # R_X: the trailing block of the Cholesky factor of [Lambda'Z'WZ Lambda + I, Lambda'Z'WX; X'WZ Lambda, X'WX]
  Rfull <- mpv_chol(mpv_gram(s, c(zl, s$xcols), W, q))
  RX <- Rfull[q + seq_len(p)]
  list(dev = dev, u = u, b = b, eta = eta, mu = mu, d = li$d, W = W, di = di, ussq = ussq, RX = RX,
       beta = if (s$nagq >= 1L) beta else v[q + seq_len(p)])
}

# The deviance as a function of the parameter vector par (theta, then beta for nAGQ = 1), double precision, with
# the previous mode as the start of the next evaluation (env$v holds the last mode)
par_split <- function(s, par) list(theta = par[seq_len(s$nth)], beta = if (s$nagq >= 1L) par[-seq_len(s$nth)])
make_f <- function(s, v_start) {
  env <- new.env(); env$v <- v_start
  f <- function(par) {
    ps <- par_split(s, par)
    r <- tryCatch(evaluate_d(s, ps$theta, ps$beta, env$v), error = function(e) NULL)
    if (is.null(r)) {   # again from the start
      r <- tryCatch(evaluate_d(s, ps$theta, ps$beta, v_start), error = function(e) NULL)
      if (is.null(r)) return(Inf)
    }
    env$v <- r$v
    r$dev
  }
  attr(f, "env") <- env
  f
}
mode_at <- function(f, par) { f(asNumeric(par)); attr(f, "env")$v }

nl_min <- function(f, start, lower, held = integer(0)) {
  free <- setdiff(seq_along(start), held)
  if (!length(free)) return(list(par = start, value = f(start)))
  g <- function(x) { p <- start; p[free] <- x; f(p) }
  o <- nlminb(start[free], g, lower = lower[free], control = list(rel.tol = 1e-15, x.tol = 1e-13, eval.max = 20000,
                                                                  iter.max = 5000))
  p <- start; p[free] <- o$par; list(par = p, value = o$objective)
}

# Step 1: the double-precision minimum, from lme4's estimate, with the check of the boundary points of whole terms
double_optimum <- function(s, par_lme4, v_lme4) {
  f <- make_f(s, v_lme4)
  lower <- c(s$lower, rep(-Inf, length(par_lme4) - s$nth))
  best <- nl_min(f, par_lme4, lower)
  note <- "start: lme4's estimate"
  nc <- lengths(s$rt$cnms); ntheta <- nc * (nc + 1) / 2
  blocks <- split(seq_len(s$nth), rep(seq_along(nc), ntheta))
  for (round in 1:5) {
    moved <- FALSE
    for (k in seq_along(blocks)) {
      if (all(best$par[blocks[[k]]] == 0)) next
      st <- best$par; st[blocks[[k]]] <- 0
      held <- nl_min(f, st, lower, blocks[[k]])
      if (held$value < best$value - 1e-8 * max(1, abs(best$value))) {
        best <- nl_min(f, held$par, lower)
        note <- sprintf("start moved to the boundary of term %d (deviance %.10g)", k, best$value)
        moved <- TRUE
      }
    }
    if (!moved) break
  }
  list(par = best$par, value = best$value, note = note, f = f)
}

# Steps 2 and 3: Newton's method in mpfr on the free elements
mp_dev <- function(s, par, vstart) { ps <- par_split(s, par); evaluate_mp(s, ps$theta, ps$beta, vstart) }
# Hessian by central differences (mpfr), as rows of its upper triangle
mp_hessian <- function(s, par, free, f, h2 = mp(1e-7)) {
  m <- length(free)
  vs <- mode_at(f, par)
  e <- function(i, si, j, sj) { pp <- par; pp[i] <- pp[i] + si * h2; pp[j] <- pp[j] + sj * h2; mp_dev(s, pp, vs) }
  f0 <- mp_dev(s, par, vs)
  lapply(seq_len(m), function(k) {
    i <- free[k]; r <- mp(numeric(m - k + 1))
    r[1] <- (e(i, 1, i, 0) - 2 * f0 + e(i, -1, i, 0)) / h2^2
    if (k < m) for (l in (k + 1):m) {
      j <- free[l]
      r[l - k + 1] <- (e(i, 1, j, 1) - e(i, 1, j, -1) - e(i, -1, j, 1) + e(i, -1, j, -1)) / (4 * h2^2)
    }
    r
  })
}
mp_gradient <- function(s, par, free, f, h1 = mp(1e-13)) {
  vs <- mode_at(f, par)
  do.call(c, lapply(free, function(i) {
    a <- par; a[i] <- a[i] + h1; b <- par; b[i] <- b[i] - h1
    (mp_dev(s, a, vs) - mp_dev(s, b, vs)) / (2 * h1)
  }))
}
# Hessian of the double-precision deviance by central differences (for the Newton steps only)
d_hessian <- function(f, par, free, h = 1e-4) {
  m <- length(free); H <- matrix(0, m, m)
  e <- function(i, si, j, sj) { pp <- par; pp[i] <- pp[i] + si * h; pp[j] <- pp[j] + sj * h; f(pp) }
  for (k in seq_len(m)) for (l in k:m) {
    i <- free[k]; j <- free[l]
    H[k, l] <- H[l, k] <- (e(i, 1, j, 1) - e(i, 1, j, -1) - e(i, -1, j, 1) + e(i, -1, j, -1)) / (4 * h^2)
  }
  H
}
mp_optimum <- function(s, par0, f) {
  diag_el <- c(s$lower == 0, rep(FALSE, length(par0) - s$nth))
  fixed <- diag_el & par0 < 1e-6
  par <- mp(par0); par[fixed] <- mp(0)
  free <- which(!fixed)
  vs <- mode_at(f, par)
  f0 <- mp_dev(s, par, vs)
  for (i in which(fixed)) {   # the one-sided derivative at the boundary must be positive
    pp <- par; pp[i] <- mp(1e-12)
    if ((mp_dev(s, pp, vs) - f0) / mp(1e-12) <= 0) stop(sprintf("theta[%d] is not at a boundary optimum", i))
  }
  steps <- character(0); gmax <- NA
  if (length(free)) {
    Hinv <- solve(d_hessian(f, asNumeric(par), free))
    prev <- Inf
    for (it in 1:20) {
      g <- mp_gradient(s, par, free, f)
      gmax <- max(abs(asNumeric(g)))
      step <- -do.call(c, lapply(seq_along(free), function(k) sum(mp(Hinv[k, ]) * g)))
      sz <- max(abs(asNumeric(step)))
      if (sz < 1e-16 || (sz < 1e-14 && sz > prev / 4)) break   # at the level of the gradient's accuracy
      par[free] <- par[free] + step
      steps <- c(steps, sprintf("%.1e", sz)); prev <- sz
    }
    if (it == 20) stop("Newton's method did not converge")
    if (any(diag_el & !fixed & abs(asNumeric(par)) < 1e-12)) stop("an element went to the boundary in Newton's method")
    if (any(asNumeric(par[diag_el]) < 0)) stop("the optimum is outside the bounds")
  }
  list(par = par, steps = steps, gmax = gmax)
}

# ---- the fields, in the fixture's layout ----
nn <- function(x) I(num2str(asNumeric(x)))
diag_theta <- function(nc, theta) {
  out <- numeric(0); pos <- 0
  for (m in nc) { for (j in seq_len(m)) for (i in j:m) { pos <- pos + 1; if (i == j) out <- c(out, theta[pos]) } }
  out
}
ranef_layout <- function(rt, b) {
  nc <- lengths(rt$cnms); nl <- rt$nl; off <- cumsum(c(0, nc * nl)); asg <- attr(rt$flist, "assign")
  lapply(seq_along(rt$flist), function(g) {
    terms <- which(asg == g); levs <- levels(rt$flist[[g]])
    cols <- unlist(lapply(terms, function(k) rt$cnms[[k]]))
    vals <- lapply(seq_along(levs), function(l) I(num2str(unlist(lapply(terms, function(k)
      b[off[k] + (l - 1) * nc[k] + seq_len(nc[k])])))))
    list(group = names(rt$flist)[g], levels = I(levs), columns = I(cols), values = vals)
  })
}
var_corr <- function(rt, theta, scale2) {
  nc <- lengths(rt$cnms); thoff <- cumsum(c(0, nc * (nc + 1) / 2))
  lapply(seq_along(rt$cnms), function(k) {
    m <- nc[k]; T <- mpfrArray(0, BITS, dim = c(m, m)); pos <- thoff[k]
    for (j in seq_len(m)) for (i in j:m) { pos <- pos + 1; T[i, j] <- theta[pos] }
    S <- scale2 * (T %*% t(T)); sd <- sqrt(diag(S))
    C <- mpfrArray(0, BITS, dim = c(m, m))
    for (i in seq_len(m)) for (j in seq_len(m)) C[i, j] <- if (i == j) mp(1) else S[i, j] / (sd[i] * sd[j])
    list(group = names(rt$cnms)[k], columns = I(rt$cnms[[k]]), sd = nn(sd),
         corr = lapply(seq_len(m), function(i) nn(C[i, ])))
  })
}

LME4_OPTIMISER_WARNINGS <- paste0("^(Model failed to converge|Model is nearly unidentifiable|convergence code|",
  "unable to evaluate scaled gradient|Hessian is numerically singular|fixed-effect Hessian is numerically singular|",
  "variance-covariance matrix computed from finite-difference Hessian|Problem with Hessian check)")
SINGULAR_MESSAGE <- "boundary (singular) fit: see help('isSingular')"

with_conditions <- function(expr) {
  w <- character(0); msg <- character(0)
  value <- withCallingHandlers(expr,
    warning = function(cnd) { w <<- c(w, conditionMessage(cnd)); invokeRestart("muffleWarning") },
    message = function(cnd) { msg <<- c(msg, sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  list(value = value, warnings = unique(w), messages = unique(msg))
}

expected <- function(a) {
  r <- with_conditions(fit_lme4(a))
  fit <- r$value
  rt <- getME(fit, c("flist", "cnms")); s <- prepare(a)
  co <- coef(summary(fit)); V <- as.matrix(vcov(fit))
  h <- fit@optinfo$derivs$Hessian
  hess <- !is.null(h) && nrow(h) > length(fit@theta)
  vc <- VarCorr(fit); re <- ranef(fit, condVar = FALSE)
  ranef <- lapply(names(s$rt$flist), function(g) {
    m <- re[[g]]
    list(group = g, levels = I(rownames(m)), columns = I(colnames(m)),
         values = lapply(seq_len(nrow(m)), function(i) I(num2str(unname(unlist(m[i, ]))))))
  })
  ll <- logLik(fit)
  u <- function(x) I(num2str(unname(as.numeric(x))))
  list(theta = u(getME(fit, "theta")), fixef = u(co[, 1]), stdError = u(co[, 2]), zValue = u(co[, 3]),
       vcov = lapply(seq_len(nrow(V)), function(i) u(V[i, ])), vcovFrom = if (hess) "hessian" else "RX",
       sigma = num2str(sigma(fit)),
       varCorr = lapply(seq_along(vc), function(k) {
         m <- vc[[k]]; sd <- attr(m, "stddev"); C <- attr(m, "correlation")
         list(group = names(s$rt$cnms)[k], columns = I(names(sd)), sd = u(sd),
              corr = lapply(seq_len(nrow(C)), function(i) u(C[i, ])))
       }),
       ranef = ranef, fitted = u(fitted(fit)), linearPredictor = u(predict(fit)),
       residuals = u(residuals(fit)), pearsonResiduals = u(residuals(fit, type = "pearson")),
       workingResiduals = u(residuals(fit, type = "working")), responseResiduals = u(residuals(fit, type = "response")),
       deviance = num2str(deviance(fit)), logLik = num2str(as.numeric(ll)), df = num2str(attr(ll, "df")),
       AIC = num2str(AIC(fit)), BIC = num2str(BIC(fit)), nObs = nobs(fit),
       singular = isSingular(fit), messages = I(r$messages), warnings = I(r$warnings))
}

reference <- function(a) {
  r <- with_conditions(fit_lme4(a))
  fit <- r$value
  s <- prepare(a)
  t0 <- proc.time()[["elapsed"]]
  par_lme4 <- unname(if (s$nagq >= 1L) c(getME(fit, "theta"), fixef(fit)) else getME(fit, "theta"))
  v_lme4 <- unname(if (s$nagq >= 1L) getME(fit, "u") else c(getME(fit, "u"), fixef(fit)))
  dopt <- double_optimum(s, par_lme4, v_lme4)
  f <- dopt$f
  dev_lme4 <- f(par_lme4)
  opt <- mp_optimum(s, dopt$par, f)
  par <- opt$par
  ps <- par_split(s, par)
  ev <- evaluate_mp(s, ps$theta, ps$beta, mode_at(f, par), full = TRUE)
  n <- s$n; p <- s$p; nth <- s$nth
  theta <- ps$theta
  nc <- lengths(s$rt$cnms)
  singular <- any(diag_theta(nc, asNumeric(theta)) < 1e-4)
  npar <- nth + if (s$nagq >= 1L) p else 0
  derivs <- n < 1e4 && npar < 20
  yv <- mp(s$y)
  pearson <- sqrt(mp(s$wt)) * (yv - ev$mu) / sqrt(variance(ev$mu, s$family))
  sigma <- if (s$useSc) sqrt((sum(pearson^2) + ev$ussq) / n) else mp(1)
  Vb <- vector("list", p)
  if (s$nagq >= 1L && derivs && !singular) {
    Hi <- mpv_inverse(mpv_chol(mp_hessian(s, par, seq_along(par), f)))
    ib <- nth + seq_len(p)
    for (i in seq_len(p)) Vb[[i]] <- do.call(c, lapply(seq_len(p), function(j) Hi[[ib[j]]][ib[i]] + Hi[[ib[i]]][ib[j]]))
    from <- "hessian"
  } else {
    Ri <- mpv_inverse(ev$RX)
    for (i in seq_len(p)) Vb[[i]] <- sigma^2 * do.call(c, lapply(seq_len(p), function(j) Ri[[j]][i]))
    from <- "RX"
  }
  se <- sqrt(do.call(c, lapply(seq_len(p), function(i) Vb[[i]][i])))
  dev <- ev$dev
  df <- p + nth + as.integer(s$useSc)
  di <- ev$di; di[di < 0] <- 0
  dres <- sqrt(di); neg <- asNumeric(yv) <= asNumeric(ev$mu); dres[neg] <- -dres[neg]
  msgs <- setdiff(r$messages, SINGULAR_MESSAGE)
  if (singular && derivs) msgs <- c(msgs, SINGULAR_MESSAGE)
  warns <- r$warnings[!grepl(LME4_OPTIMISER_WARNINGS, r$warnings)]
  message(sprintf("%-40s %-22s nAGQ %d: %s; Newton steps %s; |gradient| %.2g; lme4: deviance + %.2g, theta %.2g, beta %.2g, se %.2g; %.0f s",
                  a$formula, paste(a$family, a$link), s$nagq, dopt$note, paste(opt$steps, collapse = " "), opt$gmax,
                  dev_lme4 - asNumeric(dev),
                  max(abs(par_lme4[seq_len(nth)] - asNumeric(theta))),
                  max(abs(unname(fixef(fit)) - asNumeric(ev$beta))),
                  max(abs(sqrt(diag(as.matrix(vcov(fit)))) - asNumeric(se)) / asNumeric(se)),
                  proc.time()[["elapsed"]] - t0))
  list(theta = nn(theta), fixef = nn(ev$beta), stdError = nn(se), zValue = nn(ev$beta / se),
       vcov = lapply(Vb, nn), vcovFrom = from, sigma = num2str(asNumeric(sigma)),
       varCorr = var_corr(s$rt, theta, mp(1)), ranef = ranef_layout(s$rt, asNumeric(ev$b)),
       fitted = nn(ev$mu), linearPredictor = nn(ev$eta),
       residuals = nn(dres), pearsonResiduals = nn(pearson), workingResiduals = nn((yv - ev$mu) / ev$d),
       responseResiduals = nn(yv - ev$mu),
       deviance = num2str(asNumeric(sum(di))), logLik = num2str(asNumeric(-dev / 2)), df = num2str(df),
       AIC = num2str(asNumeric(dev + 2 * df)), BIC = num2str(asNumeric(dev + log(mp(n)) * df)), nObs = n,
       singular = singular, messages = I(msgs), warnings = I(warns),
       devianceAtLme4 = num2str(dev_lme4), gradient = num2str(opt$gmax), newtonSteps = I(opt$steps),
       start = dopt$note)
}

# ---- data ----
cb <- as.data.frame(cbpp)
cb <- data.frame(herd = as.character(cb$herd), period = as.character(cb$period), inc = cb$incidence,
                 notinc = cb$size - cb$incidence, size = cb$size, prop = cb$incidence / cb$size,
                 stringsAsFactors = FALSE)
gt <- subset(as.data.frame(grouseticks), YEAR == "95")
gt <- data.frame(TICKS = gt$TICKS, cHEIGHT = gt$cHEIGHT, BROOD = as.character(gt$BROOD),
                 LOCATION = as.character(gt$LOCATION), stringsAsFactors = FALSE)
# the data of oracle/glmerdev.R (same seed and generation)
set.seed(20261105)
nb <- 120
dbin <- data.frame(g = rep(sprintf("g%02d", 1:12), each = 10), h = rep(sprintf("h%d", 1:6), 20),
                   x = round(runif(nb, -1, 1), 2), stringsAsFactors = FALSE)
gi <- match(dbin$g, unique(dbin$g)); hi <- match(dbin$h, unique(dbin$h))
eta <- -0.3 + 1.2 * dbin$x + rnorm(12, 0, 0.9)[gi] + rnorm(12, 0, 0.6)[gi] * dbin$x + rnorm(6, 0, 0.5)[hi]
dbin$y <- rbinom(nb, 1, plogis(eta)); dbin$yn <- factor(ifelse(dbin$y == 1, "yes", "no"))
np <- 100
dpo <- data.frame(g = rep(sprintf("g%02d", 1:10), each = 10), h = rep(sprintf("h%d", 1:5), 20),
                  x = round(runif(np, 0, 2), 2), t = round(runif(np, 1, 4), 1), w = round(runif(np, 0.5, 2), 2),
                  stringsAsFactors = FALSE)
gi <- match(dpo$g, unique(dpo$g)); hi <- match(dpo$h, unique(dpo$h))
dpo$y <- rpois(np, exp(0.4 + 0.5 * dpo$x + rnorm(10, 0, 0.6)[gi] + rnorm(10, 0, 0.3)[gi] * dpo$x + rnorm(5, 0, 0.4)[hi]))
dpo$yt <- rpois(np, dpo$t * exp(-0.2 + 0.5 * dpo$x + rnorm(10, 0, 0.6)[gi]))
ng <- 80
dgm <- data.frame(g = rep(sprintf("g%02d", 1:10), each = 8), x = round(runif(ng, 0, 2), 2),
                  w = round(runif(ng, 0.5, 2), 2), stringsAsFactors = FALSE)
gi <- match(dgm$g, unique(dgm$g))
mug <- exp(1 + 0.4 * dgm$x + rnorm(10, 0, 0.4)[gi] + rnorm(10, 0, 0.2)[gi] * dgm$x)
dgm$y <- round(rgamma(ng, shape = 4, scale = mug / 4), 4)
dgm$yi <- round(mug * exp(rnorm(ng, 0, 0.3)), 4)
dgm$yg <- round(rnorm(ng, mug, 0.4), 4)
dbna <- dbin; dbna$x[c(7, 50)] <- NA
dbw <- dbin[, c("g", "x", "y")]
# new data: Gamma with the inverse link (lme4's first PIRLS converges here), and poisson counts without a group
# effect (the optimum is on the boundary)
set.seed(20261106)
dgi <- data.frame(g = rep(sprintf("g%02d", 1:10), each = 8), x = round(runif(80, 0, 2), 2), stringsAsFactors = FALSE)
gi <- match(dgi$g, unique(dgi$g))
mui <- 1 / (3 + dgi$x + rnorm(10, 0, 0.6)[gi])
dgi$y <- round(rgamma(80, shape = 5, scale = mui / 5), 5)
dps <- data.frame(g = rep(sprintf("g%d", 1:8), each = 6), x = round(runif(48, 0, 2), 2), stringsAsFactors = FALSE)
dps$y <- rpois(48, exp(0.5 + 0.3 * dps$x))

# ---- cases ----
cases <- list()
add <- function(formula, data, family, link, nAGQ = 1, weights = NULL, offset = NULL) {
  a <- list(formula = formula, data = data, family = family, link = link)
  if (!is.null(weights)) a$weights <- I(num2str(weights))
  if (!is.null(offset)) a$offset <- I(num2str(offset))
  a$nAGQ <- as.character(nAGQ)
  cases[[length(cases) + 1]] <<- a
}
cbf <- "cbind(inc, notinc) ~ period + (1 | herd)"
# binomial: cbpp as a two-column response and as proportions with weights (the same model), three links, nAGQ 0
add(cbf, cb, "binomial", "logit")
add(cbf, cb, "binomial", "logit", 0)
add("prop ~ period + (1 | herd)", cb, "binomial", "logit", weights = cb$size)
add(cbf, cb, "binomial", "probit")
add(cbf, cb, "binomial", "cloglog")
# binomial 0/1: scalar, vector-valued (its optimum is on the boundary), crossed, nAGQ 0, a factor response,
# missing values, non-integer prior weights (R's warning)
add("y ~ x + (1 | g)", dbin, "binomial", "logit")
add("y ~ x + (x | g)", dbin, "binomial", "logit")
add("y ~ x + (1 | g) + (1 | h)", dbin, "binomial", "logit")
add("y ~ x + (1 | g) + (1 | h)", dbin, "binomial", "logit", 0)
add("yn ~ x + (1 | g)", dbin, "binomial", "logit")
add("y ~ x + (1 | g)", dbna, "binomial", "logit")
add("y ~ x + (1 | g)", dbw, "binomial", "logit", weights = rep(c(1, 2, 0.5, 3), 30))
# poisson: log and sqrt, crossed, nAGQ 0, uncorrelated vector-valued (||), an offset, prior weights, nested
# (grouseticks of 1995), and an optimum on the boundary
add("y ~ x + (1 | g)", dpo, "poisson", "log")
add("y ~ x + (1 | g) + (1 | h)", dpo, "poisson", "log")
add("y ~ x + (1 | g) + (1 | h)", dpo, "poisson", "log", 0)
add("y ~ x + (x || g)", dpo, "poisson", "log")
add("yt ~ x + (1 | g)", dpo, "poisson", "log", offset = log(dpo$t))
add("y ~ x + (1 | g)", dpo, "poisson", "log", weights = dpo$w)
add("y ~ x + (1 | g)", dpo, "poisson", "sqrt")
add("TICKS ~ cHEIGHT + (1 | LOCATION/BROOD)", gt, "poisson", "log")
add("y ~ x + (1 | g)", dps, "poisson", "log")
add("y ~ x + (1 | g)", dps, "poisson", "log", 0)
# Gamma: log (scalar, nAGQ 0, correlated vector-valued, weights) and inverse; with the inverse link on the data of
# glmerdev lme4's first PIRLS fails (the error)
add("y ~ x + (1 | g)", dgm, "Gamma", "log")
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 0)
add("y ~ x + (x | g)", dgm, "Gamma", "log")
add("y ~ x + (1 | g)", dgm, "Gamma", "log", weights = dgm$w)
add("y ~ x + (1 | g)", dgi, "Gamma", "inverse")
add("y ~ x + (1 | g)", dgm, "Gamma", "inverse")
# inverse.gaussian: log and 1/mu^2 (its optimum is on the boundary); gaussian with the log link
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "log")
add("y ~ x + (1 | g)", dgi, "inverse.gaussian", "1/mu^2")
add("yg ~ x + (1 | g)", dgm, "gaussian", "log")
add("yg ~ x + (1 | g)", dgm, "gaussian", "log", 0)

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) {
    a <- cases[[i]]
    e <- tryCatch(expected(a), error = function(e) list(error = conditionMessage(e)))
    str(e[c("theta", "fixef", "stdError", "vcovFrom", "sigma", "logLik", "messages", "warnings", "error")])
    if (is.null(e$error)) { print(system.time(rr <- reference(a))); str(rr[c("theta", "fixef", "stdError", "sigma", "logLik", "devianceAtLme4", "gradient", "newtonSteps", "messages")]) }
  }
} else write_anova_fixture("glmer", cases, expected, reference)
