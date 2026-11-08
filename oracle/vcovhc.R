source("/oracle/_robust.R")
suppressPackageStartupMessages(library(gmp))

# Heteroskedasticity-consistent covariance matrices: sandwich::vcovHC(fit, type, omega, sandwich) for lm and glm fits
# (fixture vcovHC). Behaviour in oracle/robust-behaviour.md. Model arguments as in oracle/_robust.R, and:
#   type       "const", "HC0", "HC1", "HC2", "HC3", "HC4", "HC4m", "HC5" (and "HC", R's alias of HC0; absent: R's
#              default HC3; other strings: R's error)
#   omega      a vector of omega values (one per row of the fit), instead of the type's
#   sandwich   FALSE: the meat only
#   refKind    present when the case has a "reference" (what rStats.js may return instead of R's value):
#              "subset"  the fit has rows of prior weight 0; reference = vcovHC of the same model fitted without them
#              "scaled"  the response is y * 2^-56 (every |estfun| below 2.2e-16); reference = 2^-112 times vcovHC of y
#              "exact"   the matrix computed from the data with exact rational arithmetic (gmp) and 256-bit omega, in
#                        R's formula: checks R's rounding for an ill-conditioned model matrix
#              "vcov"    type "const" of a weighted lm or a glm; reference = vcov(fit), the model-based covariance
# Written: vcov (rows), names (the dimnames: the non-aliased coefficients), warnings (of vcovHC), fitWarnings (of the
# fit). Errors as {"error": message}.

set.seed(20261109)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
TYPES <- c("const", "HC0", "HC1", "HC2", "HC3", "HC4", "HC4m", "HC5")
add_types <- function(..., types = TYPES, refKind = NULL, refTypes = types) {
  for (t in types) add(..., type = t, refKind = if (t %in% refTypes) refKind)
}

n <- 40
X <- cbind(rnorm(n), runif(n, -1, 1))
eta <- 0.3 + 0.8 * X[, 1] - 0.5 * X[, 2]
yl <- drop(1 + X %*% c(2, -1) + rnorm(n) * exp(0.5 * X[, 1]))   # heteroskedastic
wl <- round(runif(n, 0.3, 3), 3)                                  # non-integer weights

# ---- lm
add_types(model = "lm", x = X, y = I(yl))
add_types(model = "lm", x = X, y = I(yl), weights = I(wl), refKind = "vcov", refTypes = "const")
add_types(model = "lm", x = cbind(X, X[, 1] + 2 * X[, 2]), y = I(yl))                    # aliased third column
add_types(model = "lm", x = X, y = I(yl), intercept = FALSE)
# a dummy for observation 7: its hat value is 1 (residual 0); NA response in row 3 (dropped; the warnings name rows
# by their original numbers)
yna <- yl; yna[3] <- NA
add_types(model = "lm", x = cbind(X, as.numeric(seq_len(n) == 7)), y = I(yna))
# rows of prior weight 0 (left out of the fit but counted by sandwich)
w0 <- wl; w0[c(5, 18, 33)] <- 0
add_types(model = "lm", x = X, y = I(yl), weights = I(w0), refKind = "subset")
# tiny response: every |estfun| is below 2.2e-16, which sandwich sets to 0
add_types(model = "lm", x = X, y = I(yl * 2^-56), refKind = "scaled", refTypes = setdiff(TYPES, "const"))
# nearly collinear with the intercept (exact references)
Xbig <- cbind(1e6 + rnorm(30), 1e6 + rnorm(30))
ybig <- drop(3 + Xbig %*% c(1e-3, 2e-3) + rnorm(30, 0, 1e-3) * (1 + abs(rnorm(30))))
add_types(model = "lm", x = Xbig, y = I(ybig), refKind = "exact")
add_types(model = "lm", x = Xbig, y = I(ybig), weights = I(wl[1:30]), refKind = "exact")
# no intercept and a row of x equal to 0: its estfun row is 0 (type "const" then uses the residual of that row)
X0 <- X; X0[4, ] <- 0
add_types(model = "lm", x = X0, y = I(yl), intercept = FALSE, types = c("const", "HC0", "HC3"))

# ---- glm
mu01 <- plogis(eta)
ybin <- rbinom(n, 1, mu01)
size <- sample(3:8, n, replace = TRUE); succ <- rbinom(n, size, mu01)
off <- log(runif(n, 1, 4))
ypois <- rpois(n, exp(0.2 + 0.4 * X[, 1] - 0.3 * X[, 2] + off))
yrisk <- rbinom(n, 1, exp(-1.2 + 0.3 * X[, 1]) )                  # 0/1 outcome for the modified Poisson model
yqp <- rnbinom(n, mu = exp(1 + 0.4 * X[, 1]), size = 2)            # overdispersed counts
ygam <- rgamma(n, shape = 3, rate = 3 / exp(1 + 0.3 * X[, 1] - 0.4 * X[, 2]))
yig <- rinvgauss(n, exp(0.5 + 0.2 * X[, 1]), 4)
ygau <- yl
yfrac <- rbinom(n, 10, mu01) / 10
wipw <- round(1 / runif(n, 0.1, 0.9), 4)                           # inverse-probability-like weights
add_types(model = "glm", x = X, y = I(ybin), family = "binomial", refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = cbind(succ, size - succ), family = "binomial", link = "probit", refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(ybin), family = "quasibinomial", weights = I(wipw), refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(ypois), family = "poisson", offset = I(off), refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(yrisk), family = "poisson", refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(yqp), family = "quasipoisson", refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(ygam), family = "Gamma", link = "log", weights = I(wl), refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(yig), family = "inverse.gaussian", link = "log", refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(ygau), family = "gaussian", weights = I(wipw), refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = X, y = I(yfrac), family = "quasi", variance = "mu(1-mu)", link = "logit", weights = I(rep(10, n)),
          refKind = "vcov", refTypes = "const")
add_types(model = "glm", x = cbind(X, X[, 1] - X[, 2]), y = I(ypois), family = "poisson", offset = I(off),
          types = c("HC0", "HC1", "HC3", "HC4"))
w0g <- rep(1, n); w0g[c(2, 21)] <- 0
add_types(model = "glm", x = X, y = I(ypois), family = "poisson", offset = I(off), weights = I(w0g), refKind = "subset",
          types = c("HC0", "HC1", "HC2", "HC3", "HC4", "HC5"))
add_types(model = "glm", x = cbind(X, as.numeric(seq_len(n) == 12)), y = I(ypois), family = "poisson", offset = I(off),
          types = c("HC0", "HC1", "HC2", "HC3"))

# ---- options
add(model = "lm", x = X, y = I(yl))                                    # default type (HC3)
add(model = "lm", x = X, y = I(yl), type = "HC")                       # alias of HC0
add(model = "lm", x = X, y = I(yl), type = "H")                        # ambiguous: R's error
add(model = "lm", x = X, y = I(yl), type = "hc0")                      # no match: R's error
add(model = "lm", x = X, y = I(yl), omega = I(abs(yl)))                # omega given as a vector
add(model = "glm", x = X, y = I(yqp), family = "quasipoisson", omega = I(rep(2, n)))
for (t in c("HC0", "HC1", "HC3", "const")) {
  add(model = "lm", x = X, y = I(yl), type = t, sandwich = FALSE)
  add(model = "glm", x = X, y = I(yqp), family = "quasipoisson", type = t, sandwich = FALSE)
}

# ---- realistic uses
# modified Poisson regression for a risk ratio (Zou 2004): induced and spontaneous abortions and infertility (the
# matched case-control data infert, used here only as a 0/1 outcome)
ix <- cbind(infert$spontaneous, infert$induced, infert$age)
for (t in c("HC0", "HC1", "HC3")) add(model = "glm", x = ix, y = I(infert$case), family = "poisson", type = t)
# inverse probability weighting: low birth weight and smoking (MASS::birthwt), weights from a logistic propensity
# model of smoking on age, mother's weight and race (ATE weights)
bw <- MASS::birthwt
ps <- fitted(glm(smoke ~ age + lwt + factor(race), family = binomial, data = bw))
ipw <- round(ifelse(bw$smoke == 1, 1 / ps, 1 / (1 - ps)), 6)
for (t in c("HC0", "HC1", "HC3")) {
  add(model = "glm", x = cbind(bw$smoke), y = I(bw$low), family = "quasibinomial", weights = I(ipw), type = t)
  add(model = "glm", x = cbind(bw$smoke), y = I(bw$low), family = "quasipoisson", weights = I(ipw), type = t)
  add(model = "glm", x = cbind(bw$smoke), y = I(bw$bwt), family = "gaussian", weights = I(ipw), type = t)
}

# ---- references
# exact: R's formula from exact rational X'WX, residuals and hat values (omega in 256-bit mpfr)
exact_hc <- function(a) {
  x <- cbind(1, a$x); y <- unclass(a$y)
  w <- if (is.null(a$weights)) rep(1, nrow(x)) else unclass(a$weights)
  Xq <- as.bigq(x); yq <- as.bigq(y); wq <- as.bigq(w)
  WX <- Xq; for (j in seq_len(ncol(x))) WX[, j] <- wq * Xq[, j]
  A <- solve(t(Xq) %*% WX)
  b <- A %*% (t(WX) %*% matrix(yq, ncol = 1))
  e <- yq - as.vector(Xq %*% b)
  hq <- lapply(seq_len(nrow(x)), function(i) { xi <- Xq[i, , drop = FALSE]; wq[i] * (xi %*% A %*% t(xi))[1, 1] })
  n <- nrow(x); k <- ncol(x); p <- k
  bits <- 256
  res <- Rmpfr::mpfr(wq * e, bits)
  hm <- Rmpfr::mpfr(do.call(c, hq), bits)
  # pmin and pmax for mpfr vectors (Rmpfr's give lists)
  pminm <- function(u, v) { r <- u + 0 * v; vv <- v + 0 * r; s <- as.logical(vv < r); r[s] <- vv[s]; r }
  pmaxm <- function(u, v) { r <- u + 0 * v; vv <- v + 0 * r; s <- as.logical(vv > r); r[s] <- vv[s]; r }
  t <- a$type
  om <- switch(t,
    const = rep(sum(res^2) / (n - k), n), HC0 = res^2, HC1 = res^2 * n / (n - k), HC2 = res^2 / (1 - hm),
    HC3 = res^2 / (1 - hm)^2, HC4 = res^2 / (1 - hm)^pminm(4, n * hm / p),
    HC4m = res^2 / (1 - hm)^(pminm(1, n * hm / p) + pminm(1.5, n * hm / p)),
    HC5 = res^2 / sqrt((1 - hm)^pminm(n * hm / p, pmaxm(4, n * 0.7 * max(hm) / p))))
  Am <- Rmpfr::mpfr(A, bits); dim(Am) <- dim(A)
  xm <- Rmpfr::mpfr(x, bits); dim(xm) <- dim(x)
  M <- Rmpfr::mpfrArray(0, bits, dim = c(k, k))
  for (i in seq_len(n)) M <- M + om[i] * (t(xm[i, , drop = FALSE]) %*% xm[i, , drop = FALSE])
  V <- Am %*% M %*% Am
  V <- matrix(Rmpfr::asNumeric(V), k, k)
  mat_out(V)
}
ref <- function(a) {
  if (is.null(a$refKind)) return(NULL)
  t <- a$type
  switch(a$refKind,
    subset = { b <- a; keep <- unclass(a$weights) > 0
      b$x <- a$x[keep, , drop = FALSE]; b$y <- if (is.matrix(a$y)) a$y[keep, ] else I(unclass(a$y)[keep])
      b$weights <- I(unclass(a$weights)[keep]); if (!is.null(a$offset)) b$offset <- I(unclass(a$offset)[keep])
      list(vcov = mat_out(vcovHC(robust_fit(b), type = t))) },
    scaled = { b <- a; b$y <- I(unclass(a$y) * 2^56); list(vcov = mat_out(vcovHC(robust_fit(b), type = t) * 2^-112)) },
    exact = list(vcov = exact_hc(a)),
    vcov = list(vcov = mat_out(vcov(robust_fit(a))[!is.na(coef(robust_fit(a))), !is.na(coef(robust_fit(a))), drop = FALSE])))
}

write_htest_fixture("vcovHC", cases, function(a) {
  f <- fit_with_warnings(a)
  args <- list(f$value)
  if (!is.null(a$type)) args$type <- a$type
  if (!is.null(a$omega)) args$omega <- unclass(a$omega)
  if (!is.null(a$sandwich)) args$sandwich <- a$sandwich
  r <- with_warnings(function() do.call(vcovHC, args))
  c(vc_out(r$value), list(warnings = r$warnings, fitWarnings = f$warnings))
}, ref = ref)
