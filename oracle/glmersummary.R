source("/oracle/_mixedexact.R")

# The summary of a glmer fit: lme4's summary(fit) (fixture glmerSummary). Behaviour in oracle/glmer-behaviour.md
# ("glmerSummary (stage 3)"). Each case is one fit with the arguments of the fixture glmer (formula, data, family,
# link, optional weights and offset, nAGQ as a string). Written (expected: lme4's glmer and summary(); reference:
# the same fields at the exact optimum, from oracle/glmer.R's reference(), through oracle/_glmeragq.R for nAGQ > 1):
#   names, estimate, stdError, statistic   the coefficient table (row names, Estimate, Std. Error, third column)
#   statisticName   "z value" or "t value" (R's name of the third column)
#   pValue          Pr(>|z|) = 2 pnorm(-|statistic|), for every family
#   correlation     cov2cor(vcov), one array per row
#   nGroups         per grouping factor (ngrps(fit)): group, levels (the number of levels)
#   nObs, logLik, AIC, BIC, df, minus2LogLik (R's -2*log(L)), dfResidual (df.resid)
#   residualQuantiles  quantile(residuals(fit, "pearson", scaled = TRUE)): min, 1Q, median, 3Q, max
#   sigma, family, link, nAGQ; methTitle (expected only, information)
#   messages        the fit's messages (expected: R's, which the summary prints; reference: rStats.js's, without
#                   lme4's optimiser messages)
#   warnings        those of summary() itself (the vcov fallback warning, which no case has)
# For nAGQ > 1 the reference's logLik, AIC, BIC and minus2LogLik are the true log-likelihood's (G12): R's minus half
# the saturated constant, aic - sum of the deviance residuals (computed here at the reference's means; it does not
# depend on them).

reference_fit <- reference   # oracle/glmer.R's reference(), before this file defines its own
q7 <- function(x) unname(quantile(x, type = 7))

expected <- function(a) {
  f <- with_conditions(fit_lme4(a))   # the fit's messages (R prints them in the summary)
  r <- with_conditions(summary(f$value))   # the summary's own warnings
  sm <- r$value
  co <- sm$coefficients
  V <- as.matrix(sm$vcov)
  C <- as.matrix(cov2cor(V))
  at <- sm$AICtab
  ng <- sm$ngrps
  list(names = I(rownames(co)), estimate = I(num2str(unname(co[, 1]))), stdError = I(num2str(unname(co[, 2]))),
       statistic = I(num2str(unname(co[, 3]))), statisticName = colnames(co)[3], pValue = I(num2str(unname(co[, 4]))),
       correlation = lapply(seq_len(nrow(C)), function(i) I(num2str(unname(C[i, ])))),
       nGroups = lapply(names(ng), function(g) list(group = g, levels = unname(ng[[g]]))),
       nObs = sm$devcomp$dims[["n"]], logLik = num2str(at[["logLik"]]), AIC = num2str(at[["AIC"]]),
       BIC = num2str(at[["BIC"]]), df = num2str(attr(sm$logLik, "df")), minus2LogLik = num2str(at[["-2*log(L)"]]),
       dfResidual = num2str(at[["df.resid"]]), residualQuantiles = I(num2str(q7(sm$residuals))),
       sigma = num2str(sm$sigma), family = sm$family, link = sm$link, nAGQ = a$nAGQ, methTitle = sm$methTitle,
       messages = I(f$messages), warnings = I(r$warnings))
}

reference <- function(a) {
  rf <- reference_fit(a)
  s <- prepare(a)
  num <- function(x) as.numeric(unlist(x))
  est <- num(rf$fixef); se <- num(rf$stdError); z <- num(rf$zValue)
  V <- do.call(rbind, lapply(rf$vcov, num))
  C <- if (length(V)) { d <- sqrt(diag(V)); C <- V / outer(d, d); diag(C) <- 1; C } else matrix(0, 0, 0)
  ll <- as.numeric(rf$logLik)
  if (s$nagq > 1L) {   # G12
    mu <- num(rf$fitted); di <- devres(s$y, mu, s$wt, s$family)
    ll <- ll - (aic_of(s$y, s$nb, mu, s$wt, sum(di), s$family) - sum(di)) / 2
  }
  df <- as.numeric(rf$df); n <- rf$nObs
  sigma <- as.numeric(rf$sigma)
  list(names = I(colnames(s$X)), estimate = I(num2str(est)), stdError = I(num2str(se)), statistic = I(num2str(z)),
       statisticName = if (s$useSc) "t value" else "z value", pValue = I(num2str(2 * pnorm(-abs(z)))),
       correlation = lapply(seq_len(nrow(C)), function(i) I(num2str(C[i, ]))),
       nGroups = lapply(names(s$rt$flist), function(g) list(group = g, levels = nlevels(s$rt$flist[[g]]))),
       nObs = n, logLik = num2str(ll), AIC = num2str(-2 * ll + 2 * df), BIC = num2str(-2 * ll + log(n) * df), df = num2str(df),
       minus2LogLik = num2str(-2 * ll), dfResidual = num2str(n - df),
       residualQuantiles = I(num2str(q7(num(rf$pearsonResiduals) / sigma))), sigma = num2str(sigma),
       family = a$family, link = a$link, nAGQ = a$nAGQ, messages = rf$messages,
       warnings = I(character(0)))   # (the vcov fallback does not occur at these exact optima: H is positive definite)
}

add("cbind(inc, notinc) ~ period + (1 | herd)", cb, "binomial", "logit")
add("cbind(inc, notinc) ~ period + (1 | herd)", cb, "binomial", "logit", 0)
add("cbind(inc, notinc) ~ period + (1 | herd)", cb, "binomial", "logit", 5)
add("y ~ x + (x | g)", dbin, "binomial", "logit")                        # singular: "RX", the singular message
add("y ~ x + (1 | g) + (1 | h)", dpo, "poisson", "log")
add("yt ~ x + (1 | g)", dpo, "poisson", "log", offset = log(dpo$t))
add("y ~ x + (1 | g)", dgm, "Gamma", "log")                              # "t value"
add("y ~ x + (1 | g)", dgm, "Gamma", "log", weights = dgm$w)
add("yg ~ x + (1 | g)", dgm, "gaussian", "log")
dbr <- transform(dbin, x2 = 2 * x)                                     # an aliased column (the structure's message)
add("y ~ x + x2 + (1 | g)", dbr, "binomial", "logit")

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) { str(expected(cases[[i]])); str(reference(cases[[i]])) }
} else write_anova_fixture("glmerSummary", cases, expected, reference)
