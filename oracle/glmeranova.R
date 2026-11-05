source("/oracle/_mixedexact.R")

# anova() of glmer fits (fixture glmerAnova). Behaviour in oracle/glmer-behaviour.md ("glmerAnova (stage 3)"). Two
# kinds of cases:
# - one fit: formula, data (with dataTypes), family, link, optional weights and offset (arrays), nAGQ (a string);
#   written: lme4's anova(fit) as terms (the row names), npar, sumSq, meanSq, F (expected), and the same at the exact
#   optimum (reference: oracle/_mixedexact.R's glmer_exact; c = RX beta with RX at the exact mode, the sums of c^2
#   over the columns of each term, F = meanSq / sigma^2)
# - several fits: data (with dataTypes; every model is fitted to this one data object), models (one per fit, in the
#   order given: {kind: "glmer", formula, family, link, nAGQ, weights} or {kind: "lmer", formula, REML}; weights a
#   column name of data), names (anova's model.names) and refit (optional, default TRUE); written: R's table (names,
#   npar, AIC, BIC, logLik, deviance (-2*log(L)), Chisq, Df, pValue in R's order), messages and warnings, or {error};
#   reference: the table from the exact optima (glmer: logLik by G12; lmer: the exact ML optimum when refitted), with
#   Chisq and pValue "NA" in the rows whose fit is not nested in the next smaller one by rStats.js's rule, "nested" (one
#   boolean per row; the first is false), and rStats.js's own errors (rows, response, prior weights) as {error}

num_in <- function(x) as.numeric(unlist(x))

# ---- one fit ----
expected_one <- function(a) {
  fit <- suppressMessages(suppressWarnings(fit_lme4(a)))
  t <- anova(fit)
  list(terms = I(rownames(t)), npar = I(num2str(t$npar)), sumSq = I(num2str(t[["Sum Sq"]])),
       meanSq = I(num2str(t[["Mean Sq"]])), F = I(num2str(t[["F value"]])))
}
reference_one <- function(a) {
  e <- glmer_exact(a)
  X <- e$s$X
  cc <- as.vector(e$RX %*% e$beta)^2
  asg <- attr(X, "assign")
  labels <- attr(terms(e$fit, fixed.only = TRUE), "term.labels")
  keep <- asg != 0
  groups <- unique(asg[keep])
  ss <- vapply(groups, function(k) sum(cc[asg == k]), 0)
  np <- vapply(groups, function(k) sum(asg == k), 0)
  ms <- ss / np
  list(terms = I(labels[groups]), npar = I(num2str(np)), sumSq = I(num2str(ss)), meanSq = I(num2str(ms)),
       F = I(num2str(ms / e$sigma^2)))
}

# ---- several fits ----
fit_model <- function(m, dat) {
  env <- list2env(list(dat = dat))
  if (m$kind == "lmer") return(eval(substitute(lme4::lmer(F, dat, REML = R), list(F = as.formula(m$formula), R = isTRUE(m$REML))), env))
  fam <- get(m$family, mode = "function")(link = m$link)
  eval(substitute(glmer(F, dat, family = FAM, nAGQ = K, weights = W),
                  list(F = as.formula(m$formula), FAM = fam, K = as.integer(m$nAGQ),
                       W = if (is.null(m$weights)) NULL else as.name(m$weights))), env)
}
expected_many <- function(a) {
  ws <- character(0); ms <- character(0)
  r <- withCallingHandlers({
    fits <- lapply(a$models, function(m) suppressMessages(suppressWarnings(fit_model(m, a$data))))
    do.call(anova, c(fits, list(refit = a$refit %||% TRUE, model.names = unlist(a$names))))
  }, warning = function(cnd) { ws <<- c(ws, conditionMessage(cnd)); invokeRestart("muffleWarning") },
     message = function(cnd) { ms <<- c(ms, sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  list(names = I(rownames(r)), npar = I(num2str(r$npar)), AIC = I(num2str(r$AIC)), BIC = I(num2str(r$BIC)),
       logLik = I(num2str(r$logLik)), deviance = I(num2str(r[["-2*log(L)"]])), Chisq = I(num2str(r$Chisq)),
       Df = I(num2str(r$Df)), pValue = I(num2str(r[["Pr(>Chisq)"]])), messages = I(unique(ms)), warnings = I(unique(ws)))
}

# what rStats.js needs of each fit: X, the random-effects terms, family and link, offset, prior weights, rows, response
model_info <- function(m, dat) {
  if (m$kind == "lmer") {
    s <- LM$prepare(list(formula = m$formula, data = dat))
    rows <- as.integer(rownames(s$lf$fr))
    return(list(X = s$Xd, cnms = s$lf$reTrms$cnms, family = "gaussian", link = "identity", off = rep(0, s$n),
                w = rep(1, s$n), rows = rows, n = s$n))
  }
  a <- list(formula = m$formula, data = dat, family = m$family, link = m$link, nAGQ = m$nAGQ)
  if (!is.null(m$weights)) a$weights <- dat[[m$weights]]
  s <- prepare(a)
  fr <- suppressMessages(suppressWarnings(do.call(glFormula, c(list(formula = as.formula(a$formula), data = lme4_args(a)$dat,
                                                                    family = lme4_args(a)$fam), lme4_args(a)$extra))))$fr
  list(X = s$X, cnms = s$rt$cnms, family = m$family, link = m$link, off = s$off, w = s$wt / pmax(1, s$nb),
       rows = as.integer(rownames(fr)), n = s$n, a = a)
}
lhs <- function(f) gsub("\\s+", "", sub("~.*$", "", f))
nested_in <- function(sm, lg) {
  same_x <- qr(cbind(lg$X, sm$X))$rank == qr(lg$X)$rank
  re <- all(vapply(seq_along(sm$cnms), function(k) {
    g <- names(sm$cnms)[k]
    any(vapply(seq_along(lg$cnms), function(l) names(lg$cnms)[l] == g && all(sm$cnms[[k]] %in% lg$cnms[[l]]), NA))
  }, NA))
  sm$family == lg$family && sm$link == lg$link && isTRUE(all.equal(sm$off, lg$off, tolerance = 0)) && same_x && re
}
reference_many <- function(a) {
  info <- lapply(a$models, model_info, dat = a$data)
  n <- vapply(info, `[[`, 0, "n")
  if (any(n != n[1])) return(list(error = "models were not all fitted to the same size of dataset"))
  if (!all(vapply(info, function(i) identical(i$rows, info[[1]]$rows), NA)))
    return(list(error = "models were not all fitted to the same rows of the data"))
  if (length(unique(vapply(a$models, function(m) lhs(m$formula), ""))) > 1)
    return(list(error = "models were not all fitted to the same response"))
  if (!all(vapply(info, function(i) isTRUE(all.equal(i$w, info[[1]]$w, tolerance = 0)), NA)))
    return(list(error = "models were not all fitted with the same prior weights"))
  refit <- a$refit %||% TRUE
  rows <- lapply(seq_along(a$models), function(k) {
    m <- a$models[[k]]
    e <- if (m$kind == "lmer") lmer_exact(list(formula = m$formula, data = a$data, REML = isTRUE(m$REML)),
                                          reml = isTRUE(m$REML) && !refit)
         else glmer_exact(info[[k]]$a)
    list(name = a$names[[k]], npar = e$df, ll = e$logLik, info = info[[k]])
  })
  o <- order(vapply(rows, `[[`, 0, "npar")); rows <- rows[o]
  ll <- vapply(rows, `[[`, 0, "ll"); npar <- vapply(rows, `[[`, 0, "npar")
  nested <- c(FALSE, vapply(seq_along(rows)[-1], function(k) nested_in(rows[[k - 1]]$info, rows[[k]]$info), NA))
  chisq <- ifelse(nested, 2 * pmax(0, c(NA, diff(ll))), NA)
  df <- c(NA, diff(npar))
  nm <- vapply(rows, `[[`, "", "name")
  if (anyDuplicated(nm)) nm <- paste0("MODEL", seq_along(a$models))[o]
  list(names = I(nm), npar = I(num2str(npar)), AIC = I(num2str(-2 * ll + 2 * npar)),
       BIC = I(num2str(-2 * ll + log(n[1]) * npar)), logLik = I(num2str(ll)), deviance = I(num2str(-2 * ll)),
       Chisq = I(num2str(chisq)), Df = I(num2str(df)),
       pValue = I(num2str(ifelse(df == 0 | !nested, NA, pchisq(chisq, df, lower.tail = FALSE)))), nested = I(nested))
}

expected <- function(a) if (is.null(a$models)) expected_one(a) else expected_many(a)
reference <- function(a) if (is.null(a$models)) reference_one(a) else reference_many(a)

# ---- data (besides oracle/glmer.R's) ----
set.seed(20261107)
dbinf <- transform(dbin, f = rep(c("a", "b", "c"), 40), x2 = 2 * x, w = rep(c(1, 2), 60))
dgmf <- transform(dgm, f = rep(c("p", "q", "r", "s"), 20))
dpof <- transform(dpo, f = rep(c("u", "v"), 50))

# ---- one fit ----
add("cbind(inc, notinc) ~ period + (1 | herd)", cb, "binomial", "logit")
add("cbind(inc, notinc) ~ period + (1 | herd)", cb, "binomial", "logit", 0)
add("cbind(inc, notinc) ~ period + (1 | herd)", cb, "binomial", "logit", 5)
add("cbind(inc, notinc) ~ 1 + (1 | herd)", cb, "binomial", "logit")             # no row
add("y ~ x + f + (1 | g)", dgmf, "Gamma", "log")                                  # F = meanSq / sigma^2
add("y ~ x * f + (1 | g) + (1 | h)", dpof, "poisson", "log")
add("y ~ 0 + f + x + (1 | g)", dbinf, "binomial", "logit")                        # no intercept: f has 3 columns
add("y ~ x + x2 + f + (1 | g)", dbinf, "binomial", "logit")                       # x2 aliased

# ---- several fits ----
G <- function(formula, family, link, nAGQ = 1, weights = NULL)
  c(list(kind = "glmer", formula = formula, family = family, link = link, nAGQ = as.character(nAGQ)),
    if (is.null(weights)) NULL else list(weights = weights))
L <- function(formula, REML = TRUE) list(kind = "lmer", formula = formula, REML = REML)
many <- function(data, models, names, refit = NULL)
  cases[[length(cases) + 1]] <<- c(list(data = data, models = models, names = names), if (is.null(refit)) NULL else list(refit = refit))
cbf0 <- "cbind(inc, notinc) ~ 1 + (1 | herd)"
many(cb, list(G(cbf, "binomial", "logit"), G(cbf0, "binomial", "logit")), list("m1", "m0"))
many(dgm, list(G("y ~ 1 + (1 | g)", "Gamma", "log"), G("y ~ x + (x | g)", "Gamma", "log"), G("y ~ x + (1 | g)", "Gamma", "log")),
     list("m0", "m2", "m1"))
many(dgm, list(G("y ~ x + (1 | g)", "Gamma", "log"), L("y ~ x + (1 | g)")), list("glmm", "lmm"))   # refit; not nested
many(dgm, list(G("y ~ x + (1 | g)", "Gamma", "log"), L("y ~ x + (1 | g)")), list("glmm", "lmm"), refit = FALSE)
many(cb, list(G(cbf, "binomial", "logit", 1), G(cbf, "binomial", "logit", 5)), list("laplace", "agq5"))   # G12
many(cb, list(G(cbf0, "binomial", "logit", 9), G(cbf, "binomial", "logit", 9)), list("m0", "m1"))        # G12
many(dbinf, list(G("y ~ x + (1 | g)", "binomial", "logit"), G("y ~ x + (1 | g)", "binomial", "probit")), list("logit", "probit"))
many(dbinf, list(G("y ~ 1 + (1 | g)", "binomial", "logit"), G("y ~ x + (1 | g)", "binomial", "logit"),
                 G("y ~ x + (1 | g) + (1 | h)", "binomial", "logit")), list("a", "a", "b"))    # duplicated names
many(dbna, list(G("y ~ x + (1 | g)", "binomial", "logit"), G("y ~ 1 + (1 | g)", "binomial", "logit")), list("m1", "m0"))   # nobs
many(dbinf, list(G("y ~ x + (1 | g)", "binomial", "logit"), G("y ~ x + (1 | g)", "binomial", "logit", weights = "w")),
     list("unweighted", "weighted"))                                                       # prior weights differ

if (exists("DEBUG_ONE")) {
  for (i in DEBUG_ONE) { str(expected(cases[[i]])); str(tryCatch(reference(cases[[i]]), error = function(e) conditionMessage(e))) }
} else write_anova_fixture("glmerAnova", cases, expected, reference)
