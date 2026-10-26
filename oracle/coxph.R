# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages(library(survival))

# Cox proportional hazards regression (ROADMAP): survival::coxph with right-censored data, the matrix interface
# coxph(Surv(time, status) ~ x [+ strata(strata)], weights, ties, init, control). Behaviour in
# oracle/coxph-behaviour.md.
#   Arguments: time, status (1 event, 0 censored), x (the covariate matrix, one row per observation, "NA" for a
#   missing value), and optionally weights, strata (labels), ties ("efron" or "breslow"), init, iter.max, eps.
#   Written (fit): coef (NA for an aliased column), var (matrix), loglik (initial and final), score (the score test),
#   wald (the Wald test, unrounded), iter, means, n, nevent, linear.predictors; (summary) se, z, p (the coefficient
#   table), lower, upper (the 95% interval of exp(coef)), logtest, sctest and waldtest (each test, df, pvalue), rsq
#   (rsq, maxrsq); warnings. Errors as {"error": message}.

set.seed(20261128)
sim <- function(n, beta, rate = 0.1, cens = 0.05, digits = NULL, p01 = FALSE) {
  x <- matrix(rnorm(n * length(beta)), n)
  if (p01) x[, 1] <- rbinom(n, 1, 0.4)
  t <- rexp(n, rate * exp(drop(x %*% beta))); c <- rexp(n, cens)
  time <- pmin(t, c); if (!is.null(digits)) time <- round(time, digits) + 10^-digits
  list(time = time, status = as.integer(t <= c), x = round(x, 4))
}
cases <- list()
add <- function(d, ...) cases[[length(cases) + 1]] <<- c(list(time = I(d$time), status = I(d$status), x = d$x), list(...))

s1 <- sim(60, 0.7)
s2 <- sim(120, c(0.5, -0.8), digits = 0)                       # heavy ties
s3 <- sim(200, c(0.3, -0.2, 0.9), p01 = TRUE, digits = 1)      # a 0/1 covariate (not centred), some ties
s4 <- sim(80, c(1.2, 0.4))
for (ties in c("efron", "breslow")) {
  add(s1, ties = ties); add(s2, ties = ties); add(s3, ties = ties); add(s4, ties = ties)
}
# the 0/1 covariate recoded to 0/2 (centred and scaled), and to -1/1 (not centred)
s3b <- s3; s3b$x[, 1] <- 2 * s3b$x[, 1]; add(s3b)
s3c <- s3; s3c$x[, 1] <- 2 * s3c$x[, 1] - 1; add(s3c)
# case weights, strata, a starting value
w2 <- sample(1:3, 120, replace = TRUE)  # integer weights: non-integer ones make R use the robust variance
add(s2, weights = I(w2)); add(s2, weights = I(w2), ties = "breslow")
add(s2, strata = I(rep(c("b", "a", "c"), 40))); add(s2, strata = I(rep(c("b", "a", "c"), 40)), ties = "breslow")
add(s2, strata = I(rep(c("b", "a", "c"), 40)), weights = I(w2))
add(s1, init = I(0.3)); add(s4, init = I(c(2, -1)))
# the lung data: age, sex, ph.ecog (one missing ph.ecog), and with sex as the strata
lungx <- as.matrix(lung[, c("age", "sex", "ph.ecog")])
lung1 <- list(time = lung$time, status = lung$status - 1L, x = lungx)
add(lung1); add(lung1, ties = "breslow")
add(list(time = lung$time, status = lung$status - 1L, x = lungx[, c(1, 3)]), strata = I(ifelse(lung$sex == 1, "m", "f")))
# fewer iterations than needed (warning), and a looser eps
add(s4, iter.max = 2); add(s4, eps = 1e-4)
# monotone likelihood (an infinite coefficient), stopped after 4 iterations: the information falls exponentially
# along the path, so a longer run amplifies the rounding of every step (R's own results differ between x86_64 and
# arm64 by 1e-7 after 20 iterations; after 4 they agree to 1e-14)
add(list(time = 1:10, status = c(1, 1, 1, 1, 1, 0, 0, 0, 0, 1), x = cbind(c(3, 2.5, 2, 1.8, 1.5, 0, 0.2, 0.1, 0.3, 1))), iter.max = 4)
add(list(time = 1:12, status = c(1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1),
         x = cbind(c(5, 4, 4, 3, 3, 3, 0, 0.5, 0.2, 0.1, 1, -2), round(seq(-1, 1, length = 12), 4))), iter.max = 4)
# the "coefficient may be infinite" warning with a loose eps (the loglik converges at the first step while the
# remaining step is still large); with a separating covariate the warning only comes with ill-conditioned results
loose <- function(seed) { set.seed(seed); n <- 40; x <- cbind(rnorm(n), rnorm(n)); t <- rexp(n, 0.1 * exp(0.05 * x[, 1]))
  c <- rexp(n, 0.03); list(time = round(pmin(t, c), 2) + 0.01, status = as.integer(t <= c), x = x) }
add(loose(40), eps = 0.01); add(loose(135), eps = 0.001)
set.seed(20261130)
# an indicator of the 2 earliest (events): the information of that column falls below the Cholesky tolerance (an NA
# coefficient)
o <- order(s4$time); ind <- numeric(80); ind[o[1:2]] <- 1; ind[s4$status == 0] <- 0
add(list(time = s4$time, status = s4$status, x = cbind(s4$x[, 1], ind)))
# an aliased column (the third is the sum of the first two)
s5 <- sim(70, c(0.4, 0.2)); s5$x <- cbind(s5$x, s5$x[, 1] + s5$x[, 2]); add(s5)
# a single event, and errors
add(list(time = c(5, 3, 8, 1, 9), status = c(0, 1, 0, 0, 0), x = cbind(c(1.2, 0.3, -0.5, 2, 0.7))))
add(s1, weights = I(c(0, rep(1, 59))))

write_anova_fixture("coxph", cases, function(a) {
  df <- data.frame(time = unclass(a$time), status = unclass(a$status))
  x <- a$x; colnames(x) <- paste0("x", seq_len(ncol(x)))
  df$x <- x
  if (!is.null(a$strata)) df$s <- unclass(a$strata)
  if (!is.null(a$weights)) df$w <- unclass(a$weights)
  ctl <- coxph.control(iter.max = if (is.null(a$iter.max)) 20 else a$iter.max, eps = if (is.null(a$eps)) 1e-9 else a$eps)
  fml <- if (is.null(a$strata)) Surv(time, status) ~ x else Surv(time, status) ~ x + strata(s)
  r <- tryCatch(with_warnings(function() {
    args <- list(fml, data = df, ties = if (is.null(a$ties)) "efron" else a$ties, control = ctl)
    if (!is.null(a$weights)) args$weights <- df$w
    if (!is.null(a$init)) args$init <- unclass(a$init)
    fit <- do.call(coxph, args)
    s <- summary(fit)
    test3 <- function(v) I(num2str(unname(v[c("test", "df", "pvalue")])))
    list(coef = I(num2str(unname(fit$coefficients))), var = lapply(seq_len(nrow(fit$var)), function(i) I(num2str(fit$var[i, ]))),
         loglik = I(num2str(fit$loglik)), score = num2str(fit$score), wald = num2str(fit$wald.test), iter = fit$iter,
         means = I(num2str(unname(fit$means))), n = fit$n, nevent = fit$nevent,
         linear.predictors = I(num2str(unname(fit$linear.predictors))),
         se = I(num2str(unname(s$coefficients[, "se(coef)"]))), z = I(num2str(unname(s$coefficients[, "z"]))),
         p = I(num2str(unname(s$coefficients[, "Pr(>|z|)"]))),
         lower = I(num2str(unname(s$conf.int[, 3]))), upper = I(num2str(unname(s$conf.int[, 4]))),
         logtest = test3(s$logtest), sctest = test3(s$sctest),
         waldtest = I(num2str(c(fit$wald.test, s$waldtest[c("df", "pvalue")]))), rsq = I(num2str(unname(s$rsq))))
  }), error = function(e) list(value = list(error = conditionMessage(e)), warnings = I(character(0))))
  c(r$value, list(warnings = r$warnings))
})
