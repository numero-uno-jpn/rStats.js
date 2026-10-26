source("/oracle/_anova.R")
suppressPackageStartupMessages({library(lme4); library(Rmpfr)})

# The profiled deviance of a linear mixed model at a given theta: the function lme4 minimises (fixture lmerDeviance).
# Behaviour in oracle/lmer-behaviour.md ("The profiled deviance"). Each case has
#   formula, data   as in the fixture lmerTerms (the structure is that of lFormula)
#   REML            logical
#   theta           the covariance parameters (in the order of the structure)
# Written (R, from the deviance function lme4 builds with devFunOnly = TRUE):
#   deviance        the REML criterion (REML = TRUE) or the deviance -2 log L (REML = FALSE) at theta
#   beta            the fixed effects that minimise the penalised residual sum of squares at theta
#   u               the spherical random effects; b = Lambda u the random effects
#   rss             the residual sum of squares |y - X beta - Z b|^2; ussq = |u|^2; prss = rss + ussq
#   logDetL         log det(Lambda' Z' Z Lambda + I); logDetRX: log det of X' X - X' Z Lambda (..)^-1 Lambda' Z' X
#                   (the squared Cholesky factors' log determinants)
# reference: the same fields computed in 200-bit arithmetic (Rmpfr) from the paper's formulas with dense matrices:
#   A = Lambda' Z' Z Lambda + I, the normal equations of the penalised least squares solved by Cholesky
#   decompositions, then deviance = logDetL + n (1 + log(2 pi prss / n)) (ML) or
#   logDetL + logDetRX + (n - p)(1 + log(2 pi prss / (n - p))) (REML).

BITS <- 200
mp <- function(v) mpfr(v, BITS)

# Cholesky factor (upper triangular R with R'R = M) of an mpfr matrix, and solves with it
mp_chol <- function(M) {
  k <- nrow(M); R <- mpfrArray(0, BITS, dim = c(k, k))
  for (j in seq_len(k)) {
    s <- M[j, j]; if (j > 1) s <- s - sum(R[seq_len(j - 1), j]^2)
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
mp_crossprod <- function(A, B = A) t(A) %*% B
colv <- function(v) { dim(v) <- c(length(v), 1L); v }

structure_of <- function(a) {
  lf <- lFormula(as.formula(a$formula), a$data)
  Lt <- lf$reTrms$Lambdat
  list(lf = lf, X = lf$X, Z = t(as.matrix(lf$reTrms$Zt)), y = model.response(lf$fr), Lt = Lt, Lind = lf$reTrms$Lind)
}

lambda_of <- function(s, theta) { Lt <- s$Lt; Lt@x <- theta[s$Lind]; t(as.matrix(Lt)) }

reference <- function(a) {
  s <- structure_of(a)
  theta <- as.numeric(a$theta)
  n <- nrow(s$X); p <- ncol(s$X); q <- ncol(s$Z)
  Lam <- lambda_of(s, theta)
    Zm <- mpfrArray(s$Z, BITS, dim = dim(s$Z)); Lm <- mpfrArray(Lam, BITS, dim = dim(Lam))
  ZL <- Zm %*% Lm
  X <- mpfrArray(s$X, BITS, dim = dim(s$X)); y <- mp(as.vector(s$y))
  A <- mp_crossprod(ZL); for (i in seq_len(q)) A[i, i] <- A[i, i] + 1
  RZ <- mp_chol(A)
  ZLtX <- mp_crossprod(ZL, X); ZLty <- as.vector(mp_crossprod(ZL, colv(y)))
  # R_ZX = RZ'^-1 ZL'X; R_X'R_X = X'X - R_ZX'R_ZX
  RZX <- mpfrArray(0, BITS, dim = c(q, p))
  for (j in seq_len(p)) RZX[, j] <- mp_forwardsolve(RZ, ZLtX[, j])
  XtX <- mp_crossprod(X)
  RX <- mp_chol(XtX - mp_crossprod(RZX))
  cu <- mp_forwardsolve(RZ, ZLty)
  Xty <- as.vector(mp_crossprod(X, colv(y)))
  cb <- mp_forwardsolve(RX, Xty - as.vector(mp_crossprod(RZX, colv(cu))))
  beta <- mp_backsolve(RX, cb)
  u <- mp_backsolve(RZ, cu - as.vector(RZX %*% colv(beta)))
  b <- as.vector(Lm %*% colv(u))
  r <- y - as.vector(X %*% colv(beta)) - as.vector(ZL %*% colv(u))
  rss <- sum(r^2); ussq <- sum(u^2); prss <- rss + ussq
  ldL <- 2 * sum(log(diag(RZ))); ldRX <- 2 * sum(log(diag(RX)))
  twopi <- 2 * Const("pi", BITS)
  dev <- if (isTRUE(a$REML)) ldL + ldRX + (n - p) * (1 + log(twopi * prss / (n - p))) else ldL + n * (1 + log(twopi * prss / n))
  nn <- function(v) I(num2str(asNumeric(v)))
  list(deviance = num2str(asNumeric(dev)), beta = nn(beta), u = nn(u), b = nn(b), rss = num2str(asNumeric(rss)),
       ussq = num2str(asNumeric(ussq)), prss = num2str(asNumeric(prss)), logDetL = num2str(asNumeric(ldL)),
       logDetRX = num2str(asNumeric(ldRX)))
}

expected <- function(a) {
  dat <- a$data
  devf <- lmer(as.formula(a$formula), dat, REML = isTRUE(a$REML), devFunOnly = TRUE)
  e <- environment(devf)
  dev <- devf(as.numeric(a$theta))
  rss <- e$resp$wrss(); ussq <- e$pp$sqrL(1)
  list(deviance = num2str(dev), beta = I(num2str(e$pp$beta(1))), u = I(num2str(e$pp$u(1))), b = I(num2str(e$pp$b(1))),
       rss = num2str(rss), ussq = num2str(ussq), prss = num2str(rss + ussq), logDetL = num2str(e$pp$ldL2()),
       logDetRX = num2str(e$pp$ldRX2()))
}

sleep <- as.data.frame(sleepstudy); sleep$Subject <- as.character(sleep$Subject)
pen <- as.data.frame(Penicillin); pen$plate <- as.character(pen$plate); pen$sample <- as.character(pen$sample)
pastes <- as.data.frame(Pastes)[, c("strength", "batch", "cask")]
pastes$batch <- as.character(pastes$batch); pastes$cask <- as.character(pastes$cask)
dye <- as.data.frame(Dyestuff); dye$Batch <- as.character(dye$Batch)
set.seed(20261028)
n <- 60
d <- data.frame(g = rep(sprintf("g%02d", 1:12), each = 5), h = rep(c("h1", "h2", "h3", "h4", "h5"), 12),
                x = round(runif(n, 0, 4), 2), f = rep(c("lo", "hi", "mid"), 20), stringsAsFactors = FALSE)
gi <- match(d$g, unique(d$g)); hi <- match(d$h, unique(d$h))
d$y <- round(5 + 0.8 * d$x + rnorm(12, 0, 1.2)[gi] + rnorm(12, 0, 0.4)[gi] * d$x + rnorm(5, 0, 0.7)[hi] + rnorm(n, 0, 0.6), 2)
dna <- d; dna$y[c(4, 17)] <- NA; dna$x[30] <- NA

cases <- list()
add <- function(formula, data, thetas) {
  for (th in thetas) for (reml in c(TRUE, FALSE))
    cases[[length(cases) + 1]] <<- list(formula = formula, data = data, REML = reml, theta = I(num2str(th)))
}
add("Reaction ~ Days + (Days | Subject)", sleep, list(c(1, 0, 1), c(0.9667418, 0.01516906, 0.23091), c(0.5, -0.2, 0.3), c(0, 0, 0.2), c(2, 0.5, 0)))
add("Reaction ~ Days + (Days || Subject)", sleep, list(c(1, 1), c(0.9, 0.23), c(0, 0.3)))
add("diameter ~ 1 + (1 | plate) + (1 | sample)", pen, list(c(1, 1), c(1.54, 3.51), c(0.5, 2)))
add("strength ~ 1 + (1 | batch/cask)", pastes, list(c(1, 1), c(3.53, 1.33), c(2, 0)))
add("Yield ~ 1 + (1 | Batch)", dye, list(1, 0.75, 0, 1e-8, 5))
add("y ~ x + (x | g) + (1 | h)", d, list(c(1, 0, 1, 1), c(1.7, -0.3, 0.6, 1.1), c(0.4, 0.1, 0, 0)))
add("y ~ x * f + (1 | g)", d, list(1, 2.2))
add("y ~ x + (f | g)", d, list(c(1, 0, 0, 1, 0, 1), c(1.1, 0.2, -0.3, 0.7, 0.1, 0.5)))
add("y ~ 0 + x + (1 | g)", d, list(1.3))
add("y ~ x + (1 | g/f)", d, list(c(0.5, 1.5)))
add("y ~ x + (x | g)", dna, list(c(1.2, 0.1, 0.4)))

if (!exists("DEBUG_ONE")) write_anova_fixture("lmerDeviance", cases, expected, reference)
