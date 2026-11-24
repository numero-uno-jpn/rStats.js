# issue: 565
# oracle-platform: amd64
# Public outputs of stats' step, drop1, add1 and extractAIC and MASS's stepAIC for test/fixtures/step.json (1.15.0).
# The behaviour and the choices are in oracle/step-behaviour.md. Public calls only.
# For each search case: the call (start formula, family, weights, offset, scope, direction, k, scale, steps, step or
# stepAIC), and R's result: the selected model's terms, coefficients, extractAIC, the path table ($anova), the printed
# trace (for the order and labels of the rows of each table) and, for each model visited (from keep), its terms and
# criterion. For the table cases: drop1 / add1 with their arguments. The trace argument of step is left at its default
# 1 and the printed output captured.
library(jsonlite)
suppressPackageStartupMessages(library(MASS))
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  c(value, list(warnings = warns))
}
df_list <- function(d) if (is.null(d)) NULL else c(list(rownames = rownames(d)), lapply(as.list(d), function(v) if (is.factor(v)) as.character(v) else v))
labels_of <- function(fit) attr(terms(fit), "term.labels")

## data: d (60 rows) as in experiments/step115, e (50 rows) as in experiments/step115-detail
set.seed(20261125)
n <- 60
d <- data.frame(x1 = round(rnorm(n), 3), x2 = round(rnorm(n), 3), x3 = round(rnorm(n), 3),
                x4 = round(rnorm(n), 3), x5 = round(rnorm(n), 3), f = sample(c("a", "b", "c"), n, TRUE),
                stringsAsFactors = FALSE)
d$y <- round(1 + 0.9 * d$x1 - 0.5 * d$x2 + 0.25 * d$x3 + 0.4 * (d$f == "c") + rnorm(n), 3)
d$yb <- rbinom(n, 1, plogis(-0.3 + 1.1 * d$x1 - 0.7 * d$x2 + 0.2 * d$x4))
d$yc <- rpois(n, exp(0.5 + 0.4 * d$x1 + 0.3 * d$x3))
d$ygam <- round(rgamma(n, shape = 4, rate = 4 / exp(0.3 + 0.3 * d$x1 - 0.2 * d$x2)), 4)

set.seed(20261126)
m <- 50
e <- data.frame(x1 = round(rnorm(m), 3), x2 = round(rnorm(m), 3), x3 = round(rnorm(m), 3),
                f = sample(c("a", "b", "c"), m, TRUE), g = sample(c("u", "v"), m, TRUE), stringsAsFactors = FALSE)
e$y <- round(2 + 0.8 * e$x1 - 0.6 * e$x2 + 0.5 * e$x1 * (e$f == "b") + 0.4 * (e$g == "v") + rnorm(m), 3)
e$xa <- e$x3; e$xb <- -e$x3; e$z0 <- 0; e$x12 <- e$x1 + e$x2; e$z1 <- 0
e$w <- round(runif(m, 0.2, 3), 2); e$w0 <- e$w; e$w0[c(2, 11, 30)] <- 0
e$t <- sample(5:15, m, TRUE); e$s <- rbinom(m, e$t, plogis(-0.5 + 0.7 * e$x1)); e$fl <- e$t - e$s; e$p <- e$s / e$t
e$ex <- round(runif(m, 1, 4), 2); e$loge <- log(e$ex); e$cnt <- rpois(m, e$ex * exp(0.2 + 0.5 * e$x2))
e$x3n <- e$x3; e$x3n[c(3, 17, 40)] <- NA
e$ys <- as.integer(e$x1 > 0.2); e$ys[c(1, 2)] <- 1L - e$ys[c(1, 2)]
# the second pass over the edge cases: missing weights and offsets, a constant column, a string response
e$wna <- e$w; e$wna[c(5, 21)] <- NA
e$lognA <- e$loge; e$lognA[c(8, 44)] <- NA
e$k1 <- 1
e$ychr <- ifelse(e$ys == 1, "yes", "no")

## the searches
# the data of the case goes to the global environment (step refits by re-evaluating the call)
fit_of <- function(cs) {
  data <- get(cs$set)
  data$.w <- if (is.null(cs$weights)) 1 else data[[cs$weights]]
  data$.o <- if (is.null(cs$offset)) 0 else data[[cs$offset]]
  # a string response as R's factor (rStats.js reads strings as a factor; R's glm refuses a character response)
  if (!is.null(cs$factor)) data[[cs$factor]] <- factor(data[[cs$factor]])
  assign("cur", data, envir = globalenv())
  fo <- as.formula(cs$start, env = globalenv())
  if (is.null(cs$family)) {
    if (!is.null(cs$contrasts)) return(eval(bquote(lm(.(fo), data = cur, weights = .w, contrasts = list(f = .(cs$contrasts)))), globalenv()))
    return(eval(bquote(lm(.(fo), data = cur, weights = .w)), globalenv()))
  }
  fam <- cs$family
  if (is.null(cs$offset)) eval(bquote(glm(.(fo), family = .(as.name(fam)), data = cur, weights = .w)), globalenv())
  else eval(bquote(glm(.(fo), family = .(as.name(fam)), data = cur, weights = .w, offset = .o)), globalenv())
}
scope_of <- function(cs) {
  if (is.null(cs$lower) && is.null(cs$upper)) return(NULL)
  if (is.null(cs$lower)) return(as.formula(cs$upper))
  list(lower = as.formula(cs$lower), upper = as.formula(if (is.null(cs$upper)) cs$start else cs$upper))
}
search <- function(cs) {
  start <- fit_of(cs)
  sc <- scope_of(cs)
  dir <- if (is.null(cs$direction)) "both" else cs$direction
  k <- if (is.null(cs$k)) 2 else if (identical(cs$k, "log")) log(nobs(start)) else cs$k
  scale <- if (is.null(cs$scale)) 0 else cs$scale
  visited <- function(model, aic) list(terms = labels_of(model), aic = aic, extractAIC = extractAIC(model, k = k, scale = scale),
                                       nobs = nobs(model), dfResidual = df.residual(model), deviance = deviance(model))
  steps <- if (is.null(cs$steps)) 1000 else cs$steps
  fn <- if (identical(cs$fn, "stepAIC")) stepAIC else step
  r <- NULL
  txt <- capture.output(r <- if (is.null(sc)) fn(start, direction = dir, k = k, scale = scale, steps = steps, keep = visited)
                         else fn(start, scope = sc, direction = dir, k = k, scale = scale, steps = steps, keep = visited))
  list(terms = labels_of(r), coefNames = names(coef(r)), coefficients = unname(coef(r)), extractAIC = extractAIC(r, k = k, scale = scale),
       k = k, anova = df_list(r$anova), keep = lapply(seq_len(ncol(r$keep)), function(j) r$keep[, j]), printed = txt)
}
cases <- list(
  # lm on d
  list(name = "lm_backward", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", direction = "backward"),
  list(name = "lm_forward", set = "d", start = "y ~ 1", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", direction = "forward"),
  list(name = "lm_both", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f"),
  list(name = "lm_both_null", set = "d", start = "y ~ 1", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f"),
  list(name = "lm_bic", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", k = "log"),
  list(name = "lm_k0", set = "d", start = "y ~ x1", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", k = 0),
  list(name = "lm_k10", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", k = 10),
  list(name = "lm_default", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f"),
  list(name = "lm_upper_only", set = "d", start = "y ~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f"),
  list(name = "lm_forward_no_scope", set = "d", start = "y ~ x1", direction = "forward"),
  list(name = "lm_lower_x1", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", lower = "~ x1 + x2", upper = "~ x1 + x2 + x3 + x4 + x5 + f", direction = "backward"),
  list(name = "lm_steps1", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", direction = "backward", steps = 1),
  list(name = "lm_steps0", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", direction = "backward", steps = 0),
  list(name = "lm_stepAIC_both", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", fn = "stepAIC"),
  list(name = "lm_stepAIC_forward", set = "d", start = "y ~ 1", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", direction = "forward", fn = "stepAIC"),
  # lm on e: factors and interactions, ties, aliased terms, weights, scale, no intercept, missing values
  list(name = "lm_interaction", set = "e", start = "y ~ x1 * f + x2 + g", direction = "backward"),
  list(name = "lm_interaction_both", set = "e", start = "y ~ 1", lower = "~ 1", upper = "~ x1 * f + x2 + g"),
  list(name = "lm_interaction_forward_k0", set = "e", start = "y ~ 1", upper = "~ x1 * f + x2 + g", direction = "forward", k = 0),
  list(name = "lm_three_way", set = "e", start = "y ~ x1 * f * g", direction = "backward"),
  list(name = "lm_lower_f", set = "e", start = "y ~ x1 * f + x2 + g", lower = "~ f", upper = "~ x1 * f + x2 + g"),
  list(name = "lm_marginal_upper", set = "e", start = "y ~ 1", upper = "~ x1 + x1:f", direction = "forward", k = 0),
  list(name = "lm_marginal_lower", set = "e", start = "y ~ x1 + x1:f", direction = "backward", k = 20),
  list(name = "lm_tie_ab", set = "e", start = "y ~ x1", upper = "~ x1 + xa + xb", direction = "forward"),
  list(name = "lm_tie_ba", set = "e", start = "y ~ x1", upper = "~ x1 + xb + xa", direction = "forward"),
  list(name = "lm_tie_drop", set = "e", start = "y ~ x1 + xa + xb", direction = "backward"),
  list(name = "lm_alias_z0", set = "e", start = "y ~ x1 + z0", direction = "backward"),
  list(name = "lm_alias_two", set = "e", start = "y ~ z1 + x1 + x2 + x12 + z0 + x3"),
  list(name = "lm_alias_add", set = "e", start = "y ~ x1 + x2", upper = "~ x1 + x2 + x12 + z0 + g", direction = "forward"),
  list(name = "lm_weights", set = "e", start = "y ~ x1 + x2 + x3 + g", weights = "w"),
  list(name = "lm_weights0", set = "e", start = "y ~ x1 + x2 + x3 + g", weights = "w0"),
  list(name = "lm_weights0_stay", set = "e", start = "y ~ x1 + x2", weights = "w0", direction = "backward"),
  list(name = "lm_weights0_forward", set = "e", start = "y ~ 1", upper = "~ x1 + x2 + x3 + g", weights = "w0", direction = "forward"),
  list(name = "lm_scale", set = "e", start = "y ~ x1 + x2 + x3 + g", scale = 1.1),
  list(name = "lm_scale_both", set = "e", start = "y ~ x3", lower = "~ 1", upper = "~ x1 + x2 + x3 + g", scale = 1.1),
  list(name = "lm_no_intercept", set = "e", start = "y ~ x1 + x2 + x3 - 1"),
  list(name = "lm_no_intercept_factor", set = "e", start = "y ~ f + x1 + x3 - 1"),
  list(name = "lm_intercept_lower0", set = "e", start = "y ~ x1", lower = "~ 0", upper = "~ x1 + x2"),
  list(name = "lm_mixed", set = "e", start = "y ~ x3 + g", lower = "~ 1", upper = "~ x1 + x2 + x3 + g"),
  list(name = "lm_mixed_stepAIC", set = "e", start = "y ~ x3 + g", lower = "~ 1", upper = "~ x1 + x2 + x3 + g", fn = "stepAIC"),
  list(name = "lm_missing_backward", set = "e", start = "y ~ x1 + x2 + x3n", direction = "backward"),
  list(name = "lm_missing_forward", set = "e", start = "y ~ x1", upper = "~ x1 + x2 + x3n", direction = "forward"),
  list(name = "lm_missing_forward_k0", set = "e", start = "y ~ x1", upper = "~ x1 + x2 + x3n", direction = "forward", k = 0),
  list(name = "lm_missing_both", set = "e", start = "y ~ x1", lower = "~ 1", upper = "~ x1 + x2 + x3n"),
  list(name = "lm_scope_bad_upper", set = "e", start = "y ~ x1 + x2 + x3", upper = "~ x1 + x2", lower = "~ 1"),
  list(name = "lm_scope_bad_lower", set = "e", start = "y ~ x1 + x2", lower = "~ x3", upper = "~ x1 + x2 + x3"),
  list(name = "lm_perfect", set = "e", start = "x12 ~ x1 + x2 + x3"),
  # glm
  list(name = "binomial_both", set = "d", start = "yb ~ x1 + x2 + x3 + x4 + x5 + f", family = "binomial", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f"),
  list(name = "binomial_forward", set = "d", start = "yb ~ 1", family = "binomial", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", direction = "forward"),
  list(name = "binomial_bic", set = "d", start = "yb ~ x1 + x2 + x3 + x4 + x5 + f", family = "binomial", k = "log"),
  list(name = "binomial_stepAIC", set = "d", start = "yb ~ 1", family = "binomial", lower = "~ 1", upper = "~ x1 + x2 + x3 + x4 + x5 + f", fn = "stepAIC"),
  list(name = "poisson_both", set = "d", start = "yc ~ x1 + x2 + x3 + x4 + x5 + f", family = "poisson"),
  list(name = "poisson_forward", set = "d", start = "yc ~ 1", family = "poisson", upper = "~ x1 + x2 + x3 + x4 + x5 + f", direction = "forward"),
  list(name = "gaussian_glm", set = "d", start = "y ~ x1 + x2 + x3 + x4", family = "gaussian"),
  list(name = "gamma_glm", set = "d", start = "ygam ~ x1 + x2 + x3 + f", family = "Gamma"),
  list(name = "quasipoisson", set = "d", start = "yc ~ x1 + x2 + x3", family = "quasipoisson"),
  list(name = "poisson_offset", set = "e", start = "cnt ~ x1 + x2 + x3 + f", family = "poisson", offset = "loge"),
  list(name = "binomial_cbind", set = "e", start = "cbind(s, fl) ~ x1 + x2 + x3 + g", family = "binomial"),
  list(name = "binomial_proportion", set = "e", start = "p ~ x1 + x2 + x3 + g", family = "binomial", weights = "t"),
  list(name = "poisson_weights0", set = "e", start = "cnt ~ x1 + x2 + x3 + g", family = "poisson", weights = "w0"),
  list(name = "binomial_separation", set = "e", start = "ys ~ x1 + xa + x2", family = "binomial"),
  list(name = "poisson_interaction", set = "e", start = "cnt ~ x2 * g + x1", family = "poisson", offset = "loge"),
  list(name = "poisson_missing_forward", set = "e", start = "cnt ~ x1", upper = "~ x1 + x2 + x3n", family = "poisson", direction = "forward", k = 0),
  # the second pass over the edge cases
  list(name = "lm_k_large", set = "e", start = "y ~ x1 + x2 + x3 + g", k = 1e6),
  list(name = "lm_k_negative", set = "e", start = "y ~ 1", upper = "~ x1 + x2 + x3 + g", direction = "forward", k = -1),
  list(name = "lm_steps_fraction", set = "d", start = "y ~ x1 + x2 + x3 + x4 + x5 + f", direction = "backward", steps = 2.5),
  list(name = "poisson_missing_both", set = "e", start = "cnt ~ x1", lower = "~ 1", upper = "~ x1 + x2 + x3n", family = "poisson"),
  list(name = "lm_weights_missing", set = "e", start = "y ~ x1 + x2 + x3 + g", weights = "wna"),
  list(name = "poisson_offset_missing", set = "e", start = "cnt ~ x1 + x2 + x3 + g", family = "poisson", offset = "lognA"),
  list(name = "lm_constant_column", set = "e", start = "y ~ x1 + k1 + x2", direction = "backward"),
  list(name = "lm_no_intercept_interaction", set = "e", start = "y ~ f:x1 + g - 1", direction = "backward"),
  list(name = "binomial_string_response", set = "e", start = "ychr ~ x1 + x2 + x3", family = "binomial", factor = "ychr"),
  list(name = "lm_four_rows", set = "e4", start = "y ~ x1 + x2"),
  list(name = "lm_contr_sum", set = "e", start = "y ~ f * x1 + x2", contrasts = "contr.sum"),
  list(name = "gaussian_weights0", set = "e", start = "y ~ x1 + x2 + x3 + g", family = "gaussian", weights = "w0"),
  list(name = "binomial_bic_forward", set = "e", start = "ys ~ 1", upper = "~ x1 + x2 + x3 + g + f", family = "binomial", k = "log"),
  list(name = "lm_scope_unknown", set = "e", start = "y ~ x1", upper = "~ x1 + zz"))
e4 <- e[1:4, ]
out <- list(R = R.version.string, MASS = as.character(packageVersion("MASS")), data = list(d = d, e = e, e4 = e4))
out$search <- lapply(cases, function(cs) c(cs, run(search(cs))))

## the tables
tab <- function(e1) run(list(table = df_list(e1)))
dlm <- lm(y ~ x1 + x2 + x3 + x4 + x5 + f, data = d); dnull <- lm(y ~ 1, data = d)
ei <- lm(y ~ x1 * f + x2 + g, data = e)
ew0 <- lm(y ~ x1 + x2 + x3 + g, data = e, weights = w0)
eNA <- lm(y ~ x1, data = e)
gb <- glm(yb ~ x1 + x2 + x3 + x4 + x5 + f, family = binomial, data = d); gbnull <- glm(yb ~ 1, family = binomial, data = d)
gg <- glm(y ~ x1 + x2 + x3 + x4, family = gaussian, data = d)
ggam <- glm(ygam ~ x1 + x2 + x3 + f, family = Gamma, data = d)
gp0 <- glm(cnt ~ x1 + x2 + x3 + g, family = poisson, data = e, weights = w0)
out$tables <- list(
  drop1_lm = tab(drop1(dlm)), drop1_lm_bic = tab(drop1(dlm, k = log(60))), drop1_lm_F = tab(drop1(dlm, test = "F")),
  drop1_lm_scale = tab(drop1(dlm, scale = 1.2)), drop1_lm_all = tab(drop1(ei, scope = ~ x1 + f + x2 + g + x1:f)),
  drop1_lm_marginal = tab(drop1(ei)), drop1_lm_w0 = tab(drop1(ew0)), drop1_lm_w0_F = tab(drop1(ew0, test = "F")),
  add1_lm = tab(add1(dnull, scope = ~ x1 + x2 + x3 + x4 + x5 + f)), add1_lm_F = tab(add1(dnull, scope = ~ x1 + x2 + x3 + x4 + x5 + f, test = "F")),
  add1_lm_marginal = tab(add1(lm(y ~ x1, data = e), scope = ~ x1 * f + x2 + g)),
  add1_lm_missing = tab(add1(eNA, scope = ~ x1 + x2 + x3n)),
  drop1_binomial = tab(drop1(gb)), drop1_binomial_LRT = tab(drop1(gb, test = "LRT")), drop1_binomial_Chisq = tab(drop1(gb, test = "Chisq")),
  add1_binomial_LRT = tab(add1(gbnull, scope = ~ x1 + x2 + x3 + x4 + x5 + f, test = "LRT")),
  drop1_gaussian_LRT = tab(drop1(gg, test = "LRT")), drop1_gaussian_F = tab(drop1(gg, test = "F")),
  drop1_gamma_LRT = tab(drop1(ggam, test = "LRT")), drop1_gamma_F = tab(drop1(ggam, test = "F")),
  add1_gamma_F = tab(add1(glm(ygam ~ x1, family = Gamma, data = d), scope = ~ x1 + x2 + x3 + f, test = "F")),
  drop1_poisson_w0 = tab(drop1(gp0)),
  extract = list(lm = extractAIC(dlm), lm_bic = extractAIC(dlm, k = log(60)), lm_scale = extractAIC(dlm, scale = 1.2),
                 lm_w0 = extractAIC(ew0), binomial = extractAIC(gb), gaussian = extractAIC(gg), gamma = extractAIC(ggam),
                 poisson_w0 = extractAIC(gp0), binomial_scale = extractAIC(gb, scale = 2)))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE),
           file.path("/out", "step.json"))
