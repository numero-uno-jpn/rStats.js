# issue: 549
# Full canonical-correlation oracle; all cases from experiments/multivariate19.R
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

## Canonical correlation
cc <- function(r) list(cor = r$cor, xcoef = tab(r$xcoef), ycoef = tab(r$ycoef), xcenter = r$xcenter, ycenter = r$ycenter)
pop <- LifeCycleSavings[, 2:3]; oec <- LifeCycleSavings[, -(2:3)]
out$cancor_lifecycle <- run(cc(cancor(pop, oec)))
out$cancor_lifecycle_nocenter <- run(cc(cancor(pop, oec, xcenter = FALSE, ycenter = FALSE)))
out$cancor_lifecycle_given_center <- run(cc(cancor(pop, oec, xcenter = c(30, 2), ycenter = c(10, 1000, 4))))
out$cancor_iris <- run(cc(cancor(iris[, 1:2], iris[, 3:4])))
out$cancor_one_x <- run(cc(cancor(mtcars[, "wt", drop = FALSE], mtcars[, c("mpg", "hp", "qsec")])))
out$cancor_more_x_than_y <- run(cc(cancor(mtcars[, c("wt", "disp", "drat", "qsec")], mtcars[, c("mpg", "hp")])))
out$cancor_collinear <- run(cc(cancor(cbind(a = mtcars$wt, b = mtcars$disp, c = mtcars$wt + mtcars$disp), mtcars[, c("mpg", "hp")])))
out$cancor_n_small <- run(cc(cancor(mtcars[1:4, c("wt", "disp", "drat")], mtcars[1:4, c("mpg", "hp")])))
out$cancor_na <- run({ x <- pop; x[3, 1] <- NA; cc(cancor(x, oec)) })
out$cancor_scale <- run(cc(cancor(pop * 1e100, oec * 1e-100)))
out$cancor_vectors <- run(cc(cancor(mtcars$wt, mtcars$mpg)))
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
