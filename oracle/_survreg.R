source("/oracle/_htest.R")
suppressPackageStartupMessages(library(survival))

# Shared code for the survreg fixtures (oracle/survreg.R, oracle/survregpredict.R). Behaviour in
# oracle/survreg-behaviour.md. Written from that document and from experiments; no package source was read.
#
# Arguments of a fit (R's names where the rStats.js API is not decided):
#   time, time2 (interval types), event (status: 1/0 for "right" and "left"; 0 right, 1 exact, 2 left, 3 interval for
#   "interval"), type ("right" when absent, "left", "interval", "interval2"; for "interval2" a missing endpoint is "NA"
#   and an infinite one "Inf"/"-Inf"), x (covariate matrix without the intercept column, one row per observation, "NA"
#   for a missing value; absent for an intercept-only model), intercept (FALSE: no intercept), dist (absent: "weibull"),
#   weights, offset, strata (labels), scale (> 0: fixed), init, parms (degrees of freedom of "t"), maxiter,
#   rel.tolerance, toler.chol.
# The formula is Surv(...) ~ x1 + ... + xk [+ strata(strata)] [+ offset(offset)] [- 1].

sr_surv <- function(a) {
  type <- if (is.null(a$type)) "right" else a$type
  t1 <- unclass(a$time)
  switch(type,
    right = if (is.null(a$event)) Surv(t1) else Surv(t1, unclass(a$event)),
    left = Surv(t1, unclass(a$event), type = "left"),
    interval = Surv(t1, unclass(a$time2), unclass(a$event), type = "interval"),
    interval2 = Surv(t1, unclass(a$time2), type = "interval2"))
}

sr_frame <- function(a) {
  n <- length(a$time)
  d <- data.frame(row = seq_len(n))
  terms <- character(0)
  if (!is.null(a$x)) {
    x <- a$x; if (!is.matrix(x)) x <- matrix(x, ncol = 1)
    for (j in seq_len(ncol(x))) { d[[paste0("x", j)]] <- x[, j]; terms <- c(terms, paste0("x", j)) }
  }
  if (!is.null(a$strata)) { d$s <- unclass(a$strata); terms <- c(terms, "strata(s)") }
  if (!is.null(a$offset)) { d$off <- unclass(a$offset); terms <- c(terms, "offset(off)") }
  if (!is.null(a$weights)) d$w <- unclass(a$weights)
  rhs <- if (length(terms)) paste(terms, collapse = " + ") else "1"
  if (isFALSE(a$intercept)) rhs <- paste(rhs, "- 1")
  # The response is written as a Surv() call on columns (a stored Surv column is not found again by predict)
  type <- if (is.null(a$type)) "right" else a$type
  d$t1 <- unclass(a$time)
  if (!is.null(a$time2)) d$t2 <- unclass(a$time2)
  if (!is.null(a$event)) d$ev <- unclass(a$event)
  lhs <- switch(type, right = if (is.null(a$event)) "Surv(t1)" else "Surv(t1, ev)", left = "Surv(t1, ev, type = 'left')",
                interval = "Surv(t1, t2, ev, type = 'interval')", interval2 = "Surv(t1, t2, type = 'interval2')")
  list(data = d, formula = as.formula(paste(lhs, "~", rhs)))
}

sr_call <- function(a, extra = list()) {
  fr <- sr_frame(a)
  ctl <- survreg.control(maxiter = if (is.null(a$maxiter)) 30 else a$maxiter,
                         rel.tolerance = if (is.null(a$rel.tolerance)) 1e-9 else a$rel.tolerance,
                         toler.chol = if (is.null(a$toler.chol)) 1e-10 else a$toler.chol)
  args <- c(list(fr$formula, data = fr$data, dist = if (is.null(a$dist)) "weibull" else a$dist, control = ctl, score = TRUE), extra)
  if (!is.null(a$weights)) args$weights <- fr$data$w
  if (!is.null(a$scale)) args$scale <- a$scale
  if (!is.null(a$init)) args$init <- unclass(a$init)
  if (!is.null(a$parms)) args$parms <- a$parms
  do.call(survreg, args)
}

mat_rows <- function(m) lapply(seq_len(nrow(m)), function(i) I(num2str(unname(m[i, ]))))

# The expected fields of a fit
sr_fields <- function(fit) {
  s <- summary(fit)
  tab <- s$table
  list(coefficients = I(num2str(unname(fit$coefficients))), coefNames = I(names(fit$coefficients)),
       scale = I(num2str(unname(fit$scale))), icoef = I(num2str(unname(fit$icoef))),
       var = mat_rows(fit$var), loglik = I(num2str(fit$loglik)), iter = fit$iter, df = num2str(fit$df),
       idf = num2str(fit$idf), df.residual = num2str(fit$df.residual), n = s$n,
       linear.predictors = I(num2str(unname(fit$linear.predictors))), means = I(num2str(unname(fit$means))),
       score = I(num2str(unname(fit$score))),
       tableRowNames = I(rownames(tab)), value = I(num2str(unname(tab[, 1]))), se = I(num2str(unname(tab[, 2]))),
       z = I(num2str(unname(tab[, 3]))), p = I(num2str(unname(tab[, 4]))),
       chi = num2str(s$chi), chiDf = num2str(fit$df - fit$idf),
       chiP = num2str(pchisq(s$chi, fit$df - fit$idf, lower.tail = FALSE)))
}

# Runs f collecting the warnings; errors become {"error": message}
sr_try <- function(f) {
  r <- tryCatch(with_warnings(f), error = function(e) list(value = list(error = conditionMessage(e)), warnings = NULL))
  if (!is.null(r$value$error)) return(r$value)
  c(r$value, list(warnings = I(as.character(r$warnings))))
}

# ---- accurate per-observation derivatives (log domain), for the references ----
# Columns: g, dg/deta, d2g/deta2, dg/dlogsigma, d2g/dlogsigma2, d2g/deta dlogsigma (as residuals(type = "matrix")),
# g without the Jacobian of the transformation.
sr_lp <- function(dist, z, df) switch(dist,
  extreme = list(lf = z - exp(z), lF = if (z < -0.5) log(-expm1(-exp(z))) else log1p(-exp(-exp(z))), lS = -exp(z)),
  logistic = list(lf = dlogis(z, log = TRUE), lF = plogis(z, log.p = TRUE), lS = plogis(-z, log.p = TRUE)),
  gaussian = list(lf = dnorm(z, log = TRUE), lF = pnorm(z, log.p = TRUE), lS = pnorm(-z, log.p = TRUE)),
  t = list(lf = dt(z, df, log = TRUE), lF = pt(z, df, log.p = TRUE), lS = pt(-z, df, log.p = TRUE)))
sr_h <- function(dist, z, df) switch(dist,   # f'/f and f''/f
  extreme = { w <- exp(z); c(1 - w, w^2 - 3 * w + 1) },
  logistic = { w <- exp(-abs(z)); c(sign(-z) * (1 - w)/(1 + w), (w^2 - 4 * w + 1)/(1 + w)^2) },
  gaussian = c(-z, z^2 - 1),
  t = c(-(df + 1) * z/(df + z^2), (df + 1) * ((df + 2) * z^2 - df)/(df + z^2)^2))
sr_derivs <- function(dist, eta, sig, lo, hi, st, df = 4) {
  n <- length(eta); out <- matrix(NA_real_, n, 6)
  for (i in seq_len(n)) {
    s <- sig[i]
    if (st[i] == 1) {
      z <- (lo[i] - eta[i])/s; h <- sr_h(dist, z, df); l <- sr_lp(dist, z, df)
      de <- -h[1]/s; hp <- h[2] - h[1]^2
      out[i, ] <- c(l$lf - log(s), de, h[2]/s^2 - de^2, -z * h[1] - 1, z * h[1] + z^2 * hp, (h[1] + z * hp)/s)
      next
    }
    zl <- if (st[i] == 2) -Inf else (lo[i] - eta[i])/s
    zu <- if (st[i] == 0) Inf else if (st[i] == 2) (lo[i] - eta[i])/s else (hi[i] - eta[i])/s
    lP <- if (st[i] == 0) sr_lp(dist, zl, df)$lS else if (st[i] == 2) sr_lp(dist, zu, df)$lF else {
      a <- sr_lp(dist, zl, df); b <- sr_lp(dist, zu, df)
      if (zl > 0) a$lS + log1p(-exp(b$lS - a$lS)) else b$lF + log1p(-exp(a$lF - b$lF)) }
    rat <- function(z) if (!is.finite(z)) c(0, 0) else { r <- exp(sr_lp(dist, z, df)$lf - lP); c(r, r * sr_h(dist, z, df)[1]) }
    rl <- rat(zl); ru <- rat(zu); zl0 <- if (is.finite(zl)) zl else 0; zu0 <- if (is.finite(zu)) zu else 0
    de <- -(ru[1] - rl[1])/s; ds <- -(zu0 * ru[1] - zl0 * rl[1])
    out[i, ] <- c(lP, de, (ru[2] - rl[2])/s^2 - de^2, ds, (zu0^2 * ru[2] - zl0^2 * rl[2]) - ds * (1 + ds),
                  (zu0 * ru[2] - zl0 * rl[2])/s - de * (1 + ds))
  }
  out
}

# The data of a fit (fit$y holds the untransformed Surv matrix) on the scale of the distribution: lo, hi, status (0 right, 1 exact, 2 left, 3 interval), the base
# distribution, whether log-transformed
sr_ydata <- function(fit, a) {
  y <- fit$y
  dist <- if (is.null(a$dist)) "weibull" else a$dist
  dd <- survreg.distributions[[match.arg(dist, names(survreg.distributions))]]
  base <- if (is.null(dd$dist)) dist else dd$dist
  base <- switch(base, extreme = "extreme", logistic = "logistic", gaussian = "gaussian", t = "t")
  if (ncol(y) == 2) { lo <- y[, 1]; hi <- y[, 1]; st <- y[, 2]; if (attr(y, "type") == "left") st <- ifelse(st == 1, 1, 2) }
  else { lo <- y[, 1]; hi <- y[, 2]; st <- y[, 3] }
  tr <- !is.null(dd$trans)
  if (tr) { lo <- log(lo); hi <- log(hi) }
  list(lo = unname(lo), hi = unname(hi), st = unname(st), base = base, tr = tr)
}
