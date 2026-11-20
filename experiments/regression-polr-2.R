# regression-polr-2.R: the further polr experiments of oracle/polr-behaviour.md section 8 (MASS 7.3-66, public
# functions only, 1.7.0). Output: JSON on stdout, 17 significant digits
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

polrValues <- function(fit) {
  list(coefficients = as.list(coef(fit)), zeta = as.list(fit$zeta), deviance = deviance(fit), edf = fit$edf,
       n = fit$n, nobs = fit$nobs, convergence = fit$convergence, summary = tab(coef(summary(fit))),
       vcov = tab(vcov(fit)), fitted = tab(fitted(fit)))
}
mt <- mtcars; mt$gearO <- factor(mt$gear, ordered = TRUE)
f1 <- polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing, Hess = TRUE)

# 1. the intercept removed in the formula
out$no_intercept_minus1 <- run(polrValues(polr(gearO ~ mpg - 1, data = mt, Hess = TRUE)))
out$no_intercept_zero <- run(polrValues(polr(gearO ~ 0 + mpg, data = mt, Hess = TRUE)))
out$with_intercept <- run(polrValues(polr(gearO ~ mpg, data = mt, Hess = TRUE)))
out$no_intercept_factor <- run(polrValues(polr(Sat ~ 0 + Infl + Type, weights = Freq, data = housing, Hess = TRUE)))
out$intercept_factor <- run(polrValues(polr(Sat ~ Infl + Type, weights = Freq, data = housing, Hess = TRUE)))

# 2. prediction: default type, unseen level, missing value, missing column, offset in newdata
nd <- data.frame(Infl = "Low", Type = "Tower", Cont = "Low")
out$predict_default <- run(as.character(predict(f1, newdata = nd)))
out$predict_no_newdata_class <- run(as.character(predict(f1)))
out$predict_unseen_level <- run(tab(predict(f1, newdata = data.frame(Infl = "Huge", Type = "Tower", Cont = "Low"), type = "probs")))
out$predict_na <- run(predict(f1, newdata = data.frame(Infl = c("Low", NA), Type = "Tower", Cont = "Low"), type = "probs"))
out$predict_na_class <- run(as.character(predict(f1, newdata = data.frame(Infl = c("Low", NA), Type = "Tower", Cont = "Low"))))
out$predict_missing_column <- run(predict(f1, newdata = data.frame(Infl = "Low", Type = "Tower"), type = "probs"))
out$predict_one_row_probs <- run(predict(f1, newdata = nd, type = "probs"))
fo <- polr(gearO ~ wt + offset(0.1 * mpg), data = mt, Hess = TRUE)
out$predict_offset <- run(tab(predict(fo, newdata = data.frame(wt = c(2, 3), mpg = c(20, 30)), type = "probs")))
out$predict_numeric_na <- run(predict(polr(gearO ~ mpg, data = mt), newdata = data.frame(mpg = c(20, NA)), type = "probs"))

# 3. weights and empty response categories
out$weights_negative <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = c(-1, rep(1, 31)), Hess = TRUE)))
out$weights_na <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = c(NA, rep(1, 31)), Hess = TRUE)))
out$weights_inf <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = c(Inf, rep(1, 31)), Hess = TRUE)))
out$weights_all_zero <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = rep(0, 32), Hess = TRUE)))
out$weights_fractional <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = rep(c(0.5, 1.5), 16), Hess = TRUE)))
out$weights_doubled <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = rep(2, 32), Hess = TRUE)))
out$weights_wrong_length <- run(polrValues(polr(gearO ~ mpg, data = mt, weights = rep(1, 31), Hess = TRUE)))
hz <- housing; hz$Freq[hz$Sat == "Medium"] <- 0
out$zero_frequency_middle_category <- run(polrValues(polr(Sat ~ Infl + Type + Cont, weights = Freq, data = hz, Hess = TRUE)))
hz2 <- housing; hz2$Freq[hz2$Sat == "High"] <- 0
out$zero_frequency_top_category <- run(polrValues(polr(Sat ~ Infl + Type + Cont, weights = Freq, data = hz2, Hess = TRUE)))
mt$empty <- factor(mt$gear, levels = c(3, 4, 5, 6), ordered = TRUE)
out$empty_top_level <- run(polrValues(polr(empty ~ mpg, data = mt, Hess = TRUE)))
mt$emptyMid <- factor(mt$gear, levels = c(3, 3.5, 4, 5), ordered = TRUE)
out$empty_middle_level <- run(polrValues(polr(emptyMid ~ mpg, data = mt, Hess = TRUE)))

# 4. anova of fits that are not nested, not comparable, or given in another order
aov <- function(a) list(table = as.list(a), rows = rownames(a), heading = attr(a, "heading"))
fInfl <- polr(Sat ~ Infl, weights = Freq, data = housing)
fType <- polr(Sat ~ Type, weights = Freq, data = housing)
out$anova_not_nested <- run(aov(anova(fInfl, fType)))
out$anova_reversed <- run(aov(anova(f1, fInfl)))
out$anova_same <- run(aov(anova(f1, f1)))
out$anova_one <- run(aov(anova(f1)))
out$anova_other_link <- run(aov(anova(fInfl, polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing, method = "probit"))))
out$anova_other_rows <- run(aov(anova(polr(gearO ~ mpg, data = mt), polr(gearO ~ mpg + wt, data = mt[-1, ]))))
mt$carbO <- factor(pmin(mt$carb, 4), ordered = TRUE)
out$anova_other_response <- run(aov(anova(polr(gearO ~ mpg, data = mt), polr(carbO ~ mpg + wt, data = mt))))
out$anova_same_df <- run(aov(anova(polr(gearO ~ mpg, data = mt), polr(gearO ~ wt, data = mt))))

# 5. profile intervals: parm, levels, cut-points, failures
fm <- polr(gearO ~ mpg + wt, data = mt, Hess = TRUE)
out$confint_parm_name <- run(tab(confint(fm, parm = "wt")))
out$confint_parm_index <- run(tab(confint(fm, parm = 2)))
out$confint_parm_cutpoint <- run(confint(fm, parm = "3|4"))
out$confint_level_999 <- run(tab(confint(fm, level = 0.999)))
out$confint_level_50 <- run(tab(confint(fm, level = 0.5)))
out$confint_one_slope <- run(confint(polr(gearO ~ mpg, data = mt, Hess = TRUE)))
out$confint_intercept_only <- run(confint(polr(gearO ~ 1, data = mt, Hess = TRUE)))
out$confintWald_one_slope <- run(confint.default(polr(gearO ~ mpg, data = mt, Hess = TRUE)))
sep3 <- data.frame(y = factor(c(1, 1, 1, 2, 1, 2, 2, 3, 2, 3, 3, 3), ordered = TRUE), x = 1:12)
out$near_separation_2 <- run({ fs <- polr(y ~ x, data = sep3, Hess = TRUE); c(polrValues(fs), list(confint = run(tab(confint(fs))), confint99 = run(tab(confint(fs, level = 0.99))))) })
sep4 <- data.frame(y = factor(c(1, 1, 2, 1, 2, 2, 3, 2, 3, 3), ordered = TRUE), x = c(1:9, 30))
out$profile_outlier_x <- run({ fs4 <- polr(y ~ x, data = sep4, Hess = TRUE); c(polrValues(fs4), list(confint = run(tab(confint(fs4))))) })
out$profile_table <- run({ p <- profile(fm); list(names = names(p), mpg = as.list(p$mpg), wt = as.list(p$wt)) })
out$profile_alpha <- run({ p <- profile(fm, alpha = 0.01); list(mpg = as.list(p$mpg)) })

# 6. a fit with Hess = FALSE: vcov and summary refit, against Hess = TRUE
out$vcov_noHess <- run({ g <- polr(gearO ~ mpg + wt, data = mt); tab(vcov(g)) })
out$vcov_Hess <- run(tab(vcov(fm)))
out$summary_noHess <- run({ g <- polr(gearO ~ mpg + wt, data = mt); tab(coef(summary(g))) })
out$housing_vcov_noHess <- run(tab(vcov(polr(Sat ~ Infl + Type + Cont, weights = Freq, data = housing))))
out$housing_vcov_Hess <- run(tab(vcov(f1)))

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", keep_vec_names = TRUE, pretty = FALSE), "\n")
