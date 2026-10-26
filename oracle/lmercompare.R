DEBUG_ONE <- TRUE
source("/oracle/lmer.R")   # prepare, pls, optimum and the 128-bit helpers (DEBUG_ONE: lmer.R writes nothing)
rm(DEBUG_ONE)

# Likelihood-ratio comparison of lmer fits: lme4's anova(m1, m2, ...) (fixture lmerCompare). Behaviour in
# oracle/lmertest-behaviour.md ("Comparing models"). Each case has
#   data       one data frame (all the models are fitted to it), or `datas` with one data frame per model
#   models     one {formula, REML, contrasts, levels} per model, in the order given to anova()
#   names      the model names (anova's model.names)
#   refit      anova's refit (default TRUE)
# Written: the table in R's order (by the number of parameters): names, npar, AIC, BIC, logLik, deviance
#   (-2*log(L)), Chisq, Df, pValue; messages and warnings; or {error}.
# reference: the same table from the exact optima (oracle/lmer.R's optimum(); ML refits are the exact ML optima).

fit_one <- function(m, dat) {
  a <- c(m, list(data = dat)); s <- prepare(a)
  list(s = s, fit = lme4::lmer(as.formula(m$formula), s$dat, REML = isTRUE(m$REML), contrasts = s$ctr), a = a)
}
datas_of <- function(a) if (!is.null(a$datas)) a$datas else rep(list(a$data), length(a$models))

expected <- function(a) {
  ws <- character(0); ms <- character(0)
  r <- withCallingHandlers({
    ds <- datas_of(a)
    # one data object for all models when `data` is given (anova checks that the calls name the same data)
    fits <- lapply(seq_along(a$models), function(i) {
      m <- a$models[[i]]; dat <- ds[[i]]
      for (nm in names(m$levels)) dat[[nm]] <- factor(dat[[nm]], levels = m$levels[[nm]])
      ctr <- if (is.null(m$contrasts)) NULL else lapply(m$contrasts, identity)
      eval(substitute(lme4::lmer(F, D, REML = R, contrasts = C),
                      list(F = as.formula(m$formula), D = as.name(paste0("dat", if (is.null(a$datas)) "" else i)),
                           R = isTRUE(m$REML), C = ctr)),
           envir = list2env(c(list(dat = dat), setNames(ds, paste0("dat", seq_along(ds))))))
    })
    do.call(anova, c(fits, list(refit = a$refit %||% TRUE, model.names = unlist(a$names))))
  }, warning = function(cnd) { ws <<- c(ws, conditionMessage(cnd)); invokeRestart("muffleWarning") },
     message = function(cnd) { ms <<- c(ms, sub("\n$", "", conditionMessage(cnd))); invokeRestart("muffleMessage") })
  list(names = I(rownames(r)), npar = I(num2str(r$npar)), AIC = I(num2str(r$AIC)), BIC = I(num2str(r$BIC)),
       logLik = I(num2str(r$logLik)), deviance = I(num2str(r[["-2*log(L)"]])), Chisq = I(num2str(r$Chisq)),
       Df = I(num2str(r$Df)), pValue = I(num2str(r[["Pr(>Chisq)"]])), messages = I(unique(ms)), warnings = I(unique(ws)))
}

reference <- function(a) {
  ds <- datas_of(a)
  refit <- a$refit %||% TRUE
  rows <- lapply(seq_along(a$models), function(i) {
    m <- a$models[[i]]; f <- suppressMessages(suppressWarnings(fit_one(m, ds[[i]])))
    reml <- isTRUE(m$REML) && !refit
    th0 <- unname(getME(if (isTRUE(m$REML) && refit) lme4::refitML(f$fit) else f$fit, "theta"))
    opt <- optimum(f$s, th0, reml)
    r <- pls(f$s, opt$theta)
    ll <- -asNumeric(if (reml) r$devREML else r$devML) / 2
    list(name = a$names[[i]], npar = f$s$p + length(th0) + 1, ll = ll, n = f$s$n)
  })
  o <- order(vapply(rows, function(r) r$npar, 0)); rows <- rows[o]
  ll <- vapply(rows, function(r) r$ll, 0); npar <- vapply(rows, function(r) r$npar, 0); n <- rows[[1]]$n
  chisq <- 2 * pmax(0, c(NA, diff(ll))); df <- c(NA, diff(npar))
  list(names = I(vapply(rows, function(r) r$name, "")), npar = I(num2str(npar)), AIC = I(num2str(-2 * ll + 2 * npar)),
       BIC = I(num2str(-2 * ll + log(n) * npar)), logLik = I(num2str(ll)), deviance = I(num2str(-2 * ll)),
       Chisq = I(num2str(chisq)), Df = I(num2str(df)),
       pValue = I(num2str(ifelse(df == 0, NA, pchisq(chisq, df, lower.tail = FALSE)))))
}

M <- function(formula, REML = TRUE, ...) c(list(formula = formula, REML = REML), list(...))
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
add(data = sleep, models = list(M("Reaction ~ Days + (1 | Subject)"), M("Reaction ~ Days + (Days | Subject)")), names = list("m1", "m2"))
add(data = sleep, models = list(M("Reaction ~ 1 + (Days | Subject)", FALSE), M("Reaction ~ Days + (Days | Subject)", FALSE)),
    names = list("m0", "m1"))
add(data = sleep, models = list(M("Reaction ~ Days + (Days | Subject)"), M("Reaction ~ 1 + (1 | Subject)"),
                                M("Reaction ~ Days + (Days || Subject)")), names = list("full", "null", "uncorrelated"))
add(data = d, models = list(M("y ~ x + (1 | g)"), M("y ~ x + (1 | h)")), names = list("a", "b"), refit = FALSE)
add(data = d, models = list(M("y ~ x + (1 | g)"), M("y ~ x * f + (1 | g)", FALSE)), names = list("a", "b"), refit = FALSE)
add(data = d, models = list(M("y ~ x + (1 | g)"), M("y ~ x * f + (1 | g)"), M("y ~ x * f + (x | g)")), names = list("m1", "m2", "m3"))
add(data = d, models = list(M("y ~ x + (1 | g)", FALSE), M("y ~ f + x + (1 | g)", FALSE, levels = list(f = c("mid", "lo", "hi")))),
    names = list("m1", "m2"))
add(datas = list(d, dna), models = list(M("y ~ x + (1 | g)"), M("y ~ x + (x | g)")), names = list("m1", "m2"))

# LMERCOMPARE_NOREF=1 writes lme4's values only (no references), quickly
if (!exists("DEBUG_ONE")) write_anova_fixture("lmerCompare", cases, expected,
                                              if (nzchar(Sys.getenv("LMERCOMPARE_NOREF", ""))) NULL else reference)
