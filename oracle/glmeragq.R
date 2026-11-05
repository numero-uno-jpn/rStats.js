source("/oracle/_glmeragq.R")

# Fitted generalised linear mixed models with adaptive Gauss-Hermite quadrature, nAGQ > 1 (fixture glmerAgq).
# Behaviour in oracle/glmer-behaviour.md ("Adaptive Gauss-Hermite quadrature"). The arguments, the fields and their
# computation are those of oracle/glmer.R (its functions are used unchanged), with nAGQ from 2 to 100 and the
# deviance replaced by the AGQ deviance of oracle/glmeragqdev.R (oracle/_glmeragq.R): expected holds lme4's glmer
# and its methods; reference the same fields at the exact minimiser of the AGQ deviance (computed at the exact
# conditional mode with the exact Gauss-Hermite rule), found as in oracle/glmer.R (double-precision search from
# lme4's estimate, the boundary points of the term, Newton's method in 110-bit arithmetic), with vcov from the
# Hessian of the AGQ deviance in (theta, beta) or from RX by the same rule, logLik = -deviance / 2 (no aic term), and
# "devianceAtLme4" the exact AGQ deviance at lme4's estimates. The error cases are lme4's errors for nAGQ > 1.

bf <- "y ~ x + (1 | g)"
# binomial, cbpp: 2, 5 and 25 points, the proportion with weights, probit
add(cbf, cb, "binomial", "logit", 2)
add(cbf, cb, "binomial", "logit", 5)
add(cbf, cb, "binomial", "logit", 25)
add("prop ~ period + (1 | herd)", cb, "binomial", "logit", 9, weights = cb$size)
add(cbf, cb, "binomial", "probit", 9)
# binomial 0/1: an odd and an even number of points, a scalar slope term whose optimum is on the boundary, missing
# values
add(bf, dbin, "binomial", "logit", 3)
add(bf, dbin, "binomial", "logit", 10)
add("y ~ x + (0 + x | g)", dbin, "binomial", "logit", 5)
add(bf, dbna, "binomial", "logit", 7)
# poisson: log, an offset, an optimum on the boundary
add(bf, dpo, "poisson", "log", 5)
add("yt ~ x + (1 | g)", dpo, "poisson", "log", 9, offset = log(dpo$t))
add(bf, dps, "poisson", "log", 5)
# families with a dispersion: Gamma (3 and 9 points), inverse.gaussian, gaussian with the log link
add(bf, dgm, "Gamma", "log", 3)
add(bf, dgm, "Gamma", "log", 9)
add("yi ~ x + (1 | g)", dgm, "inverse.gaussian", "log", 5)
add("yg ~ x + (1 | g)", dgm, "gaussian", "log", 3)
# errors: two grouping factors, a vector-valued term, two scalar terms of one factor (lme4's second message), the
# same with the scalar term first in lme4's order of the terms, more than 100 points
add("y ~ x + (1 | g) + (1 | h)", dbin, "binomial", "logit", 3)
add("y ~ x + (x | g)", dbin, "binomial", "logit", 2)
add("y ~ x + (x || g)", dpo, "poisson", "log", 3)
add("y ~ x + (1 | g) + (x | g)", dbin, "binomial", "logit", 3)
add(bf, dbin, "binomial", "logit", 101)

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) {
    a <- cases[[i]]
    e <- tryCatch(expected(a), error = function(e) list(error = conditionMessage(e)))
    str(e[c("theta", "fixef", "stdError", "vcovFrom", "sigma", "logLik", "messages", "warnings", "error")])
    if (is.null(e$error)) { print(system.time(rr <- reference(a))); str(rr[c("theta", "fixef", "stdError", "sigma", "logLik", "devianceAtLme4", "gradient", "newtonSteps", "messages")]) }
  }
} else write_anova_fixture("glmerAgq", cases, expected, reference)
