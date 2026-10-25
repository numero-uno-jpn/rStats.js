source("/oracle/_glm.R")

# Profile likelihood confidence intervals of glm coefficients, R's confint.glm (fixture glmConfint). See
# oracle/_glm.R for the model arguments; also level (default 0.95), parm (1-based indices of the coefficients,
# intercept first; default all) and test ("LRT", the default, or "Rao").
#
# R's interval: profile.glm moves one coefficient b_j on a grid of steps of about 1/5 of its standard error (at most
# 9 steps each way), refits the others with b_j x_j as offset and records the signed root
#   z(b_j) = sign(b_j - hat b_j) sqrt((D(b_j) - D) / dispersion)
# (D: deviance; for test = "Rao", the score statistic of the restricted fit instead of D(b_j) - D);
# confint.profile.glm then interpolates b_j as a function of z by a spline and reads it at z = qnorm((1 -/+ level)/2),
# also for the families with an estimated dispersion. The interpolation is only accurate to about 1e-4.
#
# Written for each case: confLower, confUpper (R; NA where the profile does not reach the cutoff), and the same
# fields under reference: the exact solutions of z(b_j) = qnorm((1 -/+ level)/2), found with uniroot on refits that are
# converged to rounding and start from the full fit, also converged to rounding. R's convergence rule (relative change
# of the deviance below epsilon) stops while the coefficients can still move by about sqrt(epsilon), which leaves the
# Pearson dispersion and the score statistic unconverged, and it is met whenever the deviance repeats exactly (also
# for epsilon = 1e-300). So these fits are iterated by hand: 100 single IRLS steps (glm.fit with maxit = 1, each
# starting from the previous coefficients), and the dispersion, the standard errors and the score come from the
# weights of the last step. NA where z(b_j) does not reach the cutoff (within 2^30 standard errors). glm.fit detects aliased columns with the tolerance
# min(1e-7, epsilon / 1000), so these fits leave out the columns that the fit with the default epsilon finds aliased.

set.seed(20261102)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))

n <- 40
X <- cbind(rnorm(n), runif(n, -1, 1))
mu01 <- plogis(-0.3 + 0.8 * X[, 1] - 0.5 * X[, 2])
mupos <- exp(1 + 0.4 * X[, 1] - 0.3 * X[, 2])
yb <- rbinom(n, 1, mu01); yp <- rpois(n, mupos); yn <- mupos + rnorm(n, 0, 0.5)
yg <- rgamma(n, shape = 4, rate = 4 / mupos); yi <- rinvgauss(n, mupos, 5)
m <- sample(1:10, n, replace = TRUE); s <- rbinom(n, m, mu01)
expo <- runif(n, 1, 5); yo <- rpois(n, expo * mupos)

add(x = X, y = I(yb), family = "binomial")
add(x = X, y = I(yb), family = "binomial", link = "probit")
add(x = X, y = cbind(s, m - s), family = "binomial", link = "cloglog")
add(x = X, y = I(s / m), family = "quasibinomial", weights = I(m))
add(x = X, y = I(yp), family = "poisson")
add(x = X, y = I(yp), family = "poisson", link = "sqrt")
add(x = X, y = I(yo), family = "poisson", offset = I(log(expo)))
add(x = X, y = I(yp), family = "quasipoisson")
add(x = X, y = I(yn), family = "gaussian")
add(x = X, y = I(yn), family = "gaussian", link = "log")
add(x = X, y = I(yg), family = "Gamma", link = "log")
add(x = X, y = I(yg), family = "Gamma")
add(x = X, y = I(yi), family = "inverse.gaussian", link = "log")
add(x = X, y = I(yg), family = "quasi", variance = "mu^2", link = "log")
add(x = X, y = I(yp), family = "poisson", weights = I(runif(n, 0.5, 2)))
add(x = X, y = I(yp), family = "poisson", intercept = FALSE)
for (lv in c(0.9, 0.99)) {
  add(x = X, y = I(yb), family = "binomial", level = lv)
  add(x = X, y = I(yg), family = "Gamma", link = "log", level = lv)
}
add(x = X, y = I(yb), family = "binomial", parm = 2)
add(x = X, y = I(yp), family = "poisson", parm = I(c(1, 3)))
for (fam in c("binomial", "poisson")) add(x = X, y = I(if (fam == "binomial") yb else yp), family = fam, test = "Rao")
add(x = X, y = I(yg), family = "Gamma", link = "log", test = "Rao")
add(x = X, y = I(yb), family = "binomial", test = "Rao", level = 0.9, parm = 3)
# Small samples, where the profile is far from quadratic
x8 <- matrix(1:8, 8, 1)
add(x = x8, y = I(c(0, 0, 1, 0, 1, 1, 0, 1)), family = "binomial")
add(x = x8, y = I(c(0, 1, 0, 2, 3, 2, 6, 9)), family = "poisson")
add(x = matrix(numeric(0), 8, 0), y = I(c(0, 1, 0, 2, 3, 2, 6, 9)), family = "poisson")  # intercept only
# An aliased column (NA interval). Not included: separation, where the estimate is at infinity and R's interval
# depends on where the iterations stopped.
add(x = cbind(X, X[, 1] - 2 * X[, 2]), y = I(yb), family = "binomial")

write_linalg_fixture("glmConfint", cases, function(a) {
  fit <- glm_fit(a)
  p <- length(coef(fit))
  ci <- suppressMessages(confint(fit, parm = a$parm %||% seq_len(p), level = a$level %||% 0.95,
                                 test = a$test %||% "LRT"))
  ci <- matrix(ci, ncol = 2)
  list(confLower = vec_out(ci[, 1]), confUpper = vec_out(ci[, 2]))
}, ref = function(a) {
  full <- coef(glm_fit(a))
  cols <- which(!is.na(full[paste0("x", seq_len(ncol(as.matrix(a$x))))]))
  fit <- glm_fit(a, cols)
  # the model matrix with a column for every coefficient of the full fit (the aliased ones are never used)
  Xr <- model.matrix(fit)
  X <- matrix(NA_real_, nrow(Xr), length(full), dimnames = list(NULL, names(full)))
  X[, colnames(Xr)] <- Xr
  mf <- model.frame(fit); Y <- model.response(mf)
  O <- model.offset(mf) %||% rep(0, NROW(Y)); W <- model.weights(mf) %||% rep(1, NROW(Y))
  fam <- family(fit)
  # 100 single IRLS steps, each from the previous coefficients (see the header)
  converge <- function(Xs, off, start) {
    for (k in 1:100) {
      fm <- glm.fit(Xs, Y, weights = W, start = start, offset = off, family = fam,
                    control = glm.control(maxit = 1))
      start <- fm$coefficients
    }
    fm
  }
  nonA <- !is.na(full)
  ff <- converge(X[, nonA, drop = FALSE], O, unname(full[nonA]))
  B0 <- full; B0[nonA] <- ff$coefficients
  p <- sum(nonA)
  disp <- if (fam$family %in% c("binomial", "poisson")) 1 else
    sum((ff$weights * ff$residuals^2)[ff$weights > 0]) / ff$df.residual
  se <- rep(NA, length(B0)); se[nonA] <- sqrt(diag(chol2inv(ff$qr$qr[1:p, 1:p, drop = FALSE]))[order(ff$qr$pivot[1:p])] * disp)
  D0 <- ff$deviance
  LP <- drop(X[, nonA, drop = FALSE] %*% B0[nonA]) + O
  test <- a$test %||% "LRT"
  zstat <- function(i, bi) {
    keep <- nonA; keep[i] <- FALSE
    off <- O + X[, i] * bi
    st <- glm.fit(X[, keep, drop = FALSE], Y, weights = W, etastart = LP, offset = off, family = fam)$coefficients
    fm <- converge(X[, keep, drop = FALSE], off, st)
    zz <- if (test == "LRT") (fm$deviance - D0) / disp else {
      fml <- glm.fit(X[, nonA, drop = FALSE], fm$residuals, weights = fm$weights, intercept = FALSE)
      (fml$null.deviance - fml$deviance) / disp
    }
    sign(bi - B0[i]) * sqrt(max(zz, 0))
  }
  level <- a$level %||% 0.95
  cut <- qnorm(c((1 - level) / 2, (1 + level) / 2))
  parm <- a$parm %||% seq_along(B0)
  lo <- up <- rep(NA_real_, length(parm))
  for (k in seq_along(parm)) {
    i <- parm[k]
    if (!nonA[i]) next
    for (side in 1:2) {
      sgn <- if (side == 1) -1 else 1
      # bracket the root by doubling the distance from the estimate
      far <- NA
      for (e in 0:30) {
        bi <- B0[i] + sgn * 2^e * se[i]
        if (abs(zstat(i, bi)) >= abs(cut[side])) { far <- bi; break }
      }
      if (is.na(far)) next
      r <- uniroot(function(bi) zstat(i, bi) - cut[side], sort(c(B0[i], far)),
                   tol = 1e-15 * max(1, abs(far)), maxiter = 500)$root
      if (side == 1) lo[k] <- r else up[k] <- r
    }
  }
  list(confLower = vec_out(lo), confUpper = vec_out(up))
})
