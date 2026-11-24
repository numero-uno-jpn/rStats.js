# iptw113.R: WeightIt (weightit, trim, summary), cobalt (bal.tab on a weightit), survey (svyglm), sandwich (vcovHC)
# and survival (coxph with weights, survfit(coxph, newdata)) on small data, public functions only (1.13.0).
# Settles: the weights of each method x link x estimand and how they relate to the propensity score, what stabilize
# multiplies by, what trim(at, lower = TRUE) cuts (which quantile, which units, whether it renormalises), the parts of
# summary(weightit), the SD in bal.tab's SMD for ATO, the svyglm standard errors and degrees of freedom, and the
# adjusted survival curves.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({
  library(WeightIt); library(CBPS); library(cobalt); library(survey); library(sandwich); library(survival)
})
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
mat <- function(m) if (is.null(m)) NULL else list(dim = dim(m), dimnames = dimnames(m), values = as.vector(as.matrix(m)))
frame <- function(f) if (is.null(f)) NULL else list(rows = rownames(f), cols = lapply(f, function(col) if (is.factor(col)) as.character(col) else col))
# a summary or result list: numbers and character vectors kept, matrices and data frames flattened, the rest named only
flat <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.data.frame(x)) return(frame(x))
  if (is.matrix(x)) return(mat(x))
  if (is.list(x)) { r <- lapply(x, flat); return(r) }
  if (is.numeric(x) || is.character(x) || is.logical(x)) return(list(names = names(x), values = unname(x)))
  list(class = class(x))
}
out <- list(R = R.version.string, arch = R.version$arch,
            versions = sapply(c("WeightIt", "CBPS", "cobalt", "survey", "sandwich", "survival"),
                              function(p) as.character(packageVersion(p))))

## data: 80 subjects, a continuous, a binary and a 3-level factor covariate; treatment from a logistic model;
## a continuous, a binary and a survival outcome
set.seed(20261125)
n <- 80
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4); x3 <- factor(sample(c("a", "b", "c"), n, replace = TRUE))
tr <- rbinom(n, 1, plogis(-0.3 + 0.5 * x1 + 0.5 * x2 - 0.4 * (x3 == "c")))
y <- round(1 + 0.5 * tr + 0.7 * x1 + 0.4 * x2 + rnorm(n), 3)
yb <- rbinom(n, 1, plogis(-0.5 + 0.6 * tr + 0.5 * x1))
time <- round(rexp(n, 0.1 * exp(-0.4 * tr + 0.3 * x1)), 2); status <- rbinom(n, 1, 0.75)
d <- data.frame(tr = tr, x1 = x1, x2 = x2, x3 = x3, y = y, yb = yb, time = time, status = status)
out$data <- list(tr = tr, x1 = x1, x2 = x2, x3 = as.character(x3), y = y, yb = yb, time = time, status = status)

## the propensity scores of glm with each link, for comparing with weightit's ps
links <- c("logit", "probit", "cauchit", "cloglog")
out$glmPs <- lapply(setNames(links, links), function(l)
  unname(fitted(glm(tr ~ x1 + x2 + x3, data = d, family = binomial(link = l)))))

wfit <- function(w) if (!is.list(w) || is.null(w$weights)) list(notWeights = TRUE) else
  list(weights = unname(w$weights), ps = if (is.null(w$ps)) NULL else unname(w$ps), estimand = w$estimand,
       method = w$method, s.weights = unname(w$s.weights), focal = w$focal, names = names(w))
sfit <- function(w) if (!is.list(w) || is.null(w$weights)) NULL else flat(summary(w))

## every method x link x estimand of the scope, without and with stabilize
grid <- list(list(method = "ps", link = "logit"), list(method = "ps", link = "probit"),
             list(method = "ps", link = "cauchit"), list(method = "ps", link = "cloglog"),
             list(method = "glm", link = "logit"), list(method = "cbps", link = "logit"),
             list(method = "cbps", link = "probit"), list(method = "ipt", link = "logit"),
             list(method = "ebal", link = NULL))
estimands <- c("ATE", "ATT", "ATC", "ATO")
fits <- list()
for (g in grid) for (e in estimands) for (st in c(FALSE, TRUE)) {
  key <- paste(g$method, if (is.null(g$link)) "-" else g$link, e, if (st) "stab" else "raw", sep = "/")
  r <- run(if (is.null(g$link)) weightit(tr ~ x1 + x2 + x3, data = d, method = g$method, estimand = e, stabilize = st)
           else weightit(tr ~ x1 + x2 + x3, data = d, method = g$method, link = g$link, estimand = e, stabilize = st))
  fits[[key]] <- list(fit = if (is.null(r$value)) NULL else wfit(r$value), summary = if (is.null(r$value)) NULL else sfit(r$value),
                      error = r$error, warnings = r$warnings, messages = r$messages)
}
out$fits <- fits

## trim: several at, lower = TRUE and FALSE, on ATE (both groups weighted), ATT (controls only) and ATO
base <- list(ATE = weightit(tr ~ x1 + x2 + x3, data = d, method = "ps", estimand = "ATE"),
             ATT = weightit(tr ~ x1 + x2 + x3, data = d, method = "ps", estimand = "ATT"),
             ATO = weightit(tr ~ x1 + x2 + x3, data = d, method = "ps", estimand = "ATO"),
             ATEstab = weightit(tr ~ x1 + x2 + x3, data = d, method = "ps", estimand = "ATE", stabilize = TRUE))
trims <- list()
for (b in names(base)) for (at in c(0.9, 0.95, 0.98, 0.99, 0.5, 5)) for (lo in c(TRUE, FALSE)) {
  r <- run(trim(base[[b]], at = at, lower = lo))
  trims[[paste(b, at, lo, sep = "/")]] <- list(fit = if (is.null(r$value)) NULL else wfit(r$value),
    summary = if (is.null(r$value)) NULL else sfit(r$value), error = r$error, warnings = r$warnings, messages = r$messages)
}
# trim on a plain numeric vector of weights (documented), with and without treat
wv <- base$ATE$weights
trims[["vector/0.9/TRUE"]] <- run(trim(wv, at = 0.9, lower = TRUE))
trims[["vector-treat/0.9/TRUE"]] <- run(trim(wv, at = 0.9, lower = TRUE, treat = d$tr))
out$trims <- trims
# quantiles of the ATE weights (all units and by group), all 9 types, to identify the cut points
qs <- c(0.01, 0.02, 0.05, 0.1, 0.5, 0.9, 0.95, 0.98, 0.99)
out$quantiles <- list(
  all = lapply(1:9, function(t) unname(quantile(wv, qs, type = t))),
  treated = lapply(1:9, function(t) unname(quantile(wv[d$tr == 1], qs, type = t))),
  control = lapply(1:9, function(t) unname(quantile(wv[d$tr == 0], qs, type = t))),
  attControl = lapply(1:9, function(t) unname(quantile(base$ATT$weights[d$tr == 0], qs, type = t))))

## bal.tab on weightit results: ReactiveStat's call (un = TRUE, std for binary and continuous, mean diffs and
## variance ratios, thresholds) for each estimand, plus the default call for ATE
bal <- list()
for (e in estimands) {
  w <- weightit(tr ~ x1 + x2 + x3, data = d, method = "ps", estimand = e)
  r <- run(bal.tab(w, stats = c("mean.diffs", "variance.ratios"), thresholds = c(m = 0.1, v = 2), un = TRUE,
                   binary = "std", continuous = "std"))
  bal[[e]] <- if (is.null(r$value)) r else list(Balance = frame(r$value$Balance), Observations = frame(r$value$Observations),
                                                 warnings = r$warnings, messages = r$messages)
}
r <- run(bal.tab(base$ATE, un = TRUE))
bal[["ATE-default"]] <- if (is.null(r$value)) r else list(Balance = frame(r$value$Balance), Observations = frame(r$value$Observations))
r <- run(bal.tab(base$ATEstab, stats = c("mean.diffs", "variance.ratios"), un = TRUE, binary = "std", continuous = "std"))
bal[["ATEstab"]] <- if (is.null(r$value)) r else list(Balance = frame(r$value$Balance), Observations = frame(r$value$Observations))
out$bal <- bal

## downstream, with the ATE weights (ps, logit) and the stabilised ones
glmfit <- function(m) list(coef = coef(m), vcov = mat(vcov(m)), df.residual = m$df.residual,
                           coefficients = mat(summary(m)$coefficients), dispersion = as.numeric(summary(m)$dispersion),
                           deviance = as.numeric(m$deviance), aic = as.numeric(m$aic), iter = as.numeric(m$iter))
down <- list()
for (b in c("ATE", "ATEstab")) {
  dd <- d; dd$w <- base[[b]]$weights
  des <- svydesign(ids = ~1, weights = ~w, data = dd)
  rb <- run(svyglm(yb ~ tr + x1 + x2 + x3, design = des, family = binomial()))
  rg <- run(svyglm(y ~ tr + x1 + x2 + x3, design = des))
  rqb <- run(svyglm(yb ~ tr + x1 + x2 + x3, design = des, family = quasibinomial()))
  lmw <- lm(y ~ tr + x1 + x2 + x3, data = dd, weights = w)
  cw <- coxph(Surv(time, status) ~ tr + x1 + x2 + x3, data = dd, weights = w, robust = TRUE)
  cn <- coxph(Surv(time, status) ~ tr + x1 + x2 + x3, data = dd, weights = w)
  nd <- data.frame(tr = c(0, 1), x1 = mean(dd$x1), x2 = mean(dd$x2), x3 = factor(c("a", "a"), levels = levels(dd$x3)))
  sfr <- run(survfit(cw, newdata = nd)); sfn <- run(survfit(cn, newdata = nd))
  sfo <- function(s) if (is.null(s$value)) s else {
    v <- s$value; ss <- summary(v)
    list(time = v$time, n.risk = v$n.risk, n.event = v$n.event, n.censor = v$n.censor, surv = mat(v$surv),
         std.err = mat(v$std.err), lower = mat(v$lower), upper = mat(v$upper), cumhaz = mat(v$cumhaz),
         conf.type = v$conf.type, conf.int = v$conf.int, table = mat(ss$table), warnings = s$warnings)
  }
  times <- unique(unname(quantile(dd$time, c(0.25, 0.5, 0.75))))
  sumt <- function(s) if (is.null(s$value)) NULL else { ss <- summary(s$value, times = times)
    list(time = ss$time, surv = mat(ss$surv), std.err = mat(ss$std.err), lower = mat(ss$lower), upper = mat(ss$upper),
         n.risk = mat(ss$n.risk)) }
  km <- survfit(Surv(time, status) ~ tr, data = dd, weights = w)
  down[[b]] <- list(
    svyglmBinomial = if (is.null(rb$value)) rb else c(glmfit(rb$value), list(warnings = rb$warnings)),
    svyglmGaussian = if (is.null(rg$value)) rg else c(glmfit(rg$value), list(warnings = rg$warnings)),
    svyglmQuasibinomial = if (is.null(rqb$value)) rqb else c(glmfit(rqb$value), list(warnings = rqb$warnings)),
    lmHC3 = list(coef = coef(lmw), vcovHC3 = mat(vcovHC(lmw, type = "HC3")), vcovHC0 = mat(vcovHC(lmw, type = "HC0"))),
    coxRobust = list(coef = coef(cw), var = mat(cw$var), naive.var = mat(cw$naive.var), loglik = cw$loglik),
    coxNaive = list(coef = coef(cn), var = mat(cn$var), loglik = cn$loglik),
    survfitRobust = sfo(sfr), survfitNaive = sfo(sfn), summaryTimes = times,
    survfitRobustAtTimes = sumt(sfr), survfitNaiveAtTimes = sumt(sfn),
    km = list(time = km$time, surv = km$surv, std.err = km$std.err, n.risk = km$n.risk, n.event = km$n.event,
              strata = km$strata, lower = km$lower, upper = km$upper))
}
out$downstream <- down

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
