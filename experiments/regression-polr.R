# regression-polr.R: MASS 7.3-66 polr on R's examples and boundary cases, public functions only (1.7.0)
# Output: JSON on stdout, 17 significant digits
suppressMessages(library(MASS))
library(jsonlite)
# Helpers (the same in each script): run() records the value, the warnings, the messages and the error of one call
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(m))
out <- list()

polrValues <- function(fit, newdata = NULL) {
  s <- summary(fit)
  v <- list(coefficients = coef(fit), zeta = fit$zeta, deviance = deviance(fit), edf = fit$edf, n = fit$n,
            nobs = fit$nobs, niter = fit$niter, convergence = fit$convergence, logLik = as.numeric(logLik(fit)),
            AIC = AIC(fit), BIC = BIC(fit), vcov = tab(vcov(fit)), summary = tab(coef(s)),
            fitted = tab(fitted(fit)), lp = fit$lp)
  if (!is.null(newdata)) {
    v$predictProbs <- tab(predict(fit, newdata = newdata, type = "probs"))
    v$predictClass <- as.character(predict(fit, newdata = newdata, type = "class"))
  }
  v
}
nd <- expand.grid(Infl = levels(housing$Infl), Type = levels(housing$Type), Cont = levels(housing$Cont))[c(1, 5, 9, 24), ]
out$newdata <- nd

for (m in c("logistic", "probit", "cloglog", "loglog", "cauchit")) {
  out[[paste0("housing_", m)]] <- run({
    fit <- polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing, method = m, Hess = TRUE)
    c(polrValues(fit, nd), list(confint = run(tab(confint(fit))), confintWald = tab(confint.default(fit)),
                                profileConfint90 = run(tab(confint(fit, level = 0.9)))))
  })
}
# cauchit: R's default start fails on housing above; with the logistic fit's estimates as the start, and on mtcars
out$housing_cauchit_start <- run({
  f0 <- polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing)
  fit <- polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing, method = "cauchit",
              start = c(coef(f0), f0$zeta), Hess = TRUE)
  c(polrValues(fit, nd), list(confint = run(tab(confint(fit)))))
})
out$housing_noHess_summary <- run({
  fit <- polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing)
  tab(coef(summary(fit)))
})
out$housing_anova <- run({
  f0 <- polr(Sat ~ Infl, weights = Freq, data = housing)
  f1 <- polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing)
  f2 <- polr(Sat ~ Infl * Type + Cont, weights = Freq, data = housing)
  a <- anova(f0, f1, f2)
  list(table = as.list(a), rows = rownames(a), heading = attr(a, "heading"))
})
# unweighted, numeric covariate, three to five levels
mt <- mtcars; mt$gearO <- factor(mt$gear, ordered = TRUE); mt$carbO <- factor(mt$carb, ordered = TRUE)
out$mtcars_gear <- run(polrValues(polr(gearO ~ mpg + wt, data = mt, Hess = TRUE), data.frame(mpg = c(15, 25), wt = c(3.5, 2))))
out$mtcars_gear_confint <- run(tab(confint(polr(gearO ~ mpg + wt, data = mt, Hess = TRUE))))
out$mtcars_carb_probit <- run(polrValues(polr(carbO ~ hp, data = mt, method = "probit", Hess = TRUE)))
out$mtcars_gear_cauchit <- run(polrValues(polr(gearO ~ mpg + wt, data = mt, method = "cauchit", Hess = TRUE)))
out$intercept_only <- run(polrValues(polr(gearO ~ 1, data = mt, Hess = TRUE)))
out$offset <- run(polrValues(polr(gearO ~ wt + offset(0.1 * mpg), data = mt, Hess = TRUE)))
out$start <- run(polrValues(polr(gearO ~ mpg, data = mt, start = c(0.5, 10, 12), Hess = TRUE)))
# boundaries and errors
out$two_levels <- run(polrValues(polr(factor(am) ~ mpg, data = mt, Hess = TRUE)))
out$unordered_factor_response <- run(coef(polr(factor(gear) ~ mpg, data = mt)))
out$numeric_response <- run(coef(polr(gear ~ mpg, data = mt)))
mt$empty <- factor(mt$gear, levels = c(3, 4, 5, 6), ordered = TRUE)
out$empty_level <- run(coef(polr(empty ~ mpg, data = mt)))
sep <- data.frame(y = factor(rep(1:3, each = 5), ordered = TRUE), x = 1:15)
out$separation <- run(polrValues(polr(y ~ x, data = sep, Hess = TRUE)))
sep2 <- data.frame(y = factor(c(1, 1, 2, 1, 2, 3, 2, 3, 3, 3), ordered = TRUE), x = 1:10)
out$near_separation <- run(c(polrValues(polr(y ~ x, data = sep2, Hess = TRUE)),
                             list(confint = run(tab(confint(polr(y ~ x, data = sep2, Hess = TRUE)))))))
out$collinear <- run(polrValues(polr(gearO ~ mpg + I(2 * mpg), data = mt, Hess = TRUE)))
out$na_rows <- run({ d <- mt; d$mpg[c(2, 7)] <- NA; polrValues(polr(gearO ~ mpg, data = d, Hess = TRUE)) })
out$zero_weight <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = c(0, rep(1, 31)), Hess = TRUE)))
out$scaled_x <- run(polrValues(polr(gearO ~ I(mpg * 1e8), data = mt, Hess = TRUE)))
out$bad_method <- run(coef(polr(gearO ~ mpg, data = mt, method = "logit")))

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", keep_vec_names = TRUE, pretty = FALSE), "\n")
