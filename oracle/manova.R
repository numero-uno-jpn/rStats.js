# issue: 549
# Full MANOVA oracle; all cases from experiments/multivariate19.R
# multivariate19.R: stats (manova, summary.manova, cancor) and MASS 7.3.66 (lda, predict.lda) on small data and
# boundary cases, public functions only (1.9.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
library(MASS)
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
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
out <- list()

## MANOVA: summary.manova's table for each of the four tests, with and without the intercept row, and the SSP
## matrices and eigenvalues it reports
mv <- function(fit, ...) {
  tests <- c("Pillai", "Wilks", "Hotelling-Lawley", "Roy")
  res <- lapply(tests, function(t) run({ s <- summary(fit, test = t, ...); tab(s$stats) }))
  names(res) <- tests
  s <- summary(fit, ...)
  res$SS <- lapply(s$SS, tab)
  res$Eigenvalues <- tab(s$Eigenvalues)
  res$coef <- tab(coef(fit))
  res
}
out$manova_iris <- run(mv(manova(cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species, data = iris)))
out$manova_iris_intercept <- run(mv(manova(cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species,
                                           data = iris), intercept = TRUE))
mt <- transform(mtcars, cyl = factor(cyl), am = factor(am), gear = factor(gear))
out$manova_two_factors <- run(mv(manova(cbind(mpg, disp, hp) ~ cyl + am, data = mt)))
out$manova_two_factors_reversed <- run(mv(manova(cbind(mpg, disp, hp) ~ am + cyl, data = mt)))
out$manova_interaction <- run(mv(manova(cbind(mpg, qsec) ~ am * gear, data = mt)))
out$manova_covariate <- run(mv(manova(cbind(mpg, disp, hp) ~ wt + cyl, data = mt)))
out$manova_two_responses_two_groups <- run(mv(manova(cbind(mpg, hp) ~ am, data = mt)))
# Roy's F is an upper bound; df when the number of responses exceeds the term's df and the other way round
out$manova_p_gt_df <- run(mv(manova(cbind(mpg, disp, hp, drat, wt) ~ am, data = mt)))
# boundary cases: a single response, residual df below the number of responses, collinear responses, NA rows
out$manova_one_response <- run(mv(manova(cbind(mpg) ~ cyl, data = mt)))
out$manova_few_df <- run(mv(manova(cbind(mpg, disp, hp, drat, wt, qsec) ~ cyl, data = mt[1:8, ])))
out$manova_collinear <- run(mv(manova(cbind(mpg, disp, I(mpg + disp)) ~ cyl, data = mt)))
out$manova_na <- run({ d <- mt; d$mpg[3] <- NA; mv(manova(cbind(mpg, disp, hp) ~ cyl, data = d)) })
out$manova_tol <- run(mv(manova(cbind(mpg, disp, hp) ~ cyl, data = mt), tol = 0.5))
out$manova_scale <- run(mv(manova(cbind(mpg * 1e100, disp, hp * 1e-100) ~ cyl, data = mt)))
out$manova_npk <- run(mv(manova(cbind(yield, as.numeric(block)) ~ N * P, data = npk)))

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
