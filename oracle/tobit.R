# issue: 567
# Public outputs of AER's tobit (on survival's survreg) and its summary for test/fixtures/tobit.json (1.17.0).
# The behaviour is in oracle/tobit-betareg-loglin-behaviour.md; the experiments behind it in
# experiments/regression117-tobit*.R. Public calls only. The data sets are written out so that the tests fit the
# same models.
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(AER) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, AER = as.character(packageVersion("AER")),
            survival = as.character(packageVersion("survival")))

## data: d (90 rows)
set.seed(20261125)
n <- 90
x1 <- round(rnorm(n), 4); x2 <- rbinom(n, 1, 0.4); g <- sample(c("a", "b", "c"), n, TRUE); w <- rpois(n, 2) + 1
ys <- round(0.5 + 1.2 * x1 - 0.8 * x2 + 0.4 * (g == "b") + rnorm(n, 0, 1.3), 4)
ys[1:3] <- 0
yp <- round(exp(0.5 + 0.6 * x1 + rnorm(n, 0, 0.7)), 4)
d <- data.frame(x1, x2, g, w, ys, yp, stringsAsFactors = FALSE)
assign("d", d, envir = globalenv())
out$data <- list(d = as.list(d))

fit_out <- function(f) {
  s <- summary(f)
  ll <- logLik(f)
  list(coefficients = unname(coef(f)), names = names(coef(f)), scale = unname(f$scale), var = unname(f$var),
       loglik = unname(f$loglik), icoef = unname(f$icoef), iter = f$iter, df = f$df, idf = f$idf,
       df_residual = f$df.residual, linear_predictors = unname(f$linear.predictors),
       table = unname(matrix(as.numeric(s$coefficients), nrow(s$coefficients))), table_rows = rownames(s$coefficients),
       wald = if (is.null(s$wald)) NULL else as.numeric(s$wald),
       logLik_df = attr(ll, "df"), aic = AIC(f), nobs = nobs(f), parms = if (is.null(s$parms)) NULL else s$parms,
       counts = as.numeric(s$n), counts_names = names(s$n))
}
cases <- list(
  list(formula = "ys ~ x1 + x2"),
  list(formula = "ys ~ x1 + x2", dist = "logistic"),
  list(formula = "ys ~ x1 + x2", dist = "t"),
  list(formula = "ys ~ x1 + x2", dist = "t", tdf = 3),
  list(formula = "ys ~ x1 + x2", left = -0.5, right = 2),
  list(formula = "ys ~ x1 + x2", left = -0.5, right = 2, dist = "logistic"),
  list(formula = "ys ~ x1 + x2", left = -Inf, right = 2),
  list(formula = "ys ~ x1 + x2", left = -Inf, right = Inf),
  list(formula = "ys ~ x1 + g"),
  list(formula = "ys ~ 0 + x1 + x2"),
  list(formula = "ys ~ x1"),
  list(formula = "ys ~ 1"),
  list(formula = "ys ~ x1 + x2", weights = "w"),
  list(formula = "ys ~ x1 * x2", left = 0.2),
  list(formula = "yp ~ x1", left = 1, dist = "weibull"),
  list(formula = "yp ~ x1", left = 1, right = 4, dist = "lognormal"),
  list(formula = "yp ~ x1", right = 4, left = -Inf, dist = "exponential"),
  list(formula = "yp ~ x1", left = 1, dist = "loglogistic"),
  list(formula = "yp ~ x1", dist = "weibull"),
  list(formula = "yp ~ x1", left = 1, dist = "rayleigh")
)
out$fits <- lapply(cases, function(cs) {
  left <- if (is.null(cs$left)) 0 else cs$left; right <- if (is.null(cs$right)) Inf else cs$right
  dist <- if (is.null(cs$dist)) "gaussian" else cs$dist
  args <- list(formula = as.formula(cs$formula), left = left, right = right, dist = dist, data = d)
  if (!is.null(cs$tdf)) args$parms <- cs$tdf
  if (!is.null(cs$weights)) args$weights <- d[[cs$weights]]
  r <- run(do.call(tobit, args))
  res <- c(cs, list(left = left, right = right, dist = dist, warnings = r$warnings))
  if (!is.null(r$error)) c(res, list(error = r$error)) else c(res, fit_out(r$value))
})
## errors
d0 <- d; d0$yz <- d0$yp; d0$yz[1:4] <- 0
assign("d0", d0, envir = globalenv())
out$errors <- list(
  list(formula = "ys ~ x1", left = 3, right = 2, error = run(tobit(ys ~ x1, left = 3, right = 2, data = d))$error),
  list(formula = "ys ~ x1", left = 100, error = run(tobit(ys ~ x1, left = 100, data = d))$error),
  list(formula = "yz ~ x1", dist = "weibull", data = "d0", error = run(tobit(yz ~ x1, dist = "weibull", data = d0))$error))
out$data$d0 <- as.list(d0)

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE),
           file.path("/out", "tobit.json"))
