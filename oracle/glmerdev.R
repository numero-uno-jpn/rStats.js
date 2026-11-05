source("/oracle/_anova.R")
suppressPackageStartupMessages({library(lme4); library(Rmpfr)})

# The Laplace deviance of a generalised linear mixed model at given parameters: the function lme4's glmer minimises
# (fixture glmerDeviance). Behaviour in oracle/glmer-behaviour.md ("The Laplace deviance"). Each case has
#   formula, data   as in the fixture lmerTerms; a binomial response may be cbind(successes, failures)
#   family, link    the glm family ("binomial", "poisson", "Gamma", "inverse.gaussian", "gaussian") and its link
#   weights, offset optional: prior weights and offset, one per row of data (rows dropped for missing values drop
#                   theirs), as glmer's arguments weights = and offset =
#   nAGQ            1: the deviance is a function of (theta, beta), PIRLS finds the conditional modes u only;
#                   0: the deviance is a function of theta only, PIRLS finds u and beta jointly
#   theta           the covariance parameters (in the order of the structure of lmerTerms)
#   beta            the fixed effects (nAGQ = 1 only), for the columns of X after aliased columns were dropped
# Written (expected: lme4's values, from the deviance function glmer builds, see below):
#   deviance        the value of the deviance function: ldL2 + ussq + aic
#   beta            nAGQ = 1: the given beta; nAGQ = 0: the fixed effects found by PIRLS
#   u, b            the conditional modes of the spherical random effects, and b = Lambda u
#   mu              the conditional means (inverse link of eta = offset + X beta + Z b), one per row used
#   devResid        the sum of the deviance residuals at mu; ussq = |u|^2; pdev = devResid + ussq (the penalised
#                   deviance PIRLS minimises)
#   ldL2            log det(Lambda' Z' W Z Lambda + I), W the working weights (lme4: those of the last PIRLS
#                   iteration, computed from the means before its update)
#   aic             the family's aic term at mu (-2 log-likelihood, with the deviance-based dispersion for Gamma,
#                   inverse.gaussian and gaussian)
# reference: the same fields at the exact conditional mode, computed in 200-bit arithmetic (Rmpfr) from lme4's
#   processed inputs (y, prior weights, binomial sizes, offset, X, Z, Lambda): Newton's method on the penalised
#   deviance (its Hessian from the analytic Fisher part plus a central difference of the score in eta), started
#   at lme4's solution and iterated until the step is below 1e-50, then W, ldL2 and the aic at the mode. The link
#   functions are used without lme4's clamps (the oracle checks that no clamp is active). Check: lme4's own
#   formulas (working weights, log determinant, aic) evaluated at the reference mode agree with the reference
#   deviance within 1e-12 (relative) in every case. lme4's values differ from the reference by up to about 1e-5
#   (relative), because its PIRLS stops early (see the behaviour document).
#   The response yn is a factor in R (a character response is an error in lme4); the fixture writes it as strings.
#
# lme4's deviance function: glFormula, then mkGlmerDevfun(nAGQ = 0), which runs one joint PIRLS of u and beta from
# the family's starting values at the initial theta and stores its linear predictor lp0; for nAGQ = 1,
# updateGlmerDevfun(nAGQ = 1). This is what glmer does, without the optimisation over theta of its first phase
# (which only changes lp0, the point from which each evaluation's PIRLS starts). Every evaluation starts from lp0,
# not from the previous evaluation's u: the oracle evaluates each case twice, the second time after an evaluation
# at other parameters, and stops if the results are not identical. For two cases (see build) the initial theta is
# the case's theta, because lme4's first PIRLS at theta = 1 fails on these data.

BITS <- 200
mp <- function(v) mpfr(v, BITS)
colv <- function(v) { dim(v) <- c(length(v), 1L); v }

# Cholesky factor (upper triangular R with R'R = M) of an mpfr matrix, and solves with it
mp_chol <- function(M) {
  k <- nrow(M); R <- mpfrArray(0, BITS, dim = c(k, k))
  for (j in seq_len(k)) {
    s <- M[j, j]; if (j > 1) s <- s - sum(R[seq_len(j - 1), j]^2)
    if (s <= 0) stop("matrix not positive definite")
    R[j, j] <- sqrt(s)
    if (j < k) for (i in (j + 1):k) {
      t <- M[j, i]; if (j > 1) t <- t - sum(R[seq_len(j - 1), j] * R[seq_len(j - 1), i])
      R[j, i] <- t / R[j, j]
    }
  }
  R
}
mp_backsolve <- function(R, v) {  # R x = v, R upper triangular
  k <- nrow(R); x <- mp(numeric(k))
  for (i in k:1) { s <- v[i]; if (i < k) s <- s - sum(R[i, (i + 1):k] * x[(i + 1):k]); x[i] <- s / R[i, i] }
  x
}
mp_forwardsolve <- function(R, v) {  # R' x = v
  k <- nrow(R); x <- mp(numeric(k))
  for (i in 1:k) { s <- v[i]; if (i > 1) s <- s - sum(R[1:(i - 1), i] * x[1:(i - 1)]); x[i] <- s / R[i, i] }
  x
}
mp_solve_pd <- function(M, v) { R <- mp_chol(M); mp_backsolve(R, mp_forwardsolve(R, v)) }

# Inverse links and d mu / d eta, without clamps
mp_linkinv <- function(eta, link) {
  switch(link,
    logit = { m <- 1 / (1 + exp(-eta)); list(mu = m, d = m * (1 - m)) },
    probit = list(mu = pnorm(eta), d = exp(-eta^2 / 2) / sqrt(2 * Const("pi", BITS))),
    cloglog = list(mu = -expm1(-exp(eta)), d = exp(eta - exp(eta))),
    cauchit = list(mu = 1 / mp(2) + atan(eta) / Const("pi", BITS), d = 1 / (Const("pi", BITS) * (1 + eta^2))),
    log = list(mu = exp(eta), d = exp(eta)),
    identity = list(mu = eta, d = eta * 0 + 1),
    inverse = list(mu = 1 / eta, d = -1 / eta^2),
    sqrt = list(mu = eta^2, d = 2 * eta),
    "1/mu^2" = list(mu = 1 / sqrt(eta), d = -1 / (2 * eta^(mp(3) / 2))),
    stop("link ", link))
}
mp_variance <- function(mu, family)
  switch(family, binomial = mu * (1 - mu), poisson = mu, Gamma = mu^2, inverse.gaussian = mu^3, gaussian = mu * 0 + 1)
ylogy <- function(y, mu) { r <- y * log(y / mu); r[y == 0] <- 0; r }
xlogm <- function(x, m) { r <- x * log(m); r[x == 0] <- 0; r }  # x log m, 0 where x = 0
mp_devres <- function(y, mu, wt, family)
  switch(family,
    binomial = 2 * wt * (ylogy(y, mu) + ylogy(1 - y, 1 - mu)),
    poisson = 2 * wt * (ylogy(y, mu) - (y - mu)),
    Gamma = -2 * wt * (log(y / mu) - (y - mu) / mu),
    inverse.gaussian = wt * (y - mu)^2 / (y * mu^2),
    gaussian = wt * (y - mu)^2)
mp_aic <- function(y, n, mu, wt, dev, family) {
  twopi <- 2 * Const("pi", BITS)
  switch(family,
    binomial = {
      m <- if (any(n > 1)) n else wt
      yy <- round(m * y); m <- round(m)
      keep <- m > 0
      k <- mp(yy[keep]); mm <- mp(m[keep]); mk <- mu[keep]
      ld <- lgamma(mm + 1) - lgamma(k + 1) - lgamma(mm - k + 1) + xlogm(k, mk) + xlogm(mm - k, 1 - mk)
      -2 * sum((wt[keep] / m[keep]) * ld)
    },
    poisson = -2 * sum(wt * (xlogm(mp(y), mu) - mu - lgamma(mp(y) + 1))),
    Gamma = {
      disp <- dev / sum(wt); a <- 1 / disp; s <- mu * disp
      -2 * sum(wt * (-lgamma(a) - a * log(s) + (a - 1) * log(mp(y)) - y / s)) + 2
    },
    inverse.gaussian = sum(wt) * (log(dev / sum(wt) * twopi) + 1) + 3 * sum(log(mp(y)) * wt) + 2,
    gaussian = length(y) * (log(twopi * dev / length(y)) + 1) + 2 - sum(log(mp(wt))))
}

# The deviance function of lme4 for a case, and its environment
build <- function(a) {
  dat <- a$data
  fam <- get(a$family, mode = "function")(link = a$link)
  extra <- list()
  if (!is.null(a$weights)) { dat$.w <- as.numeric(a$weights); extra$weights <- quote(.w) }
  if (!is.null(a$offset)) { dat$.o <- as.numeric(a$offset); extra$offset <- quote(.o) }
  glmod <- do.call(glFormula, c(list(formula = as.formula(a$formula), data = dat, family = fam), extra))
  glmod$formula <- NULL
  # With these links, lme4's first PIRLS at the initial theta (1) diverges ("PIRLS loop resulted in NaN value"), so
  # glmer fails on these data; the deviance function is built with the case's theta as the initial theta instead
  if (paste(a$family, a$link) %in% c("Gamma inverse", "inverse.gaussian 1/mu^2"))
    glmod$reTrms$theta <- as.numeric(a$theta)
  devf <- do.call(mkGlmerDevfun, c(glmod, list(nAGQ = 0L, control = glmerControl())))
  if (as.integer(a$nAGQ) == 1L) devf <- updateGlmerDevfun(devf, glmod$reTrms, nAGQ = 1L)
  devf
}
par_of <- function(a) {
  th <- as.numeric(a$theta)
  if (as.integer(a$nAGQ) == 1L) c(th, as.numeric(a$beta)) else th
}

state <- function(e, a) {
  pp <- e$pp; resp <- e$resp
  beta <- if (as.integer(a$nAGQ) == 1L) as.numeric(a$beta) else pp$beta(1)
  list(beta = beta, u = pp$u(1), b = pp$b(1), mu = resp$mu, devResid = resp$resDev(), ussq = pp$sqrL(1),
       ldL2 = pp$ldL2(), aic = resp$aic())
}

expected <- function(a) {
  devf <- build(a); e <- environment(devf)
  par <- par_of(a)
  dev <- devf(par); s <- state(e, a)
  devf(par * 1.5 + 0.1); dev2 <- devf(par); s2 <- state(e, a)
  if (!identical(dev, dev2) || !identical(s, s2)) stop("the deviance function depends on the previous evaluation")
  nn <- function(v) I(num2str(as.numeric(v)))
  list(deviance = num2str(dev), beta = nn(s$beta), u = nn(s$u), b = nn(s$b), mu = nn(s$mu),
       devResid = num2str(s$devResid), ussq = num2str(s$ussq), pdev = num2str(s$devResid + s$ussq),
       ldL2 = num2str(s$ldL2), aic = num2str(s$aic))
}

reference <- function(a) {
  devf <- build(a); e <- environment(devf)
  nagq <- as.integer(a$nAGQ)
  par <- par_of(a)
  s0dev <- devf(par); s <- state(e, a)
  resp <- e$resp; pp <- e$pp
  y <- as.numeric(resp$y); wt <- as.numeric(resp$weights); nb <- as.numeric(resp$n)
  off <- if (nagq == 1L) as.numeric(e$baseOffset) else as.numeric(resp$offset)
  X <- as.matrix(pp$X); Z <- t(as.matrix(pp$Zt))
  Lt <- pp$Lambdat; Lt@x <- as.numeric(a$theta)[pp$Lind]; Lam <- t(as.matrix(Lt))
  n <- nrow(X); p <- ncol(X); q <- ncol(Z)
  # Z Lambda in mpfr, column by column (Lambda is sparse)
  Zm <- mpfrArray(Z, BITS, dim = dim(Z))
  ZL <- mpfrArray(0, BITS, dim = c(n, q))
  for (j in seq_len(q)) for (k in which(Lam[, j] != 0)) ZL[, j] <- ZL[, j] + Zm[, k] * Lam[k, j]
  Xm <- mpfrArray(X, BITS, dim = dim(X))
  yM <- mp(y); offM <- mp(off)
  fam <- a$family; link <- a$link
  # the unknowns v: u (nAGQ = 1) or (u, beta) (nAGQ = 0); M = [Z Lambda] or [Z Lambda, X]
  if (nagq == 1L) {
    M <- ZL; v <- mp(s$u)
    offM <- offM + as.vector(Xm %*% colv(mp(as.numeric(a$beta))))
  } else {
    M <- mpfrArray(0, BITS, dim = c(n, q + p)); M[, seq_len(q)] <- ZL; M[, q + seq_len(p)] <- Xm
    v <- mp(c(s$u, s$beta))
  }
  k <- ncol(M); iu <- seq_len(q)
  score <- function(eta) {  # w (y - mu) mu' / V: minus half the derivative of the deviance residual in eta
    li <- mp_linkinv(eta, link); wt * (yM - li$mu) * li$d / mp_variance(li$mu, fam)
  }
  h <- mp(1e-25)
  for (it in 1:30) {
    eta <- offM + as.vector(M %*% colv(v))
    sc <- score(eta)
    C <- -(score(eta + h) - score(eta - h)) / (2 * h)
    g <- as.vector(crossprod(M, colv(sc))); g[iu] <- g[iu] - v[iu]   # minus half the gradient
    H <- crossprod(M * C, M); for (j in iu) H[j, j] <- H[j, j] + 1    # half the Hessian
    step <- mp_solve_pd(H, g)
    v <- v + step
    if (asNumeric(max(abs(step))) < 1e-50) break
  }
  if (it == 30) stop("Newton's method did not converge")
  eta <- offM + as.vector(M %*% colv(v))
  li <- mp_linkinv(eta, link); mu <- li$mu
  # no clamp of lme4 is active at the mode (they are at 2^-52 from 0 or 1)
  eps <- .Machine$double.eps
  if (fam == "binomial" && (any(asNumeric(mu) < 1e3 * eps) || any(asNumeric(1 - mu) < 1e3 * eps))) stop("clamp")
  if (any(asNumeric(abs(li$d)) < 1e3 * eps) || (link == "log" && any(asNumeric(mu) < 1e3 * eps))) stop("clamp")
  W <- wt * li$d^2 / mp_variance(mu, fam)
  A <- crossprod(ZL * W, ZL); for (j in iu) A[j, j] <- A[j, j] + 1
  ldL2 <- 2 * sum(log(diag(mp_chol(A))))
  u <- v[iu]; b <- as.vector(mpfrArray(Lam, BITS, dim = dim(Lam)) %*% colv(u))
  dr <- sum(mp_devres(yM, mu, wt, fam)); ussq <- sum(u^2)
  aic <- mp_aic(y, nb, mu, wt, dr, fam)
  beta <- if (nagq == 1L) mp(as.numeric(a$beta)) else v[q + seq_len(p)]
  dev <- asNumeric(ldL2 + ussq + aic)
  # check: lme4's own formulas (weights, log determinant, aic) evaluated at the reference mode agree with it
  resp$updateMu(asNumeric(eta) - as.numeric(resp$offset))
  pp$updateXwts(resp$sqrtWrkWt()); pp$updateDecomp()
  dcheck <- pp$ldL2() + asNumeric(ussq) + resp$aic()
  cat(sprintf("%-42s %-24s nAGQ %d: lme4 - reference %10.3g; lme4's formulas at the reference mode %10.3g\n",
              a$formula, paste(a$family, a$link), nagq, s0dev - dev, dcheck - dev))
  if (abs(dcheck - dev) > 1e-12 * abs(dev)) stop("lme4's formulas at the mode do not agree with the reference")
  nn <- function(x) I(num2str(asNumeric(x)))
  list(deviance = num2str(dev), beta = nn(beta), u = nn(u), b = nn(b), mu = nn(mu),
       devResid = num2str(asNumeric(dr)), ussq = num2str(asNumeric(ussq)), pdev = num2str(asNumeric(dr + ussq)),
       ldL2 = num2str(asNumeric(ldL2)), aic = num2str(asNumeric(aic)), newtonSteps = it)
}

# ---- data ----
cb <- as.data.frame(cbpp)
cb <- data.frame(herd = as.character(cb$herd), period = as.character(cb$period), inc = cb$incidence,
                 notinc = cb$size - cb$incidence, size = cb$size, prop = cb$incidence / cb$size,
                 stringsAsFactors = FALSE)
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

# ---- cases ----
cases <- list()
add <- function(formula, data, family, link, nAGQ, theta, beta = NULL, weights = NULL, offset = NULL) {
  a <- list(formula = formula, data = data, family = family, link = link)
  if (!is.null(weights)) a$weights <- I(num2str(weights))
  if (!is.null(offset)) a$offset <- I(num2str(offset))
  a$nAGQ <- nAGQ; a$theta <- I(num2str(theta))
  if (!is.null(beta)) a$beta <- I(num2str(beta))
  cases[[length(cases) + 1]] <<- a
}
cbf <- "cbind(inc, notinc) ~ period + (1 | herd)"
# binomial, two-column response: near lme4's estimate, on the boundary, far from it
add(cbf, cb, "binomial", "logit", 1, 0.642, c(-1.398, -0.992, -1.128, -1.580))
add(cbf, cb, "binomial", "logit", 1, 0, c(-1.398, -0.992, -1.128, -1.580))
add(cbf, cb, "binomial", "logit", 1, 2.5, c(0, 0, 0, 0))
add(cbf, cb, "binomial", "logit", 1, 1e-4, c(-2.5, 1, -0.5, 0.3))
add(cbf, cb, "binomial", "logit", 0, 0.642)
add(cbf, cb, "binomial", "logit", 0, 0)
add(cbf, cb, "binomial", "logit", 0, 2)
add(cbf, cb, "binomial", "probit", 1, 0.338, c(-0.835, -0.528, -0.617, -0.800))
add(cbf, cb, "binomial", "probit", 0, 0.338)
add(cbf, cb, "binomial", "cloglog", 1, 0.587, c(-1.526, -0.916, -1.035, -1.484))
add(cbf, cb, "binomial", "cauchit", 1, 1.14, c(-1.661, -2.297, -2.375, -5.101))
add(cbf, cb, "binomial", "log", 1, 0.3, c(-1.6, -0.9, -1.0, -1.5))
# the same model as a proportion with weights; a factor (character) response; a missing value
add("prop ~ period + (1 | herd)", cb, "binomial", "logit", 1, 0.642, c(-1.398, -0.992, -1.128, -1.580), weights = cb$size)
add("prop ~ period + (1 | herd)", cb, "binomial", "logit", 0, 0.642, weights = cb$size)
add("y ~ x + (1 | g)", dbin, "binomial", "logit", 1, 0.716, c(0.005, 0.009))
add("y ~ x + (1 | g)", dbin, "binomial", "logit", 0, 0.716)
add("yn ~ x + (1 | g)", dbin, "binomial", "logit", 1, 0.716, c(0.005, 0.009))
add("y ~ x + (1 | g)", dbna, "binomial", "logit", 1, 0.716, c(0.005, 0.009))
add("y ~ x + (1 | g)", dbw, "binomial", "logit", 1, 0.9, c(-0.2, 0.4), weights = rep(c(1, 2, 0.5, 3), 30))
# vector-valued and crossed random effects
add("y ~ x + (x | g)", dbin, "binomial", "logit", 1, c(0.808, -0.476, 0), c(0.024, -0.033))
add("y ~ x + (x | g)", dbin, "binomial", "logit", 1, c(0.8, -0.3, 0.5), c(0.1, 0.5))
add("y ~ x + (x | g)", dbin, "binomial", "logit", 1, c(3, 1.5, 2), c(-1, 2))
add("y ~ x + (x | g)", dbin, "binomial", "logit", 0, c(0.8, -0.3, 0.5))
add("y ~ x + (1 | g) + (1 | h)", dbin, "binomial", "logit", 1, c(0.768, 0.444), c(0.004, 0.052))
add("y ~ x + (1 | g) + (1 | h)", dbin, "binomial", "logit", 1, c(1, 0), c(0.004, 0.052))
add("y ~ x + (1 | g) + (1 | h)", dbin, "binomial", "logit", 0, c(0.768, 0.444))
# poisson
add("y ~ x + (1 | g)", dpo, "poisson", "log", 1, 0.462, c(0.279, 0.314))
add("y ~ x + (1 | g)", dpo, "poisson", "log", 1, 0, c(0.279, 0.314))
add("y ~ x + (1 | g)", dpo, "poisson", "log", 1, 3, c(-1, 1.5))
add("y ~ x + (1 | g)", dpo, "poisson", "log", 0, 0.462)
add("y ~ x + (1 | g) + (1 | h)", dpo, "poisson", "log", 1, c(0.493, 0.541), c(0.130, 0.305))
add("y ~ x + (1 | g) + (1 | h)", dpo, "poisson", "log", 0, c(0.493, 0.541))
add("y ~ x + (x || g)", dpo, "poisson", "log", 1, c(0.686, 0.405), c(0.114, 0.442))
add("y ~ x + (x || g)", dpo, "poisson", "log", 1, c(0, 0.405), c(0.114, 0.442))
add("yt ~ x + (1 | g)", dpo, "poisson", "log", 1, 0.83, c(0.244, 0.504), offset = log(dpo$t))
add("yt ~ x + (1 | g)", dpo, "poisson", "log", 0, 0.83, offset = log(dpo$t))
add("y ~ x + (1 | g)", dpo, "poisson", "log", 1, 0.521, c(0.233, 0.299), weights = dpo$w)
add("y ~ x + (1 | g)", dpo, "poisson", "sqrt", 1, 0.336, c(1.116, 0.259))
# Gamma
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 1, 0.648, c(1.222, 0.349))
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 1, 0, c(1.222, 0.349))
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 1, 2, c(0.5, 1))
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 0, 0.648)
add("y ~ x + (1 | g)", dgm, "Gamma", "inverse", 1, 0.03, c(0.244, -0.057))
add("y ~ x + (1 | g)", dgm, "Gamma", "inverse", 0, 0.03)
add("y ~ x + (1 | g)", dgm, "Gamma", "identity", 1, 3.29, c(4.18, 1.55))
add("y ~ x + (x | g)", dgm, "Gamma", "log", 1, c(1.028, -0.474, 0.394), c(1.195, 0.324))
add("y ~ x + (1 | g)", dgm, "Gamma", "log", 1, 0.6, c(1.2, 0.35), weights = dgm$w)
# inverse.gaussian
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "1/mu^2", 1, 0.01, c(0.056, -0.023))
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "log", 1, 1.658, c(1.279, 0.448))
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "log", 0, 1.658)
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "inverse", 1, 0.295, c(0.298, -0.076))
# gaussian with a non-identity link
add("yg ~ x + (1 | g)", dgm, "gaussian", "log", 1, 0.438, c(1.214, 0.401))
add("yg ~ x + (1 | g)", dgm, "gaussian", "log", 0, 0.438)
add("yg ~ x + (1 | g)", dgm, "gaussian", "inverse", 1, 0.075, c(0.251, -0.043))
add("yg ~ x + (1 | g)", dgm, "gaussian", "log", 1, 0.4, c(1.2, 0.4), weights = dgm$w)

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) { a <- cases[[i]]; print(system.time(r <- reference(a))); str(expected(a)[c("deviance", "ldL2", "aic")]); str(r[c("deviance", "ldL2", "aic", "newtonSteps")]) }
} else write_anova_fixture("glmerDeviance", cases, expected, reference)
