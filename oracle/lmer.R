source("/oracle/_anova.R")
suppressPackageStartupMessages({library(lme4); library(Rmpfr)})

# Fitted linear mixed models: lme4's lmer() and its methods (fixture lmer). Behaviour in oracle/lmer-behaviour.md
# ("The fit and its results"). Each case has
#   formula, data   as in the fixture lmerTerms
#   REML            logical
#   contrasts, levels  (optional) as in lmerTerms
# Written (R: lmer with the default control, then the methods):
#   theta           getME(fit, "theta")
#   fixef, stdError, tValue   coef(summary(fit)) (Estimate, Std. Error, t value); vcov  vcov(fit), one array per row
#   sigma           sigma(fit)
#   varCorr         one entry per random-effects term (in the order of the structure): group, columns, sd (the
#                   standard deviations) and corr (the correlation matrix, one array per row)
#   ranef           one entry per grouping factor (in the order of the structure's groups): group, levels, columns
#                   and values (one array per level)
#   fitted, residuals  fitted(fit), residuals(fit)
#   logLik, df      logLik(fit) and its df; AIC, BIC; deviance = deviance(fit, REML = FALSE) (the ML deviance at the
#                   estimates); REMLcrit = REMLcrit(fit) (the REML criterion at the estimates)
#   singular        isSingular(fit)
#   messages, warnings  R's messages and warnings
# reference: the same fields at the exact optimum of the criterion. lme4's optimiser stops near the optimum (theta
#   is typically within 1e-6 to 1e-4 of it). The reference starts from lme4's theta, fixes at 0 the diagonal elements
#   that lme4 left below 1e-4, and those that Newton's method below drives below 1e-15 (checking that the one-sided
#   derivative of the criterion there is positive, so that the optimum is on the boundary), and solves for a zero
#   gradient of the criterion in the other elements by Newton's method in 128-bit arithmetic: the criterion is computed with dense matrices from the paper's formulas (as in
#   oracle/lmerdev.R), its gradient by central differences (step 1e-15), its Hessian once by central differences
#   (step 1e-8), until the Newton step is below 1e-20 (the gradient is accurate to about 1e-21). All fields are then
#   computed at that theta in 128-bit arithmetic. "newtonSteps" records the size of the Newton steps taken.

BITS <- 128
mp <- function(v) mpfr(v, BITS)
mpm <- function(m) mpfrArray(m, BITS, dim = dim(m))
colv <- function(v) { dim(v) <- c(length(v), 1L); v }
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
mp_backsolve <- function(R, v) {
  k <- nrow(R); x <- mp(numeric(k))
  for (i in k:1) { s <- v[i]; if (i < k) s <- s - sum(R[i, (i + 1):k] * x[(i + 1):k]); x[i] <- s / R[i, i] }
  x
}
mp_forwardsolve <- function(R, v) {
  k <- nrow(R); x <- mp(numeric(k))
  for (i in 1:k) { s <- v[i]; if (i > 1) s <- s - sum(R[1:(i - 1), i] * x[1:(i - 1)]); x[i] <- s / R[i, i] }
  x
}
mp_inverse_spd <- function(R) {  # (R'R)^-1 from the upper Cholesky factor
  k <- nrow(R); out <- mpfrArray(0, BITS, dim = c(k, k))
  for (j in seq_len(k)) { e <- mp(as.numeric(seq_len(k) == j)); out[, j] <- mp_backsolve(R, mp_forwardsolve(R, e)) }
  out
}

prepare <- function(a) {
  dat <- a$data
  for (nm in names(a$levels)) dat[[nm]] <- factor(dat[[nm]], levels = a$levels[[nm]])
  ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
  lf <- suppressMessages(suppressWarnings(lFormula(as.formula(a$formula), dat, contrasts = ctr)))
  rt <- lf$reTrms
  list(dat = dat, ctr = ctr, lf = lf, X = mpm(lf$X), Xd = lf$X, Z = mpm(t(as.matrix(rt$Zt))),
       y = mp(as.vector(model.response(lf$fr))), Lt = rt$Lambdat, Lind = rt$Lind, lower = rt$lower,
       n = nrow(lf$X), p = ncol(lf$X), q = nrow(rt$Zt))
}

# The penalised least squares at theta (mpfr vector), everything in 128-bit arithmetic
pls <- function(s, theta) {
  q <- s$q; p <- s$p; n <- s$n
  Lam <- mpfrArray(0, BITS, dim = c(q, q))
  Lt <- s$Lt; Lt@x <- as.double(s$Lind); idx <- t(as.matrix(Lt))
  for (k in which(idx != 0)) Lam[k] <- theta[idx[k]]
  ZL <- s$Z %*% Lam
  A <- t(ZL) %*% ZL; for (i in seq_len(q)) A[i, i] <- A[i, i] + 1
  RZ <- mp_chol(A)
  ZLtX <- t(ZL) %*% s$X
  RZX <- mpfrArray(0, BITS, dim = c(q, p))
  for (j in seq_len(p)) RZX[, j] <- mp_forwardsolve(RZ, ZLtX[, j])
  RX <- mp_chol(t(s$X) %*% s$X - t(RZX) %*% RZX)
  cu <- mp_forwardsolve(RZ, as.vector(t(ZL) %*% colv(s$y)))
  cb <- mp_forwardsolve(RX, as.vector(t(s$X) %*% colv(s$y)) - as.vector(t(RZX) %*% colv(cu)))
  beta <- mp_backsolve(RX, cb)
  u <- mp_backsolve(RZ, cu - as.vector(RZX %*% colv(beta)))
  fitted <- as.vector(s$X %*% colv(beta)) + as.vector(ZL %*% colv(u))
  r <- s$y - fitted
  prss <- sum(r^2) + sum(u^2)
  ldL <- 2 * sum(log(diag(RZ))); ldRX <- 2 * sum(log(diag(RX)))
  twopi <- 2 * Const("pi", BITS)
  list(Lam = Lam, beta = beta, u = u, b = as.vector(Lam %*% colv(u)), fitted = fitted, resid = r, prss = prss,
       RX = RX, devML = ldL + n * (1 + log(twopi * prss / n)),
       devREML = ldL + ldRX + (n - p) * (1 + log(twopi * prss / (n - p))))
}
criterion <- function(s, theta, reml) { r <- pls(s, theta); if (reml) r$devREML else r$devML }

# Newton's method on the free elements of theta
optimum <- function(s, theta0, reml, fixed = s$lower == 0 & theta0 < 1e-4) {
  theta <- mp(theta0)
  theta[fixed] <- mp(0)
  free <- which(!fixed)
  f0 <- criterion(s, theta, reml)
  for (i in which(fixed)) {   # the one-sided derivative at the boundary must be positive
    th <- theta; th[i] <- mp(1e-12)
    if ((criterion(s, th, reml) - f0) / mp(1e-12) <= 0) stop(sprintf("theta[%d] is not at a boundary optimum", i))
  }
  if (length(free) == 0) return(list(theta = theta, steps = character(0)))
  h1 <- mp(1e-15); h2 <- mp(1e-8)
  gradmp <- function(th) {
    out <- mp(numeric(length(free)))
    for (k in seq_along(free)) {
      i <- free[k]; a <- th; a[i] <- a[i] + h1; b <- th; b[i] <- b[i] - h1
      out[k] <- (criterion(s, a, reml) - criterion(s, b, reml)) / (2 * h1)
    }
    out
  }
  m <- length(free); H <- matrix(0, m, m)
  for (k in seq_len(m)) for (l in k:m) {
    i <- free[k]; j <- free[l]
    e <- function(si, sj) { th <- theta; th[i] <- th[i] + si * h2; th[j] <- th[j] + sj * h2; criterion(s, th, reml) }
    H[k, l] <- H[l, k] <- asNumeric((e(1, 1) - e(1, -1) - e(-1, 1) + e(-1, -1)) / (4 * h2^2))
  }
  Hinv <- solve(H)
  steps <- character(0)
  for (it in 1:12) {
    g <- gradmp(theta)
    step <- mp(numeric(m))
    for (k in seq_len(m)) step[k] <- -sum(mp(Hinv[k, ]) * g)
    theta[free] <- theta[free] + step
    sz <- max(abs(asNumeric(step)))
    steps <- c(steps, sprintf("%.1e", sz))
    if (sz < 1e-20) break
  }
  # an element that Newton's method drove to its bound (below 1e-15) is on the boundary: fix it at 0 and solve again
  near <- s$lower == 0 & !fixed & abs(asNumeric(theta)) < 1e-15
  if (any(near)) {
    again <- optimum(s, asNumeric(theta), reml, fixed | near)
    return(list(theta = again$theta, steps = c(steps, "(boundary)", again$steps)))
  }
  if (sz >= 1e-20) stop("Newton's method did not converge")
  if (any(asNumeric(theta[s$lower == 0]) < 0)) stop("the optimum is outside the bounds")
  list(theta = theta, steps = steps)
}

# The fields of a fit from theta and the penalised least squares (mpfr), in the fixture's layout
fields_at <- function(s, theta, reml) {
  r <- pls(s, theta)
  rt <- s$lf$reTrms; n <- s$n; p <- s$p
  sigma2 <- r$prss / (if (reml) n - p else n)
  V <- sigma2 * mp_inverse_spd(r$RX)
  se <- sqrt(diag(V))
  nc <- lengths(rt$cnms); ntheta <- nc * (nc + 1) / 2
  thoff <- cumsum(c(0, ntheta))
  varCorr <- lapply(seq_along(rt$cnms), function(k) {
    m <- nc[k]; T <- mpfrArray(0, BITS, dim = c(m, m)); pos <- thoff[k]
    for (j in seq_len(m)) for (i in j:m) { pos <- pos + 1; T[i, j] <- theta[pos] }
    S <- sigma2 * (T %*% t(T)); sd <- sqrt(diag(S))
    C <- mpfrArray(0, BITS, dim = c(m, m))
    for (i in seq_len(m)) for (j in seq_len(m)) C[i, j] <- if (i == j) mp(1) else S[i, j] / (sd[i] * sd[j])
    list(group = names(rt$cnms)[k], columns = I(rt$cnms[[k]]), sd = I(num2str(asNumeric(sd))),
         corr = lapply(seq_len(m), function(i) I(num2str(asNumeric(C[i, ])))))
  })
  bvals <- asNumeric(r$b)
  ranef <- ranef_layout(rt, bvals)
  crit <- if (reml) r$devREML else r$devML
  ll <- -crit / 2; df <- p + length(theta) + 1
  list(theta = I(num2str(asNumeric(theta))), fixef = I(num2str(asNumeric(r$beta))), stdError = I(num2str(asNumeric(se))),
       tValue = I(num2str(asNumeric(r$beta / se))),
       vcov = lapply(seq_len(p), function(i) I(num2str(asNumeric(V[i, ])))), sigma = num2str(asNumeric(sqrt(sigma2))),
       varCorr = varCorr, ranef = ranef, fitted = I(num2str(asNumeric(r$fitted))), residuals = I(num2str(asNumeric(r$resid))),
       logLik = num2str(asNumeric(ll)), df = num2str(df), AIC = num2str(asNumeric(-2 * ll + 2 * df)),
       BIC = num2str(asNumeric(-2 * ll + log(mp(n)) * df)), deviance = num2str(asNumeric(r$devML)),
       REMLcrit = num2str(asNumeric(r$devREML)),
       singular = any(diag_theta(nc, asNumeric(theta)) < 1e-4))
}
diag_theta <- function(nc, theta) {
  out <- numeric(0); pos <- 0
  for (m in nc) { for (j in seq_len(m)) for (i in j:m) { pos <- pos + 1; if (i == j) out <- c(out, theta[pos]) } }
  out
}
# b laid out per grouping factor: levels x (the columns of the factor's terms, in term order)
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

expected <- function(a) {
  s <- prepare(a)
  w <- character(0); msg <- character(0)
  fit <- withCallingHandlers(lmer(as.formula(a$formula), s$dat, REML = isTRUE(a$REML), contrasts = s$ctr),
    warning = function(cnd) { w <<- c(w, conditionMessage(cnd)); invokeRestart("muffleWarning") },
    message = function(cnd) { msg <<- c(msg, sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  rt <- s$lf$reTrms
  vc <- VarCorr(fit)
  co <- coef(summary(fit)); V <- as.matrix(vcov(fit))
  re <- ranef(fit)
  ranef <- lapply(names(rt$flist), function(g) {
    m <- re[[g]]
    list(group = g, levels = I(rownames(m)), columns = I(colnames(m)),
         values = lapply(seq_len(nrow(m)), function(i) I(num2str(unname(unlist(m[i, ]))))))
  })
  ll <- logLik(fit)
  list(theta = I(num2str(unname(getME(fit, "theta")))), fixef = I(num2str(unname(co[, 1]))),
       stdError = I(num2str(unname(co[, 2]))), tValue = I(num2str(unname(co[, 3]))),
       vcov = lapply(seq_len(nrow(V)), function(i) I(num2str(unname(V[i, ])))), sigma = num2str(sigma(fit)),
       varCorr = lapply(seq_along(vc), function(k) {
         m <- vc[[k]]; sd <- attr(m, "stddev"); C <- attr(m, "correlation")
         list(group = names(rt$cnms)[k], columns = I(names(sd)), sd = I(num2str(unname(sd))),
              corr = lapply(seq_len(nrow(C)), function(i) I(num2str(unname(C[i, ])))))
       }),
       ranef = ranef, fitted = I(num2str(unname(fitted(fit)))), residuals = I(num2str(unname(residuals(fit)))),
       logLik = num2str(as.numeric(ll)), df = num2str(attr(ll, "df")), AIC = num2str(AIC(fit)), BIC = num2str(BIC(fit)),
       deviance = num2str(deviance(fit, REML = FALSE)), REMLcrit = num2str(REMLcrit(fit)),
       singular = isSingular(fit), messages = I(unique(msg)), warnings = I(unique(w)))
}

reference <- function(a) {
  s <- prepare(a)
  fit <- suppressMessages(suppressWarnings(lmer(as.formula(a$formula), s$dat, REML = isTRUE(a$REML), contrasts = s$ctr)))
  opt <- optimum(s, unname(getME(fit, "theta")), isTRUE(a$REML))
  out <- fields_at(s, opt$theta, isTRUE(a$REML))
  out$newtonSteps <- I(opt$steps)
  message(sprintf("%s REML=%s: Newton steps %s", a$formula, isTRUE(a$REML), paste(opt$steps, collapse = " ")))
  out
}

# ---- cases ----
sleep <- as.data.frame(sleepstudy); sleep$Subject <- as.character(sleep$Subject)
pen <- as.data.frame(Penicillin); pen$plate <- as.character(pen$plate); pen$sample <- as.character(pen$sample)
pastes <- as.data.frame(Pastes)[, c("strength", "batch", "cask")]
pastes$batch <- as.character(pastes$batch); pastes$cask <- as.character(pastes$cask)
dye <- as.data.frame(Dyestuff); dye$Batch <- as.character(dye$Batch)
dye2 <- as.data.frame(Dyestuff2); dye2$Batch <- as.character(dye2$Batch)
set.seed(20261029)
n <- 60
d <- data.frame(g = rep(sprintf("g%02d", 1:12), each = 5), h = rep(c("h1", "h2", "h3", "h4", "h5"), 12),
                x = round(runif(n, 0, 4), 2), f = rep(c("lo", "hi", "mid"), 20), stringsAsFactors = FALSE)
gi <- match(d$g, unique(d$g)); hi <- match(d$h, unique(d$h))
d$y <- round(5 + 0.8 * d$x + rnorm(12, 0, 1.2)[gi] + rnorm(12, 0, 0.4)[gi] * d$x + rnorm(5, 0, 0.7)[hi] + rnorm(n, 0, 0.6), 2)
dna <- d; dna$y[c(4, 17)] <- NA; dna$x[30] <- NA; dna$g[41] <- NA
dcol <- transform(d, x2 = 2 * x)

cases <- list()
add <- function(formula, data, ...) for (reml in c(TRUE, FALSE))
  cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data, REML = reml), list(...))
add("Reaction ~ Days + (Days | Subject)", sleep)
add("Reaction ~ Days + (Days || Subject)", sleep)
add("diameter ~ 1 + (1 | plate) + (1 | sample)", pen)
add("strength ~ 1 + (1 | batch/cask)", pastes)
add("Yield ~ 1 + (1 | Batch)", dye)
add("Yield ~ 1 + (1 | Batch)", dye2)                             # singular: the optimum is on the boundary
add("y ~ x + (x | g) + (1 | h)", d)
add("y ~ x * f + (1 | g)", d, contrasts = list(f = "contr.sum"))
add("y ~ f + x + (1 | g)", d, levels = list(f = c("mid", "lo", "hi")))
add("y ~ x + (x | g)", dna)                                     # missing values
add("y ~ x + x2 + (1 | g) + (1 | h)", dcol)                     # an aliased column dropped

if (!exists("DEBUG_ONE")) write_anova_fixture("lmer", cases, expected, reference)
