# step115-detail.R: the details of stats' step and MASS's stepAIC, public functions only (1.15.0). Settles: ties in
# the criterion (between candidates and with <none>), factor terms and interactions (which terms are offered: the
# marginality of drop1 / add1), missing values that change the rows, case weights (and weight 0), an offset, scale > 0,
# a model without intercept, aliased terms, a path with adds and drops in stepAIC, use.start, and how exact the glm
# candidates are (their deviance against a fresh glm fit of the same model).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2). The trace argument of
# step and stepAIC is left at its default 1 (the checker keeps its name out); the printed trace is captured.
library(jsonlite)
suppressPackageStartupMessages(library(MASS))
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
df_list <- function(d) if (is.null(d)) NULL else c(list(rownames = rownames(d)), lapply(as.list(d), function(v) if (is.factor(v)) as.character(v) else v))
labels_of <- function(fit) attr(terms(fit), "term.labels")
model_info <- function(fit) list(
  class = class(fit), terms = labels_of(fit), intercept = attr(terms(fit), "intercept"), coef = as.list(coef(fit)),
  extractAIC = extractAIC(fit), deviance = deviance(fit), df.residual = df.residual(fit), nobs = nobs(fit),
  anova = df_list(fit$anova))
traced <- function(e) run({ r <- NULL; txt <- capture.output(r <- e); list(fit = model_info(r), printed = txt) })
out <- list(R = R.version.string, arch = R.version$arch, MASS = as.character(packageVersion("MASS")))

set.seed(20261126)
n <- 50
d <- data.frame(x1 = round(rnorm(n), 3), x2 = round(rnorm(n), 3), x3 = round(rnorm(n), 3),
                f = factor(sample(c("a", "b", "c"), n, TRUE)), g = factor(sample(c("u", "v"), n, TRUE)))
d$y <- round(2 + 0.8 * d$x1 - 0.6 * d$x2 + 0.5 * d$x1 * (d$f == "b") + 0.4 * (d$g == "v") + rnorm(n), 3)
d$xa <- d$x3; d$xb <- -d$x3                   # two terms with the same fit
d$z0 <- 0                                     # a column of zeros: aliased with the intercept-free part (no fit)
d$x12 <- d$x1 + d$x2                          # aliased with x1 + x2
out$data <- df_list(d)

## ties
out$ties <- list(
  # two candidates with the same RSS: which is taken, and their order in the table (scope order ab and ba)
  add_ab = traced(step(lm(y ~ x1, data = d), scope = ~ x1 + xa + xb, direction = "forward")),
  add_ba = traced(step(lm(y ~ x1, data = d), scope = ~ x1 + xb + xa, direction = "forward")),
  add_ab_k0 = traced(step(lm(y ~ x1, data = d), scope = ~ x1 + xa + xb, direction = "forward", k = 0)),
  drop_ab = traced(step(lm(y ~ x1 + xa + xb, data = d), direction = "backward")),
  rss_ab = c(deviance(lm(y ~ x1 + xa, data = d)), deviance(lm(y ~ x1 + xb, data = d))),
  # a candidate with the same criterion as <none>: an aliased term (Df 0)
  add_z0 = traced(step(lm(y ~ x1, data = d), scope = ~ x1 + z0, direction = "forward")),
  drop_z0 = traced(step(lm(y ~ x1 + z0, data = d), direction = "backward")),
  add_x12 = traced(step(lm(y ~ x1 + x2, data = d), scope = ~ x1 + x2 + x12, direction = "forward")),
  drop_x12 = traced(step(lm(y ~ x1 + x2 + x12, data = d), direction = "backward")),
  drop1_x12 = run(df_list(drop1(lm(y ~ x1 + x2 + x12, data = d)))),
  stepAIC_add_ab = traced(stepAIC(lm(y ~ x1, data = d), scope = ~ x1 + xa + xb, direction = "forward")),
  stepAIC_drop_z0 = traced(stepAIC(lm(y ~ x1 + z0, data = d), direction = "backward")))

## factor terms and interactions
fi <- lm(y ~ x1 * f + x2 + g, data = d)
out$factors <- list(
  drop1 = df_list(drop1(fi)), drop1_all = run(df_list(drop1(fi, scope = ~ x1 + f + x2 + g + x1:f))),
  add1 = df_list(add1(lm(y ~ x1, data = d), scope = ~ x1 * f + x2 + g)),
  backward = traced(step(fi, direction = "backward")),
  both_null = traced(step(lm(y ~ 1, data = d), scope = list(lower = ~ 1, upper = ~ x1 * f + x2 + g), direction = "both")),
  forward = traced(step(lm(y ~ 1, data = d), scope = ~ x1 * f + x2 + g, direction = "forward")),
  stepAIC_both_null = traced(stepAIC(lm(y ~ 1, data = d), scope = list(lower = ~ 1, upper = ~ x1 * f + x2 + g))),
  three_way = traced(step(lm(y ~ x1 * f * g, data = d), direction = "backward")),
  lower_f = traced(step(fi, scope = list(lower = ~ f, upper = ~ x1 * f + x2 + g))),
  poly = traced(step(lm(y ~ x1 + I(x1^2) + x2, data = d))),
  ordered_terms = labels_of(lm(y ~ g + x2 + f * x1, data = d)))

## missing values that change the rows
dn <- d; dn$x3[c(3, 17, 40)] <- NA
out$missing <- list(
  backward = traced(step(lm(y ~ x1 + x2 + x3, data = dn))),
  forward = traced(step(lm(y ~ x1, data = dn), scope = ~ x1 + x2 + x3, direction = "forward")),
  drop1 = run(df_list(drop1(lm(y ~ x1 + x2 + x3, data = dn)))),
  add1 = run(df_list(add1(lm(y ~ x1, data = dn), scope = ~ x1 + x2 + x3))),
  stepAIC = traced(stepAIC(lm(y ~ x1 + x2 + x3, data = dn))),
  complete = traced(step(lm(y ~ x1 + x2 + x3, data = dn[complete.cases(dn), ]))),
  y_missing = { dy <- d; dy$y[c(5, 9)] <- NA; traced(step(lm(y ~ x1 + x2 + x3, data = dy))) })

## case weights, weight 0
d$w <- round(runif(n, 0.2, 3), 2); d$w0 <- d$w; d$w0[c(2, 11, 30)] <- 0
out$weights <- list(
  extract = extractAIC(lm(y ~ x1 + x2 + x3, data = d, weights = w)),
  extract_w0 = extractAIC(lm(y ~ x1 + x2 + x3, data = d, weights = w0)),
  nobs_w0 = nobs(lm(y ~ x1 + x2 + x3, data = d, weights = w0)),
  rss_w0 = deviance(lm(y ~ x1 + x2 + x3, data = d, weights = w0)),
  both = traced(step(lm(y ~ x1 + x2 + x3 + g, data = d, weights = w))),
  both_w0 = traced(step(lm(y ~ x1 + x2 + x3 + g, data = d, weights = w0))),
  drop1_w0 = df_list(drop1(lm(y ~ x1 + x2 + x3 + g, data = d, weights = w0))))

## glm: offset, binomial with trials, how exact the candidates are
d$t <- sample(5:15, n, TRUE); d$s <- rbinom(n, d$t, plogis(-0.5 + 0.7 * d$x1))
d$e <- round(runif(n, 1, 4), 2); d$cnt <- rpois(n, d$e * exp(0.2 + 0.5 * d$x2))
gp <- glm(cnt ~ x1 + x2 + x3 + f + offset(log(e)), family = poisson, data = d)
gb <- glm(cbind(s, t - s) ~ x1 + x2 + x3 + g, family = binomial, data = d)
gw <- glm(s / t ~ x1 + x2 + x3 + g, family = binomial, weights = t, data = d)
out$glm <- list(
  offset = traced(step(gp)), offset_arg = traced(step(glm(cnt ~ x1 + x2 + x3 + f, offset = log(e), family = poisson, data = d))),
  trials = traced(step(gb)), proportion_weights = traced(step(gw)),
  drop1_offset = df_list(drop1(gp)),
  fresh_offset = sapply(list(cnt ~ x2 + x3 + f + offset(log(e)), cnt ~ x1 + x3 + f + offset(log(e)),
                             cnt ~ x1 + x2 + f + offset(log(e)), cnt ~ x1 + x2 + x3 + offset(log(e))),
                        function(fo) { m <- glm(fo, family = poisson, data = d); c(m$deviance, m$aic, m$iter) }),
  add1_binomial = df_list(add1(glm(cbind(s, t - s) ~ 1, family = binomial, data = d), scope = ~ x1 + x2 + x3 + g)),
  fresh_binomial = sapply(list(cbind(s, t - s) ~ x1, cbind(s, t - s) ~ x2, cbind(s, t - s) ~ x3, cbind(s, t - s) ~ g),
                          function(fo) { m <- glm(fo, family = binomial, data = d); c(m$deviance, m$aic, m$iter) }),
  stepAIC_offset = traced(stepAIC(gp)),
  stepAIC_offset_nostart = traced(stepAIC(gp, use.start = TRUE)))

## scale > 0 (lm: Cp), a model without intercept
out$other <- list(
  scale = traced(step(lm(y ~ x1 + x2 + x3 + g, data = d), scale = 1.1)),
  scale_extract = extractAIC(lm(y ~ x1 + x2 + x3 + g, data = d), scale = 1.1),
  stepAIC_scale = traced(stepAIC(lm(y ~ x1 + x2 + x3 + g, data = d), scale = 1.1)),
  no_intercept = traced(step(lm(y ~ x1 + x2 + x3 - 1, data = d))),
  no_intercept_factor = traced(step(lm(y ~ f + x1 + x3 - 1, data = d))),
  to_empty = traced(step(lm(y ~ x3 - 1, data = d), scope = list(lower = ~ 0, upper = ~ x3 + x2))),
  intercept_in_scope = traced(step(lm(y ~ x1, data = d), scope = list(lower = ~ 0, upper = ~ x1 + x2))),
  glm_no_intercept = traced(step(glm(cnt ~ x1 + x2 + x3 - 1, family = poisson, data = d))),
  # stepAIC with adds and drops on one path (Df signs)
  mixed_step = traced(step(lm(y ~ x3 + g, data = d), scope = list(lower = ~ 1, upper = ~ x1 + x2 + x3 + g))),
  mixed_stepAIC = traced(stepAIC(lm(y ~ x3 + g, data = d), scope = list(lower = ~ 1, upper = ~ x1 + x2 + x3 + g))),
  # a scope that does not contain the start model, and a lower scope not contained in it
  scope_bad_upper = traced(step(lm(y ~ x1 + x2 + x3, data = d), scope = list(upper = ~ x1 + x2))),
  scope_bad_lower = traced(step(lm(y ~ x1 + x2, data = d), scope = list(lower = ~ x3, upper = ~ x1 + x2 + x3))),
  saturated = traced(step(lm(y ~ x1 + x2, data = d[1:3, ]))),
  one_row_more = traced(step(lm(y ~ x1 + x2 + x3, data = d[1:5, ]))))

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
