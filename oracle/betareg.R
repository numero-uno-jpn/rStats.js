# issue: 567
# Public outputs of betareg's betareg (ML, BC, BR), summary, confint, predict and residuals for
# test/fixtures/betareg.json (1.17.0). The behaviour is in oracle/tobit-betareg-loglin-behaviour.md; the experiments
# behind it in experiments/regression117-betareg*.R. Public calls only. R stops its maximisation short of the exact
# maximum (about 1e-7 relative), so the tests compare estimates and what is built on them at about 1e-6 relative. The
# data sets are written out so that the tests fit the same models. The log link fails in R when its start gives a mean
# above 1 ("initial value in 'vmmin' is not finite"); one such case is kept.
library(jsonlite)
suppressPackageStartupMessages({ library(betareg) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, betareg = as.character(packageVersion("betareg")))

## data: d (70 rows)
set.seed(20261125)
n <- 70
x1 <- round(rnorm(n), 4); x2 <- round(runif(n), 4); z1 <- round(rnorm(n), 4); g <- sample(c("a", "b", "c"), n, TRUE)
w <- rpois(n, 1.5) + 1
mu0 <- plogis(-0.3 + 0.6 * x1 - 0.8 * x2 + 0.3 * (g == "c")); ph0 <- exp(2.5 + 0.5 * z1)
yv <- round(rbeta(n, mu0 * ph0, (1 - mu0) * ph0), 6)
yc <- round(rbeta(n, mu0 * 20, (1 - mu0) * 20), 6)
yv <- pmin(pmax(yv, 1e-6), 1 - 1e-6); yc <- pmin(pmax(yc, 1e-6), 1 - 1e-6)
ysm <- round(yc / 3, 6)   # small values, for the log link (whose start must give mu < 1)
d <- data.frame(x1, x2, z1, g, w, yv, yc, ysm, stringsAsFactors = FALSE)
assign("d", d, envir = globalenv())
nd <- data.frame(x1 = c(-1, 0, 1.5), x2 = c(0.2, 0.5, 0.9), z1 = c(0.5, -1, 0), g = c("a", "b", "c"), stringsAsFactors = FALSE)
out$data <- list(d = as.list(d), newdata = as.list(nd))

fit_out <- function(f, deep) {
  s <- summary(f)
  cf <- c(f$coefficients$mean, f$coefficients$precision)
  res <- list(coefficients = unname(cf), mean_names = names(f$coefficients$mean),
       precision_names = names(f$coefficients$precision), names = names(coef(f)),
       vcov = unname(f$vcov), loglik = f$loglik, pseudo_r_squared = f$pseudo.r.squared,
       bias = if (is.null(f$bias)) NULL else unname(f$bias), start = unname(f$start),
       n = f$n, nobs = f$nobs, df_null = f$df.null, df_residual = f$df.residual, logLik_df = attr(logLik(f), "df"),
       aic = AIC(f), fitted = unname(fitted(f)), converged = f$converged,
       mean_table = unname(s$coefficients$mean), precision_table = unname(s$coefficients$precision),
       link = f$link$mean$name, link_phi = f$link$precision$name, type = f$type)
  if (deep) {
    res$confint95 <- unname(confint(f)); res$confint90 <- unname(confint(f, level = 0.9))
    res$residuals <- lapply(c(quantile = "quantile", deviance = "deviance", pearson = "pearson", response = "response",
                              weighted = "weighted", sweighted = "sweighted", sweighted2 = "sweighted2"),
                            function(ty) unname(as.numeric(residuals(f, type = ty))))
    res$hatvalues <- unname(hatvalues(f))
    res$predict <- list(response = unname(predict(f, nd)), link = unname(predict(f, nd, type = "link")),
                        precision = unname(predict(f, nd, type = "precision")),
                        variance = unname(predict(f, nd, type = "variance")),
                        quantile3 = unname(predict(f, nd, type = "quantile", at = c(0.25, 0.5, 0.75))),
                        quantile2 = unname(predict(f, nd, type = "quantile", at = c(0.25, 0.75))),
                        quantile1 = unname(predict(f, nd, type = "quantile", at = 0.5)),
                        quantile3_matrix = unname(predict(f, nd, type = "quantile", at = c(0.25, 0.5, 0.75), elementwise = FALSE)),
                        density = unname(predict(f, nd, type = "density", at = 0.4)),
                        probability = unname(predict(f, nd, type = "probability", at = c(0.3, 0.6))),
                        parameters = unname(as.matrix(predict(f, nd, type = "parameters"))),
                        fitted_link = unname(predict(f, type = "link")),
                        fitted_precision = unname(predict(f, type = "precision")))
  }
  res
}
cases <- list(
  list(formula = "yc ~ x1 + x2", deep = TRUE),
  list(formula = "yv ~ x1 + x2 | z1", deep = TRUE),
  list(formula = "yc ~ x1 + x2", link = "probit"),
  list(formula = "yc ~ x1 + x2", link = "cloglog"),
  list(formula = "yc ~ x1 + x2", link = "cauchit"),
  list(formula = "yc ~ x1 + x2", link = "log"),
  list(formula = "ysm ~ x1 + x2", link = "log"),
  list(formula = "ysm ~ x1 + x2 | z1", link = "log"),
  list(formula = "yc ~ x1 + x2", link = "loglog"),
  list(formula = "yv ~ x1 + x2 | z1", link = "probit"),
  list(formula = "yv ~ x1 + x2 | z1", link = "cloglog"),
  list(formula = "yv ~ x1 + x2 | z1", link = "cauchit"),
  list(formula = "yv ~ x1 + x2 | z1", link = "loglog"),
  list(formula = "yc ~ x1 + x2", link_phi = "log"),
  list(formula = "yc ~ x1 + x2", link_phi = "sqrt"),
  list(formula = "yv ~ x1 + x2 | z1", link_phi = "sqrt"),
  list(formula = "yv ~ x1 + x2 | z1", link_phi = "identity"),
  list(formula = "yc ~ x1 + g"),
  list(formula = "yv ~ x1 | z1 + g"),
  list(formula = "yv ~ x1 + x2 | x1 + z1"),
  list(formula = "yc ~ 1"),
  list(formula = "yv ~ 1", link = "probit"),
  list(formula = "yc ~ x1 + x2", weights = "w", deep = TRUE),
  list(formula = "yv ~ x1 + x2 | z1", weights = "w", deep = TRUE),
  list(formula = "yc ~ x1 + x2", type = "BC", deep = TRUE),
  list(formula = "yc ~ x1 + x2", type = "BR", deep = TRUE),
  list(formula = "yv ~ x1 + x2 | z1", type = "BC", deep = TRUE),
  list(formula = "yv ~ x1 + x2 | z1", type = "BR", deep = TRUE),
  list(formula = "yv ~ x1 + x2 | z1", type = "BR", link = "probit"),
  list(formula = "yc ~ x1 + x2", type = "BC", link_phi = "log"),
  list(formula = "yc ~ x1 + x2", type = "BR", link = "cloglog", link_phi = "sqrt"),
  list(formula = "yv ~ x1 + x2 | z1", type = "BC", weights = "w"),
  list(formula = "yv ~ x1 + x2 | z1", type = "BR", weights = "w"),
  list(formula = "yc ~ x1 + g", type = "BR"),
  # cloglog and loglog: R floors the second derivative of the inverse link at eps in the bias terms
  list(formula = "yc ~ x1 + x2", type = "BC", link = "cloglog"),
  list(formula = "yc ~ x1 + x2", type = "BC", link = "loglog"),
  list(formula = "yv ~ x1 + x2 | z1", type = "BR", link = "loglog"),
  list(formula = "ysm ~ x1 + x2", type = "BR", link = "log"),
  list(formula = "yc ~ x1 + x2", type = "BC", link = "cauchit")
)
out$fits <- lapply(cases, function(cs) {
  args <- list(formula = as.formula(cs$formula), data = d)
  # [[ ]], not $: cs$link would partially match link_phi
  if (!is.null(cs[["link"]])) args$link <- cs[["link"]]
  if (!is.null(cs[["link_phi"]])) args$link.phi <- cs[["link_phi"]]
  if (!is.null(cs[["type"]])) args$type <- cs[["type"]]
  if (!is.null(cs[["weights"]])) args$weights <- d[[cs[["weights"]]]]
  r <- run(do.call(betareg, args))
  res <- c(cs, list(warnings = r$warnings))
  if (!is.null(r$error)) c(res, list(error = r$error)) else c(res, fit_out(r$value, isTRUE(cs[["deep"]])))
})
## missing values and zero weights
d2 <- d; d2$yna <- d2$yc; d2$yna[c(2, 9)] <- NA; d2$x1na <- d2$x1; d2$x1na[5] <- NA
d2$wz <- d2$w; d2$wz[c(3, 4)] <- 0
assign("d2", d2, envir = globalenv())
out$data$d2 <- as.list(d2)
out$missing <- list(
  list(formula = "yna ~ x1na + x2", fit = fit_out(betareg(yna ~ x1na + x2, data = d2), FALSE)),
  list(formula = "yc ~ x1 + x2", weights = "wz", fit = fit_out(betareg(yc ~ x1 + x2, data = d2, weights = wz), TRUE)))
## errors
d3 <- d; d3$yneg <- d3$yc; d3$yneg[1] <- -0.1; d3$ybig <- d3$yc; d3$ybig[1] <- 1.2
assign("d3", d3, envir = globalenv())
out$data$d3 <- as.list(d3)
out$errors <- list(
  list(formula = "yneg ~ x1", error = run(betareg(yneg ~ x1, data = d3))$error),
  list(formula = "ybig ~ x1", error = run(betareg(ybig ~ x1, data = d3))$error),
  list(formula = "yc ~ x1", link = "identity", error = run(betareg(yc ~ x1, data = d, link = "identity"))$error),
  list(formula = "yc ~ x1", link_phi = "inverse", error = run(betareg(yc ~ x1, data = d, link.phi = "inverse"))$error),
  list(formula = "yc ~ x1", type = "XX", error = run(betareg(yc ~ x1, data = d, type = "XX"))$error))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE),
           file.path("/out", "betareg.json"))
