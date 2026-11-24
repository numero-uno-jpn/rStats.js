# step115.R: stats' step and MASS's stepAIC on small data, public functions only (1.15.0). Settles: the criterion
# (extractAIC for lm and glm, k = 2 and k = log(n)), the three directions with a lower and an upper scope, the path
# table ($anova) of both functions, the trace output (the candidates of each step), keep and steps, the drop1 / add1
# tables, and how step and stepAIC differ.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
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
# the parts of a selected model, its path table and its kept summaries
model_info <- function(fit) list(
  class = class(fit), terms = labels_of(fit), coef = as.list(coef(fit)), extractAIC = extractAIC(fit),
  AIC = AIC(fit), deviance = deviance(fit), df.residual = df.residual(fit), nobs = nobs(fit),
  anova = df_list(fit$anova), anova_heading = attr(fit$anova, "heading"), keep = fit$keep)
# a step call with its printed trace (the trace argument is left at its default 1 or given by position: the checker keeps
# its name out)
traced <- function(e) { r <- NULL; txt <- capture.output(r <- e); list(fit = model_info(r), printed = txt) }
out <- list(R = R.version.string, arch = R.version$arch, MASS = as.character(packageVersion("MASS")))

## data: 60 rows, five numeric predictors (x4 and x5 noise), one 3-level factor
set.seed(20261125)
n <- 60
dat <- data.frame(x1 = round(rnorm(n), 3), x2 = round(rnorm(n), 3), x3 = round(rnorm(n), 3),
                  x4 = round(rnorm(n), 3), x5 = round(rnorm(n), 3), f = factor(sample(c("a", "b", "c"), n, TRUE)))
dat$y <- round(1 + 0.9 * dat$x1 - 0.5 * dat$x2 + 0.25 * dat$x3 + 0.4 * (dat$f == "c") + rnorm(n), 3)
dat$yb <- rbinom(n, 1, plogis(-0.3 + 1.1 * dat$x1 - 0.7 * dat$x2 + 0.2 * dat$x4))
dat$yc <- rpois(n, exp(0.5 + 0.4 * dat$x1 + 0.3 * dat$x3))
out$data <- df_list(dat)

full <- lm(y ~ x1 + x2 + x3 + x4 + x5 + f, data = dat)
null <- lm(y ~ 1, data = dat)
sc <- list(lower = formula(null), upper = formula(full))

## extractAIC against its documented formula (lm: n log(RSS/n) + k edf; glm: AIC + (k - 2) edf)
out$extract <- list(
  lm = list(k2 = extractAIC(full), klog = extractAIC(full, k = log(n)), rss = deviance(full), AIC = AIC(full)),
  lm_scale = run(extractAIC(full, scale = 1.3)))

## lm, the three directions as ReactiveStat calls them
out$lm <- list(
  backward = traced(step(full, scope = sc, direction = "backward")),
  forward = traced(step(null, scope = sc, direction = "forward")),
  both = traced(step(full, scope = sc, direction = "both")),
  both_from_null = traced(step(null, scope = sc, direction = "both")),
  both_bic = traced(step(full, scope = sc, direction = "both", k = log(n))),
  default_scope = traced(step(full)),
  forward_no_scope = run(traced(step(null, direction = "forward"))),
  upper_only = traced(step(null, scope = formula(full))),
  lower_x1 = traced(step(full, scope = list(lower = ~ x1, upper = formula(full)), direction = "backward")),
  trace2 = traced(step(full, sc, 0, "both", 2)),
  steps1 = traced(step(full, scope = sc, direction = "backward", steps = 1)),
  steps0 = traced(step(full, scope = sc, direction = "backward", steps = 0)),
  keep = traced(step(full, scope = sc, direction = "both",
                     keep = function(model, aic) list(terms = labels_of(model), aic = aic, rss = deviance(model)))))

## MASS::stepAIC on the same calls
out$lm_stepAIC <- list(
  backward = traced(stepAIC(full, scope = sc, direction = "backward")),
  forward = traced(stepAIC(null, scope = sc, direction = "forward")),
  both = traced(stepAIC(full, scope = sc, direction = "both")),
  both_bic = traced(stepAIC(full, scope = sc, direction = "both", k = log(n))),
  default_scope = traced(stepAIC(full)),
  steps1 = traced(stepAIC(full, scope = sc, direction = "backward", steps = 1)),
  steps0 = traced(stepAIC(full, scope = sc, direction = "backward", steps = 0)),
  keep = traced(stepAIC(full, scope = sc, direction = "both",
                        keep = function(model, aic) list(terms = labels_of(model), aic = aic, rss = deviance(model)))))

## the candidate tables at the start: drop1 / add1 and dropterm / addterm, k = 2 and log(n)
out$tables <- list(
  drop1 = df_list(drop1(full)), drop1_bic = df_list(drop1(full, k = log(n))),
  drop1_F = df_list(drop1(full, test = "F")),
  add1 = df_list(add1(null, scope = formula(full))), add1_F = df_list(add1(null, scope = formula(full), test = "F")),
  dropterm = df_list(dropterm(full)), addterm = df_list(addterm(null, scope = formula(full))))

## glm: binomial and poisson
fb <- glm(yb ~ x1 + x2 + x3 + x4 + x5 + f, family = binomial, data = dat)
nb <- glm(yb ~ 1, family = binomial, data = dat)
fp <- glm(yc ~ x1 + x2 + x3 + x4 + x5 + f, family = poisson, data = dat)
np <- glm(yc ~ 1, family = poisson, data = dat)
scb <- list(lower = formula(nb), upper = formula(fb)); scp <- list(lower = formula(np), upper = formula(fp))
out$glm <- list(
  extract = list(binomial = extractAIC(fb), binomial_bic = extractAIC(fb, k = log(n)), binomial_AIC = AIC(fb),
                 poisson = extractAIC(fp), poisson_AIC = AIC(fp)),
  binomial_both = traced(step(fb, scope = scb, direction = "both")),
  binomial_forward = traced(step(nb, scope = scb, direction = "forward")),
  binomial_bic = traced(step(fb, scope = scb, direction = "both", k = log(n))),
  binomial_stepAIC = traced(stepAIC(fb, scope = scb, direction = "both")),
  poisson_both = traced(step(fp, scope = scp, direction = "both")),
  poisson_backward = traced(step(fp, direction = "backward")),
  poisson_stepAIC = traced(stepAIC(fp, direction = "backward")),
  drop1_binomial = df_list(drop1(fb)), drop1_binomial_LRT = df_list(drop1(fb, test = "LRT")),
  add1_poisson = df_list(add1(np, scope = formula(fp))), dropterm_binomial = df_list(dropterm(fb)))

## quasi families and gaussian glm (extractAIC with no AIC)
fq <- glm(yc ~ x1 + x2 + x3, family = quasipoisson, data = dat)
fg <- glm(y ~ x1 + x2 + x3 + x4, family = gaussian, data = dat)
out$glm_other <- list(
  quasipoisson = run(traced(step(fq))),
  gaussian = traced(step(fg)), gaussian_extract = extractAIC(fg),
  lm_same = traced(step(lm(y ~ x1 + x2 + x3 + x4, data = dat))))

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
