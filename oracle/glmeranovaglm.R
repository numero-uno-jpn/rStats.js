source("/oracle/_mixedexact.R")

# anova() of a glmer fit and a glm fit with the same fixed effects (fixture glmerAnovaGlm; oracle/glmer-behaviour.md
# "glmerAnova (stage 3)" and G15, decided after the fixture glmerAnova was made). Each case: the glmer fit as in
# oracle/glmer.R (formula, data with dataTypes, family, link, optional weights (an array), nAGQ "1"), the glm fit
# (glmFormula, glmLink: R's glm(glmFormula, data, family(link = glmLink), weights)) and, for rStats.js's glm, its
# design: glmX (the rows of the model matrix without the intercept column), glmY (the response: a vector, or
# [successes, failures] per row for cbind()); names: c(glmer, glm) as given to anova (model.names).
# expected: R's anova(glmer fit, glm fit, model.names = names): names, npar, AIC, BIC, logLik, deviance (-2*log(L)),
# Chisq, Df, pValue in R's order, messages and warnings.
# reference: the same from the exact glmer optimum (oracle/_mixedexact.R's glmer_exact) and glm's converged fit (IRLS
# to epsilon 1e-15, then logLik.glm: rank (+1 for a dispersion) minus aic / 2); the rows ordered by npar, Chisq and
# pValue NA unless the glm fit is nested in the glmer fit by rStats.js's rule (same family, link and offset; here the
# fixed effects are the same), nested one boolean per row.

# both fits on the same data object (R's anova requires it), as `dat` with the prior weights in its column .w
glm_fit <- function(a, env = fit_env(a)) {
  eval(substitute(glm(F, family = FAM, data = dat, weights = W, control = glm.control(epsilon = 1e-15, maxit = 1000)),
                  list(F = as.formula(a$glmFormula), FAM = get(a$family, mode = "function")(link = a$glmLink),
                       W = if (is.null(a$weights)) NULL else quote(.w))), env)
}
fit_env <- function(a) list2env(list(dat = lme4_args(a)$dat))
glmer_fit <- function(a, env) {
  eval(substitute(glmer(F, family = FAM, data = dat, weights = W, nAGQ = 1L),
                  list(F = as.formula(a$formula), FAM = get(a$family, mode = "function")(link = a$link),
                       W = if (is.null(a$weights)) NULL else quote(.w))), env)
}

expected <- function(a) {
  ws <- character(0); ms <- character(0)
  r <- withCallingHandlers({
    env <- fit_env(a)
    fit <- suppressMessages(suppressWarnings(glmer_fit(a, env)))
    g <- glm_fit(a, env)
    anova(fit, g, model.names = unlist(a$names))
  }, warning = function(cnd) { ws <<- c(ws, conditionMessage(cnd)); invokeRestart("muffleWarning") },
     message = function(cnd) { ms <<- c(ms, sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  list(names = I(rownames(r)), npar = I(num2str(r$npar)), AIC = I(num2str(r$AIC)), BIC = I(num2str(r$BIC)),
       logLik = I(num2str(r$logLik)), deviance = I(num2str(r[["-2*log(L)"]])), Chisq = I(num2str(r$Chisq)),
       Df = I(num2str(r$Df)), pValue = I(num2str(r[["Pr(>Chisq)"]])), messages = I(unique(ms)), warnings = I(unique(ws)))
}

reference <- function(a) {
  e <- glmer_exact(a)
  g <- glm_fit(a)
  stopifnot(g$converged)
  lg <- logLik(g)
  rows <- list(list(name = a$names[[2]], npar = attr(lg, "df"), ll = as.numeric(lg)),
               list(name = a$names[[1]], npar = e$df, ll = e$logLik))
  o <- order(vapply(rows, `[[`, 0, "npar")); rows <- rows[o]
  ll <- vapply(rows, `[[`, 0, "ll"); npar <- vapply(rows, `[[`, 0, "npar")
  nested <- c(FALSE, a$link == a$glmLink)
  chisq <- ifelse(nested, 2 * pmax(0, c(NA, diff(ll))), NA)
  df <- c(NA, diff(npar))
  list(names = I(vapply(rows, `[[`, "", "name")), npar = I(num2str(npar)), AIC = I(num2str(-2 * ll + 2 * npar)),
       BIC = I(num2str(-2 * ll + log(e$n) * npar)), logLik = I(num2str(ll)), deviance = I(num2str(-2 * ll)),
       Chisq = I(num2str(chisq)), Df = I(num2str(df)),
       pValue = I(num2str(ifelse(df == 0 | !nested, NA, pchisq(chisq, df, lower.tail = FALSE)))), nested = I(nested))
}

cases <- list()
glm_case <- function(formula, glmFormula, data, family, link, glmLink = link, weights = NULL) {
  a <- list(formula = formula, data = data, family = family, link = link)
  if (!is.null(weights)) a$weights <- I(num2str(weights))
  a$nAGQ <- "1"
  a$glmFormula <- glmFormula
  a$glmLink <- glmLink
  mf <- model.frame(as.formula(glmFormula), data)
  X <- model.matrix(as.formula(glmFormula), data)
  a$glmX <- lapply(seq_len(nrow(X)), function(i) I(num2str(unname(X[i, -1]))))
  y <- model.response(mf)
  a$glmY <- if (is.matrix(y)) lapply(seq_len(nrow(y)), function(i) I(num2str(unname(y[i, ])))) else I(num2str(unname(y)))
  a$names <- I(c("glmm", "glm"))
  cases[[length(cases) + 1]] <<- a
}

glm_case(cbf, "cbind(inc, notinc) ~ period", cb, "binomial", "logit")
glm_case("prop ~ period + (1 | herd)", "prop ~ period", cb, "binomial", "logit", weights = cb$size)
glm_case("y ~ x + (1 | g)", "y ~ x", dbin, "binomial", "logit")
glm_case("y ~ x + (1 | g)", "y ~ x", dbin, "binomial", "logit", glmLink = "probit")            # not nested
glm_case("y ~ x + (1 | g)", "y ~ x", dpo, "poisson", "log")
glm_case("y ~ x + (1 | g) + (1 | h)", "y ~ x", dpo, "poisson", "log")

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) { str(expected(cases[[i]])); str(tryCatch(reference(cases[[i]]), error = function(e) conditionMessage(e))) }
} else write_anova_fixture("glmerAnovaGlm", cases, expected, reference)
