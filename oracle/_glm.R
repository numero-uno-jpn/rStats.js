source("/oracle/_linalg.R")

# Shared code for the glm oracles (glm, glmconfint, glmanova). Same fixture format as oracle/lm.R.
#
# A case describes the model with a matrix interface:
#   x          model matrix without the intercept column (n x p, p may be 0)
#   y          response; for the binomial families also a two-column matrix (successes, failures)
#   family     "gaussian", "binomial", "poisson", "Gamma", "inverse.gaussian", "quasi", "quasibinomial", "quasipoisson"
#   link       link name (omitted: the family's default)
#   linkPower  power link mu^linkPower (power(); log for 0), instead of link
#   variance   variance function of quasi ("constant", "mu(1-mu)", "mu", "mu^2", "mu^3")
#   intercept  FALSE for a model without the intercept (default TRUE)
#   weights    prior weights
#   offset     offset on the linear predictor
#   start      starting coefficients (intercept first when present)
#   epsilon, maxit   glm.control (default 1e-8 and 25)
# Each column of x is one term (x1, ..., xp), so that anova tests the columns one by one. Rows with NA are dropped
# (na.omit, R's default).

# The family object. Built as a call, since the families read their link argument unevaluated (substitute)
glm_family <- function(a) {
  args <- list()
  if (!is.null(a$linkPower)) args$link <- call("power", a$linkPower)
  else if (!is.null(a$link)) args$link <- a$link
  if (!is.null(a$variance)) args$variance <- a$variance
  eval(as.call(c(list(call("::", quote(stats), as.name(a$family))), args)))
}

# Data frame with the columns x1..xp of x (and off for the offset)
glm_frame <- function(x, offset = NULL) {
  x <- as.matrix(x)
  d <- as.data.frame(x)
  names(d) <- if (ncol(x) > 0) paste0("x", seq_len(ncol(x))) else character(0)
  if (ncol(x) == 0) d <- data.frame(row.names = seq_len(nrow(x)))
  if (!is.null(offset)) d$off <- unclass(offset)
  d
}

# Formula y ~ x1 + ... + xp (+ offset(off)), without the intercept when intercept = FALSE; cols selects the terms
glm_formula <- function(a, cols = seq_len(ncol(as.matrix(a$x)))) {
  rhs <- c(if (isFALSE(a$intercept)) "0" else "1", if (length(cols)) paste0("x", cols),
           if (!is.null(a$offset)) "offset(off)")
  as.formula(paste("y ~", paste(rhs, collapse = " + ")), env = globalenv())
}

# Fits the case (cols: the terms to include, for anova and the profile of confint)
glm_fit <- function(a, cols = seq_len(ncol(as.matrix(a$x)))) {
  d <- glm_frame(a$x, a$offset)
  y <- if (is.matrix(a$y)) a$y else unclass(a$y)
  d$y <- if (is.matrix(y)) I(y) else y
  cl <- list(formula = glm_formula(a, cols), family = glm_family(a), data = d,
             control = glm.control(epsilon = a$epsilon %||% 1e-8, maxit = a$maxit %||% 25))
  if (!is.null(a$weights)) { cl$data$.w <- unclass(a$weights); cl$weights <- quote(.w) }
  if (!is.null(a$start)) cl$start <- unclass(a$start)
  do.call("glm", cl)
}

# Runs f, collecting the warning messages instead of printing them
with_warnings <- function(f) {
  w <- character(0)
  v <- withCallingHandlers(f(), warning = function(cnd) {
    w <<- c(w, conditionMessage(cnd))
    invokeRestart("muffleWarning")
  })
  list(value = v, warnings = I(unique(w)))
}

# Simulation helpers for the oracles
rinvgauss <- function(n, mu, lambda) {
  # Michael, Schucany and Haas (1976)
  nu <- rnorm(n)^2
  x <- mu + mu^2 * nu / (2 * lambda) - mu / (2 * lambda) * sqrt(4 * mu * lambda * nu + mu^2 * nu^2)
  ifelse(runif(n) <= mu / (mu + x), x, mu^2 / x)
}
