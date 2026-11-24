# issue: 563
# oracle-platform: amd64
# Public outputs of WeightIt (weightit, trim, summary), cobalt (bal.tab on a weightit), survey (svyglm) and survival
# (survfit of a weighted coxph with newdata) for test/fixtures/weightit.json (1.13.0). The behaviour and the choices
# are in oracle/weightit-behaviour.md. Public calls only.
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
out <- list(versions = sapply(c("WeightIt", "CBPS", "cobalt", "survey", "sandwich", "survival"),
                              function(p) as.character(packageVersion(p))))

## data sets
# sim: the data of experiments/iptw113.R
set.seed(20261125)
n <- 80
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4); x3 <- factor(sample(c("a", "b", "c"), n, replace = TRUE))
tr <- rbinom(n, 1, plogis(-0.3 + 0.5 * x1 + 0.5 * x2 - 0.4 * (x3 == "c")))
y <- round(1 + 0.5 * tr + 0.7 * x1 + 0.4 * x2 + rnorm(n), 3)
yb <- rbinom(n, 1, plogis(-0.5 + 0.6 * tr + 0.5 * x1))
time <- round(rexp(n, 0.1 * exp(-0.4 * tr + 0.3 * x1)), 2); status <- rbinom(n, 1, 0.75)
sim <- data.frame(tr = tr, x1 = x1, x2 = x2, x3 = x3, y = y, yb = yb, time = time, status = status)
# lalonde (cobalt): a 3-level factor, earnings in the thousands
data("lalonde", package = "cobalt")
lal <- data.frame(tr = lalonde$treat, age = lalonde$age, educ = lalonde$educ, race = lalonde$race,
                  married = lalonde$married, nodegree = lalonde$nodegree, re74 = lalonde$re74, re75 = lalonde$re75,
                  re78 = lalonde$re78, emp78 = as.integer(lalonde$re78 > 0))
# veteran (survival): treatment 2 vs 1, a 4-level factor, survival times with ties
vet <- data.frame(tr = veteran$trt - 1, karno = veteran$karno, age = veteran$age, prior = as.integer(veteran$prior > 0),
                  celltype = veteran$celltype, time = veteran$time, status = veteran$status)
sets <- list(sim = sim, lalonde = lal, veteran = vet)
covs <- list(sim = c("x1", "x2", "x3"), lalonde = c("age", "educ", "race", "married", "nodegree", "re74", "re75"),
             veteran = c("karno", "age", "prior", "celltype"))
out$data <- lapply(sets, function(d) lapply(d, function(col) if (is.factor(col)) as.character(col) else col))
out$levels <- list(sim = list(x3 = levels(sim$x3)), lalonde = list(race = levels(lal$race)),
                   veteran = list(celltype = levels(vet$celltype)))
form <- function(s) as.formula(paste("tr ~", paste(covs[[s]], collapse = " + ")))

## weightit: every method x link x estimand of the scope, stabilize for ps/glm ATE
wsum <- function(w) { s <- summary(w)
  grp <- function(x) if (is.null(x)) NULL else lapply(x, function(v) list(names = names(v), values = unname(v)))
  list(weight.range = grp(s$weight.range), weight.top = grp(s$weight.top),
       weight.mean = if (is.null(s$weight.mean)) NULL else as.list(s$weight.mean),
       coef.of.var = as.list(s$coef.of.var), scaled.mad = as.list(s$scaled.mad),
       negative.entropy = as.list(s$negative.entropy), num.zeros = as.list(s$num.zeros),
       ess = mat(s$effective.sample.size)) }
wres <- function(w) list(weights = unname(w$weights), ps = if (is.null(w$ps)) NULL else unname(w$ps),
                         estimand = w$estimand, method = w$method, summary = wsum(w))
grid <- list(c("ps", "logit"), c("ps", "probit"), c("ps", "cauchit"), c("ps", "cloglog"), c("glm", "logit"),
             c("cbps", "logit"), c("cbps", "probit"), c("ipt", "logit"), c("ebal", NA))
objs <- list()
for (s in names(sets)) for (g in grid) for (e in c("ATE", "ATT", "ATC", "ATO")) for (st in c(FALSE, TRUE)) {
  if (st && !(g[1] %in% c("ps", "glm") && e == "ATE")) next
  key <- sprintf("w_%s_%s_%s_%s%s", s, g[1], if (is.na(g[2])) "none" else g[2], e, if (st) "_stab" else "")
  r <- run(if (is.na(g[2])) weightit(form(s), data = sets[[s]], method = g[1], estimand = e)
           else weightit(form(s), data = sets[[s]], method = g[1], link = g[2], estimand = e, stabilize = st))
  if (!is.null(r$value)) { objs[[key]] <- r$value; r$value <- wres(r$value) }
  out[[key]] <- r
}

## trim: at < 1 (type-3 quantile) and at >= 1 (a count), lower TRUE and FALSE
for (s in c("sim", "lalonde")) for (b in c("ps_logit_ATE", "ps_logit_ATT", "ps_logit_ATC", "ps_logit_ATO",
                                            "ps_logit_ATE_stab", "ebal_none_ATT")) {
  w <- objs[[sprintf("w_%s_%s", s, b)]]
  if (is.null(w)) next
  for (at in c(0.9, 0.95, 0.98, 0.99, 3)) for (lo in c(TRUE, FALSE)) {
    key <- sprintf("trim_%s_%s_%g_%s", s, b, at, if (lo) "both" else "upper")
    r <- run(trim(w, at = at, lower = lo))
    if (!is.null(r$value)) r$value <- wres(r$value)
    out[[key]] <- r
  }
}
# a numeric vector of weights
out$trim_vector <- run(trim(c(5, 1, 2, 9, 3, 4, 8, 6, 7, 10), at = 0.8, lower = TRUE))

## bal.tab: ReactiveStat's call, and the default call
bal <- function(b) list(rows = rownames(b$Balance), type = as.character(b$Balance$Type),
                        diffUn = b$Balance$Diff.Un, diffAdj = b$Balance$Diff.Adj,
                        vRatioUn = b$Balance$V.Ratio.Un, vRatioAdj = b$Balance$V.Ratio.Adj,
                        obsRows = rownames(b$Observations), obsControl = b$Observations$Control,
                        obsTreated = b$Observations$Treated)
balKeys <- c("ps_logit_ATE", "ps_logit_ATT", "ps_logit_ATC", "ps_logit_ATO", "ps_logit_ATE_stab", "ps_probit_ATE",
             "cbps_logit_ATE", "cbps_probit_ATT", "ipt_logit_ATC", "ebal_none_ATE", "ebal_none_ATT")
for (s in names(sets)) for (b in balKeys) {
  w <- objs[[sprintf("w_%s_%s", s, b)]]
  if (is.null(w)) next
  out[[sprintf("bal_%s_%s", s, b)]] <- run(c(
    std = list(bal(bal.tab(w, stats = c("mean.diffs", "variance.ratios"), thresholds = c(m = 0.1, v = 2), un = TRUE,
                           binary = "std", continuous = "std"))),
    raw = list(bal(bal.tab(w, un = TRUE)))))
}

## svyglm with svydesign(ids = ~1, weights), binomial and gaussian
svy <- function(m) { s <- summary(m)
  list(coef = unname(coef(m)), names = names(coef(m)), vcov = as.vector(vcov(m)),
       table = as.vector(s$coefficients), df.residual = m$df.residual, dispersion = as.numeric(s$dispersion),
       deviance = as.numeric(m$deviance), null.deviance = as.numeric(m$null.deviance), aic = as.numeric(m$aic),
       iter = m$iter, converged = m$converged) }
svyCases <- list(sim = list(c("y", "gaussian"), c("yb", "binomial"), c("yb", "quasibinomial")),
                 lalonde = list(c("re78", "gaussian"), c("emp78", "binomial")))
for (s in names(svyCases)) for (b in c("ps_logit_ATE", "ps_logit_ATT", "ps_logit_ATO", "ps_logit_ATE_stab")) {
  d <- sets[[s]]; d$w <- objs[[sprintf("w_%s_%s", s, b)]]$weights
  des <- svydesign(ids = ~1, weights = ~w, data = d)
  for (cs in svyCases[[s]]) {
    f <- as.formula(paste(cs[1], "~ tr +", paste(covs[[s]], collapse = " + ")))
    fam <- switch(cs[2], gaussian = gaussian(), binomial = binomial(), quasibinomial = quasibinomial())
    out[[sprintf("svyglm_%s_%s_%s_%s", s, b, cs[1], cs[2])]] <- run(svy(svyglm(f, design = des, family = fam)))
  }
}

## survfit(coxph, newdata): ReactiveStat's newdata (treatment 0 and 1, the other covariates at their mean, a factor at
## its most frequent level), the weights of ps/logit ATE, Efron and Breslow, robust and not, and unweighted
sf <- function(v, times) { ss <- summary(v); st <- summary(v, times = times)
  list(time = v$time, n.risk = v$n.risk, n.event = v$n.event, n.censor = v$n.censor, surv = as.vector(v$surv),
       std.err = as.vector(v$std.err), lower = as.vector(v$lower), upper = as.vector(v$upper),
       cumhaz = as.vector(v$cumhaz), table = mat(ss$table), times = times, atTime = st$time,
       atSurv = as.vector(st$surv), atStdErr = as.vector(st$std.err), atLower = as.vector(st$lower),
       atUpper = as.vector(st$upper), atNRisk = as.vector(st$n.risk), atNEvent = as.vector(st$n.event)) }
cx <- function(m) list(coef = unname(coef(m)), var = as.vector(m$var), means = unname(m$means), n = m$n,
                       nevent = m$nevent)
for (s in c("sim", "veteran")) for (wk in c("ATE", "none")) for (ties in c("efron", "breslow")) for (rob in c(TRUE, FALSE)) {
  if (wk == "none" && rob) next
  d <- sets[[s]]
  d$w <- if (wk == "none") rep(1, nrow(d)) else objs[[sprintf("w_%s_ps_logit_ATE", s)]]$weights
  others <- setdiff(covs[[s]], "tr")
  nd <- data.frame(tr = c(0, 1))
  for (v in others) nd[[v]] <- if (is.factor(d[[v]])) factor(rep(names(sort(table(d[[v]]), decreasing = TRUE))[1], 2),
                                                              levels = levels(d[[v]])) else rep(mean(d[[v]]), 2)
  f <- as.formula(paste("Surv(time, status) ~ tr +", paste(others, collapse = " + ")))
  key <- sprintf("survfit_%s_%s_%s_%s", s, wk, ties, if (rob) "robust" else "naive")
  times <- unique(unname(quantile(d$time, c(0.25, 0.5, 0.75))))
  out[[key]] <- run({
    m <- if (wk == "none") coxph(f, data = d, ties = ties) else coxph(f, data = d, weights = w, robust = rob, ties = ties)
    c(list(fit = cx(m), newdata = lapply(nd, function(col) if (is.factor(col)) as.character(col) else col)),
      sf(survfit(m, newdata = nd), times))
  })
}
# the default newdata (no newdata: one curve at the means of the covariates as coxph stores them)
out$survfit_sim_ATE_efron_default <- run({
  d <- sim; d$w <- objs$w_sim_ps_logit_ATE$weights
  m <- coxph(Surv(time, status) ~ tr + x1 + x2 + x3, data = d, weights = w, robust = TRUE)
  c(list(fit = cx(m)), sf(survfit(m), unique(unname(quantile(d$time, c(0.25, 0.5, 0.75)))))) })


## weighted Kaplan-Meier by treatment (ReactiveStat's survfit(Surv(time, status) ~ tr, weights)): the default and robust
## = FALSE, with summary(times) and the table
km <- function(v, times) { ss <- summary(v); st <- summary(v, times = times)
  list(strata = as.vector(v$strata), time = v$time, n.risk = v$n.risk, n.event = v$n.event, n.censor = v$n.censor,
       surv = v$surv, std.err = v$std.err, lower = v$lower, upper = v$upper, cumhaz = v$cumhaz, std.chaz = v$std.chaz,
       logse = v$logse, table = mat(ss$table), times = times, atTime = st$time, atStrata = as.character(st$strata),
       atSurv = st$surv, atStdErr = st$std.err, atNRisk = st$n.risk, atNEvent = st$n.event) }
for (s in c("sim", "veteran")) for (b in c("ps_logit_ATE", "ps_logit_ATO")) for (rob in c("default", "FALSE", "TRUE")) {
  d <- sets[[s]]; d$w <- objs[[sprintf("w_%s_%s", s, b)]]$weights
  times <- unique(unname(quantile(d$time, c(0.25, 0.5, 0.75))))
  out[[sprintf("km_%s_%s_%s", s, b, rob)]] <- run(km(
    if (rob == "default") survfit(Surv(time, status) ~ tr, data = d, weights = w)
    else survfit(Surv(time, status) ~ tr, data = d, weights = w, robust = as.logical(rob)), times))
}

## bal.tab with a two-level factor (how cobalt shows it)
two <- data.frame(tr = sim$tr, x1 = sim$x1, sex = factor(ifelse(sim$x2 == 1, "M", "F")))
w2 <- weightit(tr ~ x1 + sex, data = two, method = "glm", estimand = "ATE")
out$bal_twolevel <- run(list(std = bal(bal.tab(w2, stats = c("mean.diffs", "variance.ratios"), un = TRUE, binary = "std")),
                             weights = unname(w2$weights), sex = as.character(two$sex)))

## inputs R rejects or warns about
out$err_stab_att <- run(wres(weightit(tr ~ x1 + x2, data = sim, method = "glm", estimand = "ATT", stabilize = TRUE)))
out$err_ipt_ato <- run(wres(weightit(tr ~ x1 + x2, data = sim, method = "ipt", estimand = "ATO")))
out$err_ebal_ato <- run(wres(weightit(tr ~ x1 + x2, data = sim, method = "ebal", estimand = "ATO")))
out$warn_cbps_stab <- run(wres(weightit(tr ~ x1 + x2, data = sim, method = "cbps", estimand = "ATE", stabilize = TRUE)))
out$err_one_group <- run(wres(weightit(tr ~ x1, data = data.frame(tr = rep(1, 5), x1 = 1:5), method = "glm")))
out$err_na <- run(wres(weightit(tr ~ x1, data = data.frame(tr = c(0, 1, 0, 1, 1), x1 = c(1, NA, 3, 4, 5)), method = "glm")))
# separation: x1 decides the treatment
sep <- data.frame(tr = c(0, 0, 0, 0, 1, 1, 1, 1), x1 = c(1, 2, 3, 4, 5, 6, 7, 8))
out$warn_separation <- run(wres(weightit(tr ~ x1, data = sep, method = "glm", estimand = "ATE")))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "weightit.json"))
