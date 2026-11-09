# oracle-platform: amd64
source("/oracle/_survreg.R")

# Parametric survival regression (ROADMAP item 1, accelerated failure time and Tobit models): survival::survreg with
# every built-in distribution, right, left and interval censoring, weights, offset, strata, a fixed scale, init and
# control. Behaviour in oracle/survreg-behaviour.md. Runs on x86_64 R like oracle/coxph.R (the iterations are
# compared to the last bits).
#   Arguments: see oracle/_survreg.R.
#   Written: coefficients (NA for an aliased column), coefNames, scale (one per stratum), icoef (intercept and log
#   scales of the intercept-only model), var (rows; the coefficients, then the log scales unless the scale is fixed),
#   loglik (intercept-only model, model), iter, df, idf, df.residual, n, linear.predictors (including the offset),
#   means, score (the score vector at the returned coefficients, survreg(score = TRUE)), the summary table
#   (tableRowNames, value, se, z, p), chi (2 (loglik[2] - loglik[1])), chiDf (df - idf), chiP (its upper chi-squared
#   tail, as print.survreg shows it), warnings. Errors as {"error": message}.
#   Cases where R is not the right answer have "reference" with "refKind" (see the behaviour document):
#     "nullIter": the intercept-only model inside a fit is stopped silently after 20 iterations; reference loglik1 is
#                 the maximum of the intercept-only likelihood (accurate log-domain Newton iterations).

set.seed(20261109)
lung2 <- na.omit(lung[, c("time", "status", "age", "sex", "ph.ecog")])
L <- list(time = I(lung2$time), event = I(lung2$status - 1L))
Lx <- as.matrix(lung2[, c("age", "sex", "ph.ecog")]); Lx1 <- as.matrix(lung2[, "age", drop = FALSE])
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
addL <- function(x = Lx, ...) add(time = L$time, event = L$event, x = x, ...)

# ---- every distribution on the lung data (right censoring) ----
for (d in c("weibull", "exponential", "rayleigh", "lognormal", "loggaussian", "loglogistic", "gaussian", "logistic",
            "extreme", "t")) addL(dist = d)
addL(dist = "t", parms = 10)
addL(dist = "t", parms = 3)
addL(x = NULL)                                          # intercept only: loglik[1] = loglik[2]
addL(x = NULL, dist = "lognormal")
# ---- control: running out (warning from maxiter 2 on), tolerances ----
for (k in 0:4) addL(x = Lx1, maxiter = k)
addL(x = NULL, maxiter = 2)                             # intercept only: the warning twice in R (written once)
addL(x = Lx1, rel.tolerance = 1e-3); addL(x = Lx1, rel.tolerance = 0); addL(x = Lx1, rel.tolerance = 0.06)
addL(x = Lx1, toler.chol = 1e-4)
addL(x = Lx1, dist = "lognormal", maxiter = 1)
# ---- init: full (with log scale) and coefficients only; far starting values (outer-product steps, shrunk steps,
# the limit on a falling log scale) ----
addL(x = Lx1, init = I(c(6, -0.01, -0.3)))
addL(x = Lx1, init = I(c(6, -0.01)))
addL(x = Lx1, init = I(c(5.829, -0.0012, -1.27)), maxiter = 12)
addL(x = Lx1, init = I(c(6.432, 0.002, 1.208)), maxiter = 8)
addL(x = Lx1, init = I(c(7.109, -0.0053, 0.813)), maxiter = 8)
addL(x = Lx1, init = I(c(8, 0.05, 1)))
for (k in c(1, 2, 3)) addL(x = NULL, init = I(c(6, 1.5)), maxiter = k)
for (k in c(4, 6, 7)) addL(x = NULL, init = I(c(4, 0)), maxiter = k)
addL(x = NULL, init = I(c(8, 1)), maxiter = 1)
addL(x = NULL, init = I(c(8, 1)), maxiter = 1, rel.tolerance = 0.5)  # converges at the first evaluation
addL(x = NULL, maxiter = 1, rel.tolerance = 0.5)                     # converges although worse than the start
addL(dist = "lognormal", init = I(c(4, 0.05, 1, -1, -1)))
# ---- weights, offset, strata, fixed scale ----
wi <- sample(1:3, nrow(lung2), TRUE); wf <- round(runif(nrow(lung2), 0.2, 3), 3)
addL(weights = I(wi)); addL(weights = I(wf)); addL(weights = I(wf), dist = "lognormal")
addL(x = Lx1, init = I(c(8, 0.05, 1)), weights = I(wf))
addL(x = Lx1, offset = I(lung2$sex / 2))
addL(x = Lx1, strata = I(ifelse(lung2$sex == 1, "m", "f")))
addL(x = Lx1, strata = I(ifelse(lung2$sex == 1, "m", "f")), dist = "lognormal", weights = I(wi))
addL(x = Lx1, strata = I(c("b", "a", "c")[lung2$ph.ecog %% 3 + 1]), dist = "loglogistic")
addL(x = NULL, strata = I(ifelse(lung2$sex == 1, "m", "f")))
addL(scale = 1.3); addL(scale = 1.3, dist = "gaussian"); addL(scale = 0.5, dist = "loglogistic")
addL(scale = 2, dist = "exponential")                   # warning: the fixed scale wins
# ---- scaling by powers of two ----
addL(x = Lx1 * 2^5); addL(x = Lx1 * 2^-3)
add(time = I(lung2$time * 2^5), event = L$event, x = Lx1)
add(time = I(lung2$time * 2^-3), event = L$event, x = Lx1, dist = "gaussian")
# ---- Tobit (gaussian, left censoring at 0), the tobin data ----
add(time = I(tobin$durable), event = I(as.integer(tobin$durable > 0)), type = "left", x = as.matrix(tobin[, c("age", "quant")]), dist = "gaussian")
add(time = I(tobin$durable), event = I(as.integer(tobin$durable > 0)), type = "left", x = as.matrix(tobin[, c("age", "quant")]), dist = "logistic")
# ---- interval censoring (simulated) ----
n <- 80; xs <- cbind(round(rnorm(n), 3), rbinom(n, 1, 0.5)); tt <- exp(1 + 0.5 * xs[, 1] + 0.4 * log(rexp(n)))
st <- sample(0:3, n, TRUE, prob = c(.3, .3, .2, .2)); lo <- round(tt, 3); hi <- round(tt * runif(n, 1.2, 2), 3)
lo[st == 2] <- round(tt[st == 2] * 1.3, 3); hi[st != 3] <- 1
IV <- list(time = I(lo), time2 = I(hi), event = I(st), type = "interval", x = xs)
for (d in c("weibull", "lognormal", "loglogistic", "exponential", "gaussian", "logistic", "t")) do.call(add, c(IV, list(dist = d)))
do.call(add, c(IV, list(weights = I(sample(1:3, n, TRUE)))))
do.call(add, c(IV, list(strata = I(rep(c("a", "b", "c"), length = n)), dist = "lognormal")))
do.call(add, c(IV, list(offset = I(xs[, 2] * 0.3), dist = "loglogistic")))
do.call(add, c(IV, list(init = I(c(3, 1, -1, 0.5)))))
# extreme value on the log times (the weibull fit, likelihood without the Jacobian)
IVl <- IV; IVl$time <- I(log(lo)); IVl$time2 <- I(ifelse(st == 3, log(hi), 1)); do.call(add, c(IVl, list(dist = "extreme")))
# interval2 with open ends: NA or -Inf below (left censored), NA or Inf above (right censored), 0 below for a log
# distribution (left censored), equal ends (exact)
a2 <- round(tt, 3); b2 <- round(tt * runif(n, 1.1, 1.8), 3)
k <- sample(1:5, n, TRUE); a2[k == 1] <- NA; a2[k == 2] <- 0; b2[k == 3] <- NA; b2[k == 4] <- Inf; b2[k == 5] <- a2[k == 5]
add(time = I(a2), time2 = I(b2), type = "interval2", x = xs, dist = "weibull")
a3 <- a2; a3[k == 2] <- -Inf; add(time = I(a3), time2 = I(b2), type = "interval2", x = xs, dist = "gaussian")
# left censoring with a log distribution
add(time = I(lo), event = I(as.integer(st != 2)), type = "left", x = xs, dist = "weibull")
# ---- boundaries ----
tb <- c(5, 8, 3, 9, 12, 4, 7, 6); xb <- cbind(c(1, 0, 1, 0, 1, 0, 1, 1))
add(time = I(tb), event = I(c(1, rep(0, 7))), x = xb)              # one event (monotone likelihood in x)
add(time = I(tb), event = I(c(1, rep(0, 7))))                      # one event, intercept only
add(time = I(tb), event = I(c(1, 1, rep(0, 6))), x = xb)
add(time = I(tb), event = I(c(1, 0, 1, 0, 1, 0, 1, 1)), x = xb)    # separation
add(time = I(tb), event = I(rep(0, 8)), x = xb)                    # no events: R runs out (no maximum)
add(time = I(tb), event = I(rep(0, 8)))                            # no events, intercept only: R "converges"
add(time = I(tb), event = I(rep(0, 8)), x = xb, dist = "gaussian")
add(time = I(rep(5, 8)))                                           # identical exact times: start scale 0
add(time = I(rep(5, 8)), x = xb)
add(time = I(5), event = I(1))                                      # one observation
add(time = I(5), event = I(1), scale = 1)
add(time = I(c(5, 7)), event = I(c(1, 1)))
add(time = I(tb), event = I(rep(0, 8)), type = "left")
add(time = I(tb), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = cbind(xb, 2 * xb))   # aliased column
add(time = I(tb), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = xb, intercept = FALSE)
add(time = I(c(NA, tb[-1])), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = xb)      # missing values dropped
add(time = I(tb), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = cbind(c(NA, xb[-1])))
add(time = I(tb), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = xb, weights = I(c(NA, rep(1, 7))))
add(time = I(tb), event = I(c(2, 0, 1, 1, 0, 1, 1, 0)), x = xb)                 # invalid status: NA (warning)
add(time = I(c(-1, tb[-1])), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = xb, dist = "gaussian")
add(time = I(tb), event = I(c(1, 0, 1, 1, 0, 1, 1, 0)), x = xb, maxiter = -1)
# R's substitutes for an underflowing density (a fixed scale on raw times with the extreme value distribution): the
# intercept-only model runs out silently after 20 iterations (reference: its maximum)
do.call(add, c(IV, list(dist = "extreme", scale = 0.7)))
# ---- errors ----
ev8 <- I(c(1, 0, 1, 1, 0, 1, 1, 0))
add(time = I(c(0, tb[-1])), event = ev8, x = xb)                                 # Invalid survival times
add(time = I(c(-1, tb[-1])), event = ev8, x = xb)
add(time = I(c(Inf, tb[-1])), event = ev8, x = xb)
add(time = I(c(0, tb[-1])), event = I(c(0, 0, 1, 1, 0, 1, 1, 0)), x = xb, type = "left")
add(time = I(tb), event = ev8, x = xb, weights = I(c(0, rep(1, 7))))
add(time = I(tb), event = ev8, x = xb, weights = I(c(-1, rep(1, 7))))
add(time = I(tb), event = ev8, x = xb, dist = "foo")
add(time = I(tb), event = ev8, x = xb, scale = -1)
add(time = I(tb), event = ev8, x = xb, init = I(1))
add(time = I(tb), event = ev8, x = xb, init = I(c(2, 0, 0, 1)))
add(time = I(tb), event = ev8, x = xb, init = I(c(2, 0, 0)), scale = 1)
add(time = I(tb), event = ev8, x = xb, strata = I(rep(c("a", "b"), 4)), scale = 1)
add(time = I(tb), event = ev8, x = xb, dist = "t", parms = 2)
add(time = I(tb), event = ev8, x = xb, parms = 3)
add(time = I(tb), time2 = I(tb), event = I(c(3, 1, 1, 1, 3, 1, 1, 1)), type = "interval", x = xb)  # zero-width interval
add(time = I(tb), time2 = I(tb - 1), event = I(rep(3, 8)), type = "interval", x = xb)              # start > stop
add(time = I(c(Inf, tb[-1])), event = I(c(0, 0, 1, 1, 0, 1, 1, 0)), x = xb, dist = "gaussian")
add(time = I(tb), event = ev8, x = cbind(c(Inf, xb[-1])))

# The maximum of the intercept-only likelihood (log domain), for refKind "nullIter"
null_max <- function(fit, a) {
  yd <- sr_ydata(fit, a); n <- length(yd$lo); fix <- a$scale
  ll <- function(p) { s <- if (is.null(fix)) exp(p[2]) else fix
    sum(sr_derivs(yd$base, rep(p[1], n), rep(s, n), yd$lo, yd$hi, yd$st)[, 1]) }
  p <- c(fit$icoef[1], if (is.null(fix)) fit$icoef[2])
  for (i in 1:200) {
    s <- if (is.null(fix)) exp(p[2]) else fix
    m <- sr_derivs(yd$base, rep(p[1], n), rep(s, n), yd$lo, yd$hi, yd$st)
    u <- c(sum(m[, 2]), if (is.null(fix)) sum(m[, 4])); H <- if (is.null(fix)) matrix(c(sum(m[, 3]), sum(m[, 6]), sum(m[, 6]), sum(m[, 5])), 2) else matrix(sum(m[, 3]))
    d <- -solve(H, u); l0 <- ll(p); h <- 1
    while (h > 1e-10 && !(ll(p + h * d) >= l0)) h <- h / 2
    p <- p + h * d; if (max(abs(h * d)) < 1e-14 * max(1, abs(p))) break
  }
  ll(p) - if (yd$tr) sum(yd$lo[yd$st == 1]) else 0
}

write_htest_fixture("survreg", cases, function(a) sr_try(function() sr_fields(sr_call(a))), ref = function(a) {
  if (!(identical(a$dist, "extreme") && identical(a$scale, 0.7))) return(NULL)
  fit <- suppressWarnings(sr_call(a))
  list(refKind = "nullIter", loglik1 = num2str(null_max(fit, a)))
})
