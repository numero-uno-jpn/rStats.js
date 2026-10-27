source("/oracle/_glm.R")

# Generalized linear models with a matrix interface (fixture glm): every family of R's stats with every link it
# accepts, summary.glm, the four kinds of residuals, hatvalues/rstandard/cooks.distance and predict with se.fit.
# See oracle/_glm.R for the arguments. Written for each case:
#   the fit: coefficients (NA for aliased columns; intercept first), fittedValues, linearPredictors, deviance,
#     nullDeviance, aic (NA for the quasi families), rank, dfResidual, dfNull, iter, converged, boundary
#   residuals: devianceResiduals, pearsonResiduals, workingResiduals, responseResiduals
#   summary.glm: dispersion, estimate, stdError, statistic, pValue (aliased columns left out), statisticName
#     ("z value" when the dispersion is fixed at 1, else "t value"), covUnscaled
#   influence: hatvalues, rstandard (deviance residuals), cooksDistance
#   predict on the data: seLink (type = "link") and seResponse (type = "response"); with newdata (and newoffset
#     for a model with an offset): predictLink, predictResponse, newSeLink, newSeResponse
#   warnings: R's warning messages (an empty array when there are none)
# Cases with epsilon = 1e-14 iterate until the relative change of the deviance is below 1e-14. They are NOT the maximum
# likelihood estimate to rounding: the deviance is stationary at the estimate, so the coefficients can still be about
# sqrt(1e-14) = 1e-7 (relative) away from it when R's rule stops (for example with the cauchit and log-binomial links).

set.seed(20261101)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))

n <- 40
X <- cbind(rnorm(n), runif(n, -1, 1))
newX <- rbind(c(0, 0), c(1, -0.5), c(-1.5, 0.8))
mu01 <- plogis(-0.3 + 0.8 * X[, 1] - 0.5 * X[, 2])  # in (0, 1)
mupos <- exp(1 + 0.4 * X[, 1] - 0.3 * X[, 2])       # positive, about 1 to 7
musmall <- exp(-1.6 + 0.4 * X[, 1] - 0.3 * X[, 2])  # about 0.05 to 0.6, for the log link of the binomial families

sim <- function(family, mu) switch(family,
  gaussian = mu + rnorm(n, 0, 0.5),
  binomial = , quasibinomial = rbinom(n, 1, mu),
  poisson = , quasipoisson = rpois(n, mu),
  Gamma = rgamma(n, shape = 4, rate = 4 / mu),
  inverse.gaussian = rinvgauss(n, mu, 5))

links <- list(gaussian = c("identity", "log", "inverse"),
              binomial = c("logit", "probit", "cauchit", "log", "cloglog"),
              quasibinomial = c("logit", "probit", "cauchit", "log", "cloglog"),
              poisson = c("log", "identity", "sqrt"),
              quasipoisson = c("log", "identity", "sqrt"),
              Gamma = c("inverse", "identity", "log"),
              inverse.gaussian = c("1/mu^2", "inverse", "identity", "log"))
# Links whose default starting values R rejects ("please supply starting values"): one case without, the others
# with valid starting values (the constant mean for log-binomial and 1/mu^2, least squares for the identity link)
needs_start <- function(fam, lk, y) {
  if (lk == "log" && fam %in% c("binomial", "quasibinomial")) return(c(log(mean(y)), 0, 0))
  if (lk == "identity" && fam %in% c("poisson", "quasipoisson")) return(unname(coef(lm(y ~ X))))
  if (lk == "1/mu^2") return(c(1 / mean(y)^2, 0, 0))
  NULL
}
for (fam in names(links)) {
  y <- sim(fam, if (fam %in% c("binomial", "quasibinomial")) mu01 else mupos)
  for (lk in links[[fam]]) {
    if (lk == "log" && fam %in% c("binomial", "quasibinomial")) y <- sim(fam, musmall)
    st <- needs_start(fam, lk, y)
    if (!is.null(st)) add(x = X, y = I(y), family = fam, link = lk)
    add(x = X, y = I(y), family = fam, link = lk, start = if (!is.null(st)) I(st), newdata = newX)
    add(x = X, y = I(y), family = fam, link = lk, start = if (!is.null(st)) I(st), epsilon = 1e-14, maxit = 100)
  }
}

# quasi: variance functions with suitable links and data (also power links)
yq <- list(constant = sim("gaussian", mupos), "mu(1-mu)" = rbinom(n, 10, mu01) / 10, mu = sim("poisson", mupos),
           "mu^2" = sim("Gamma", mupos), "mu^3" = sim("inverse.gaussian", mupos))
quasi_cases <- list(list("constant", "identity"), list("constant", "log"), list("mu(1-mu)", "logit"),
                    list("mu(1-mu)", "probit"), list("mu", "log"), list("mu", "sqrt"), list("mu^2", "log"),
                    list("mu^2", "inverse"), list("mu^3", "1/mu^2"), list("mu^3", "log"))
for (qc in quasi_cases) {
  yv <- yq[[qc[[1]]]]
  st <- if (qc[[2]] == "1/mu^2") c(1 / mean(yv)^2, 0, 0)
  if (!is.null(st)) add(x = X, y = I(yv), family = "quasi", variance = qc[[1]], link = qc[[2]])
  add(x = X, y = I(yv), family = "quasi", variance = qc[[1]], link = qc[[2]], start = if (!is.null(st)) I(st),
      newdata = newX)
  add(x = X, y = I(yv), family = "quasi", variance = qc[[1]], link = qc[[2]], start = if (!is.null(st)) I(st),
      epsilon = 1e-14, maxit = 100)
}
add(x = X, y = I(yq$mu), family = "quasi", variance = "mu", linkPower = 1 / 3, newdata = newX)
add(x = X, y = I(yq[["mu^2"]]), family = "quasi", variance = "mu^2", linkPower = -0.5, newdata = newX)
add(x = X, y = I(yq$constant), family = "quasi", variance = "constant", linkPower = 0)

# Binomial responses: counts as a two-column matrix, proportions with weights, non-integer successes
m <- sample(1:10, n, replace = TRUE)
s <- rbinom(n, m, mu01)
for (fam in c("binomial", "quasibinomial")) for (lk in c("logit", "probit", "cloglog")) {
  add(x = X, y = cbind(s, m - s), family = fam, link = lk, newdata = newX)
  add(x = X, y = I(s / m), family = fam, link = lk, weights = I(m))
}
add(x = X, y = I(round(mu01, 2)), family = "binomial")  # warns about non-integer successes

# Weights (with zeros), offset, no intercept, aliased columns, NA in y, intercept only
w <- runif(n, 0.5, 2); w[c(4, 17, 30)] <- 0
yp <- sim("poisson", mupos); yg <- sim("Gamma", mupos); yb <- sim("binomial", mu01); yn <- sim("gaussian", mupos)
add(x = X, y = I(yp), family = "poisson", weights = I(w), newdata = newX)
add(x = X, y = I(yg), family = "Gamma", link = "log", weights = I(w))
add(x = X, y = I(yn), family = "gaussian", weights = I(w), newdata = newX)
expo <- runif(n, 1, 5)
yo <- rpois(n, expo * mupos)
add(x = X, y = I(yo), family = "poisson", offset = I(log(expo)), newdata = newX, newoffset = I(log(c(1, 2, 4))))
add(x = X, y = I(yo), family = "poisson", offset = I(log(expo)), epsilon = 1e-14, maxit = 100)
add(x = X, y = I(yb), family = "binomial", offset = I(0.3 * X[, 2]), newdata = newX, newoffset = I(c(0, 0.5, -1)))
add(x = X, y = I(yp), family = "poisson", intercept = FALSE, newdata = newX)
add(x = X, y = I(yn), family = "gaussian", intercept = FALSE)
Xa <- cbind(X, X[, 1] - 2 * X[, 2])  # column 3 = column 1 - 2 column 2
add(x = Xa, y = I(yb), family = "binomial", newdata = cbind(newX, newX[, 1] - 2 * newX[, 2]))
add(x = Xa, y = I(yp), family = "poisson")
add(x = X, y = I(c(yp[1:6], NA, yp[8:n])), family = "poisson")
add(x = matrix(numeric(0), n, 0), y = I(yp), family = "poisson")
add(x = matrix(numeric(0), n, 0), y = I(yb), family = "binomial")
add(x = X[1:3, ], y = I(yn[1:3]), family = "gaussian")  # zero residual degrees of freedom
add(x = X[1:3, ], y = I(yp[1:3]), family = "poisson")
add(x = X[1:3, ], y = I(yp[1:3]), family = "quasipoisson")

# Starting values; links that need them; step halving
add(x = X, y = I(yp), family = "poisson", start = I(c(1, 0.4, -0.3)))
add(x = X, y = I(yp), family = "poisson", link = "identity", start = I(c(3, 1, -1)))
add(x = X, y = I(yg), family = "Gamma", link = "identity", start = I(c(3, 1, -1)))
add(x = X, y = I(yb), family = "binomial", link = "log", start = I(c(-1, 0.1, -0.1)))
x6 <- matrix(1:8, 8, 1); y6 <- c(0, 0, 1, 0, 3, 5, 9, 14)
add(x = x6, y = I(y6), family = "poisson", link = "identity")
add(x = x6, y = I(y6), family = "poisson", link = "identity", start = I(c(10, -1)))  # steps truncated at the boundary
# starting values outside the valid range of the linear predictor: R refuses them
add(x = x6, y = I(y6), family = "poisson", link = "sqrt", start = I(c(-2, 0.1)))
add(x = x6, y = I(c(5, 3, 2, 2, 1, 1, 0.5, 0.4)), family = "Gamma", link = "inverse", start = I(c(-0.5, 0.4)))
add(x = x6, y = I(c(5, 3, 2, 2, 1, 1, 0.5, 0.4)), family = "Gamma", link = "inverse", start = I(c(0.1, 0.1)))

# Separation and non-convergence
xs <- matrix(1:6, 6, 1)
add(x = xs, y = I(c(0, 0, 0, 1, 1, 1)), family = "binomial")                 # complete separation
add(x = xs, y = I(c(0, 0, 1, 0, 1, 1)), family = "binomial")                 # overlap: a regular fit
add(x = cbind(1:8, c(0, 1, 0, 1, 0, 1, 0, 1)), y = I(c(0, 0, 0, 0, 1, 0, 1, 1)), family = "binomial")  # quasi-complete
add(x = X, y = I(yp), family = "poisson", maxit = 2)                       # stops before converging
add(x = X, y = I(yb), family = "binomial", link = "cauchit", maxit = 3)
add(x = X, y = I(yg), family = "Gamma", epsilon = 1e-3)

# Inputs R rejects or warns about
add(x = xs, y = I(c(0, 2, 1, 0, 1, 1)), family = "binomial")                 # y > 1
add(x = xs, y = I(c(0, -1, 1, 0, 1, 1)), family = "poisson")
add(x = xs, y = I(c(1, 0, 2, 3, 1, 1)), family = "Gamma")
add(x = xs, y = I(c(1, 0, 2, 3, 1, 1)), family = "inverse.gaussian")
add(x = xs, y = I(c(0.5, 1.5, 2, 3, 1, 1)), family = "poisson")              # non-integer counts: a warning in dpois (aic)
add(x = X, y = I(yp[1:10]), family = "poisson")                              # lengths differ

# (added later, at the end) links outside a family's usual list: R accepts every link its link factory knows
add(x = X, y = I(yp), family = "poisson", link = "inverse", newdata = newX)
add(x = X, y = I(yp), family = "poisson", link = "1/mu^2")
add(x = X, y = I(yp), family = "poisson", link = "logit")                    # Value 1.1 out of range (0, 1)
add(x = X, y = I(yp), family = "poisson", link = "cloglog")                  # no valid starting values
add(x = X, y = I(yp), family = "poisson", link = "probit")
add(x = X, y = I(yp), family = "quasipoisson", link = "inverse")
add(x = X, y = I(yg), family = "Gamma", link = "sqrt", newdata = newX)
add(x = X, y = I(yg), family = "Gamma", link = "1/mu^2")
add(x = X, y = I(yg), family = "inverse.gaussian", link = "sqrt")
add(x = X, y = I(yn), family = "gaussian", link = "sqrt", newdata = newX)
add(x = X, y = I(yn), family = "gaussian", link = "1/mu^2")
# (y = mu01 itself would be an exact fit whose deviance is rounding noise: a deterministic perturbation instead)
y01 <- mu01 + 0.04 * sin(seq_len(n))
add(x = X, y = I(y01), family = "gaussian", link = "logit")
add(x = X, y = I(y01), family = "gaussian", link = "cauchit")
add(x = X, y = I(yb), family = "binomial", link = "identity", start = I(c(mean(yb), 0, 0)), newdata = newX)
add(x = X, y = I(yb), family = "binomial", link = "sqrt", start = I(c(sqrt(mean(yb)), 0, 0)))
add(x = X, y = I(yb), family = "quasibinomial", link = "sqrt", start = I(c(sqrt(mean(yb)), 0, 0)))
add(x = X, y = I(yb), family = "quasibinomial", link = "identity", start = I(c(mean(yb), 0, 0)))
add(x = X, y = I(yp), family = "poisson", link = "foo")                      # not a link

# (added after; oracle/report-0.14.0-behaviour.md) the inverse link of the Poisson and Gamma families: a step that
# makes a mean negative gives "NaNs produced" (from the deviance residuals) before "step size truncated due to
# divergence"
x10 <- matrix(1:10, ncol = 1)
add(x = x10, y = I(c(1, 1, 3, 8, 6, 15, 7, 10, 15, 20)), family = "poisson", link = "inverse", start = I(c(0.5, -0.04)))
add(x = x10, y = I(c(1, 1, 3, 8, 6, 15, 7, 10, 15, 20)), family = "quasipoisson", link = "inverse", start = I(c(0.5, -0.04)))
add(x = x10, y = I(c(2, 4, 5, 7, 12, 15, 17, 36, 62, 97)), family = "poisson", link = "inverse", start = I(c(0.5, -0.04)))
add(x = x10, y = I(c(1.41, 5.01, 6.18, 4.36, 7.82, 7.39, 34.62, 82.57, 20.33, 55.75)), family = "Gamma", link = "inverse",
    start = I(c(0.5, -0.04)))
# quasi(variance = "mu^2") with a negative response: its deviance residual is NaN (log of y/mu), so the step cannot
# be corrected (an error)
add(x = x10, y = I(c(2.1, 1.4, -0.3, 2.2, 3.1, 2.7, 4.4, 3.9, 5.2, 6.1)), family = "quasi", variance = "mu^2", link = "log",
    start = I(c(0.5, 0.1)))

write_linalg_fixture("glm", cases, function(a) {
  r <- with_warnings(function() {
    fit <- glm_fit(a)
    s <- summary(fit)
    ct <- s$coefficients
    out <- list(
      coefficients = vec_out(coef(fit)),
      fittedValues = vec_out(fitted(fit)),
      linearPredictors = vec_out(fit$linear.predictors),
      deviance = num2str(fit$deviance), nullDeviance = num2str(fit$null.deviance),
      aic = num2str(fit$aic),
      rank = num2str(fit$rank), dfResidual = num2str(fit$df.residual), dfNull = num2str(fit$df.null),
      iter = num2str(fit$iter), converged = fit$converged, boundary = fit$boundary,
      devianceResiduals = vec_out(residuals(fit, "deviance")),
      pearsonResiduals = vec_out(residuals(fit, "pearson")),
      workingResiduals = vec_out(residuals(fit, "working")),
      responseResiduals = vec_out(residuals(fit, "response")),
      dispersion = num2str(s$dispersion),
      estimate = vec_out(ct[, 1]), stdError = vec_out(ct[, 2]), statistic = vec_out(ct[, 3]),
      pValue = vec_out(ct[, 4]), statisticName = colnames(ct)[3],
      covUnscaled = mat_out(s$cov.unscaled),
      hatvalues = vec_out(hatvalues(fit)), rstandard = vec_out(rstandard(fit)),
      cooksDistance = vec_out(cooks.distance(fit)),
      seLink = vec_out(predict(fit, type = "link", se.fit = TRUE)$se.fit),
      seResponse = vec_out(predict(fit, type = "response", se.fit = TRUE)$se.fit)
    )
    if (!is.null(a$newdata)) {
      nd <- glm_frame(a$newdata, if (!is.null(a$offset)) a$newoffset %||% rep(0, nrow(a$newdata)))
      pl <- predict(fit, nd, type = "link", se.fit = TRUE)
      pr <- predict(fit, nd, type = "response", se.fit = TRUE)
      out$predictLink <- vec_out(pl$fit); out$newSeLink <- vec_out(pl$se.fit)
      out$predictResponse <- vec_out(pr$fit); out$newSeResponse <- vec_out(pr$se.fit)
    }
    out
  })
  c(r$value, list(warnings = r$warnings))
})
