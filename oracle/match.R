# issue: 562
# oracle-platform: amd64
# Public outputs of Matching (Match), cobalt (bal.tab), tableone (CreateTableOne/ExtractSmd) and survival (clogit) for
# test/fixtures/match.json (1.12.0). The behaviour and the choices are in oracle/match-behaviour.md. Public calls only.
library(jsonlite)
suppressPackageStartupMessages({ library(Matching); library(cobalt); library(tableone); library(survival) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(versions = sapply(c("Matching", "cobalt", "tableone", "survival"),
                              function(p) as.character(packageVersion(p))))

## data sets: X is the linear predictor logit(PS) of glm(binomial), as ReactiveStat passes it
logitPs <- function(f, d) { ps <- fitted(glm(f, data = d, family = binomial())); unname(log(ps / (1 - ps))) }
set.seed(20261124)
n <- 70; x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4)
sim <- data.frame(tr = rbinom(n, 1, plogis(-1.3 + 0.9 * x1 + 0.8 * x2)), x1 = x1, x2 = x2)
sim$X <- logitPs(tr ~ x1 + x2, sim)
data(lalonde, package = "Matching")
lal <- data.frame(tr = lalonde$treat, age = lalonde$age, educ = lalonde$educ, black = lalonde$black,
                  married = lalonde$married, re74 = lalonde$re74, re75 = lalonde$re75)
lal$X <- logitPs(tr ~ age + educ + black + married + re74 + re75, lal)
# categorical covariates only: many exact ties of X
set.seed(7)
n <- 60; c1 <- rbinom(n, 1, 0.5); c2 <- sample(0:2, n, replace = TRUE)
cat <- data.frame(tr = rbinom(n, 1, plogis(-0.8 + 0.7 * c1 + 0.4 * c2)), c1 = c1, c2 = c2)
cat$X <- logitPs(tr ~ c1 + factor(c2), cat)
sets <- list(sim = sim, lalonde = lal, cat = cat)
covs <- list(sim = c("x1", "x2"), lalonde = c("age", "educ", "black", "married", "re74", "re75"), cat = c("c1", "c2"))
out$data <- lapply(sets, function(d) as.list(d))

## Match: the uniforms consumed (state after the call against k runif draws from set.seed(1234)) and the next uniform
draws <- function() {
  after <- .Random.seed; set.seed(1234); k <- 0
  while (k <= 5000 && !identical(.Random.seed, after)) { runif(1); k <- k + 1 }
  .Random.seed <<- after
  if (k > 5000) NA else k
}
mres <- function(m) list(index.treated = m$index.treated, index.control = m$index.control, weights = m$weights,
                         index.dropped = m$index.dropped, ecaliper = m$ecaliper, nobs = m$nobs, wnobs = m$wnobs,
                         ndrops = m$ndrops, estimand = m$estimand)
matchCase <- function(d, estimand, M, caliper) {
  set.seed(1234)
  m <- if (is.null(caliper)) Match(Tr = d$tr, X = d$X, estimand = estimand, M = M, ties = FALSE, replace = FALSE)
       else Match(Tr = d$tr, X = d$X, estimand = estimand, M = M, ties = FALSE, replace = FALSE, caliper = caliper)
  k <- draws()
  r <- if (is.list(m)) mres(m) else list(notMatched = TRUE)
  c(r, list(uniformDraws = k, nextUniform = runif(1)))
}
fits <- list()
for (s in names(sets)) for (est in c("ATT", "ATE", "ATC")) for (M in 1:3) for (cal in list(NULL, 0.1, 0.2, 0.5)) {
  key <- sprintf("match_%s_%s_m%d_%s", s, est, M, if (is.null(cal)) "nocal" else sprintf("cal%g", cal))
  out[[key]] <- run(matchCase(sets[[s]], est, M, cal))
  set.seed(1234)
  fits[[key]] <- if (is.null(cal)) Match(Tr = sets[[s]]$tr, X = sets[[s]]$X, estimand = est, M = M, ties = FALSE,
                                         replace = FALSE)
                 else Match(Tr = sets[[s]]$tr, X = sets[[s]]$X, estimand = est, M = M, ties = FALSE, replace = FALSE,
                            caliper = cal)
}
# inputs R rejects or warns about
out$match_err_tr_not_binary <- run(mres(Match(Tr = c(0, 1, 2, 0), X = c(1, 2, 3, 4), ties = FALSE, replace = FALSE)))
out$match_err_na_x <- run(mres(Match(Tr = c(0, 1, 1, 0), X = c(1, NA, 3, 4), ties = FALSE, replace = FALSE)))
out$match_err_m0 <- run(mres(Match(Tr = c(0, 1, 1, 0), X = c(1, 2, 3, 4), M = 0, ties = FALSE, replace = FALSE)))
out$match_err_no_control <- run(mres(Match(Tr = c(1, 1, 1), X = c(1, 2, 3), ties = FALSE, replace = FALSE)))
out$match_err_length <- run(mres(Match(Tr = c(0, 1, 1), X = c(1, 2, 3, 4), ties = FALSE, replace = FALSE)))
out$match_none_within_caliper <- run({ set.seed(1234)
  m <- Match(Tr = c(1, 1, 0, 0), X = c(0, 0.1, 5, 5.1), ties = FALSE, replace = FALSE, caliper = 0.01)
  if (is.list(m)) mres(m) else list(notMatched = TRUE, value = as.logical(m), class = class(m)) })

## bal.tab on the Match objects: binary = "std" and the default ("raw"), variance ratios
bal <- function(b) list(rows = rownames(b$Balance), type = as.character(b$Balance$Type),
                        diffUn = b$Balance$Diff.Un, diffAdj = b$Balance$Diff.Adj,
                        vRatioUn = b$Balance$V.Ratio.Un, vRatioAdj = b$Balance$V.Ratio.Adj,
                        obsRows = rownames(b$Observations), obsControl = b$Observations$Control,
                        obsTreated = b$Observations$Treated)
for (key in names(fits)) {
  if (!grepl("_m[12]_(nocal|cal0.2)$", key) || !is.list(fits[[key]])) next
  s <- strsplit(key, "_")[[1]][2]; d <- sets[[s]]
  f <- as.formula(paste("tr ~", paste(covs[[s]], collapse = " + ")))
  out[[sub("^match_", "baltab_", key)]] <- run(c(
    list(weights = unname(get.w(fits[[key]]))),
    std = list(bal(bal.tab(fits[[key]], formula = f, data = d, un = TRUE, disp.v.ratio = TRUE, binary = "std"))),
    raw = list(bal(bal.tab(fits[[key]], formula = f, data = d, un = TRUE, disp.v.ratio = TRUE)))))
}

## tableone: ExtractSmd of two groups, numeric and factor variables
smd <- function(d, vars, strata, factorVars = NULL) {
  t1 <- if (is.null(factorVars)) CreateTableOne(vars = vars, strata = strata, data = d, test = FALSE)
        else CreateTableOne(vars = vars, strata = strata, data = d, factorVars = factorVars, test = FALSE)
  list(vars = vars, factorVars = factorVars, smd = as.vector(ExtractSmd(t1)))
}
for (s in names(sets)) {
  d <- sets[[s]]
  out[[paste0("tableone_", s, "_numeric")]] <- run(smd(d, covs[[s]], "tr"))
}
out$tableone_sim_factor <- run(smd(sim, c("x1", "x2"), "tr", "x2"))
out$tableone_lalonde_factor <- run(smd(lal, covs$lalonde, "tr", c("black", "married")))
out$tableone_cat_factor3 <- run(smd(cat, c("c1", "c2"), "tr", c("c1", "c2")))
# after matching, the rows as ReactiveStat builds them (the treated rows and the control rows of the pairs)
for (key in c("match_sim_ATT_m1_nocal", "match_lalonde_ATT_m1_cal0.2", "match_lalonde_ATT_m2_nocal")) {
  m <- fits[[key]]; s <- strsplit(key, "_")[[1]][2]; d <- sets[[s]]
  md <- d[c(m$index.treated, m$index.control), ]; md$grp <- rep(1:0, each = length(m$index.treated))
  out[[sub("^match_", "tableone_post_", key)]] <- run(c(list(rows = c(m$index.treated, m$index.control)),
                                                     smd(md, covs[[s]], "grp")))
}
# a constant variable, a group of one, missing values
out$tableone_constant <- run(smd(data.frame(g = c(0, 0, 1, 1), v = c(2, 2, 2, 2)), "v", "g"))
out$tableone_na <- run(smd(data.frame(g = c(0, 0, 0, 1, 1, 1), v = c(1, NA, 3, 2, 5, 4)), "v", "g"))

## clogit: exact and approximate, 1:1 and 1:M matched sets, several cases in a set, uninformative sets
cl <- function(fit) { s <- summary(fit)
  list(coef = unname(coef(fit)), var = as.vector(fit$var), loglik = fit$loglik, score = fit$score,
       wald = fit$wald.test, n = fit$n, nevent = fit$nevent, iter = fit$iter, method = fit$method,
       se = unname(s$coefficients[, "se(coef)"]), z = unname(s$coefficients[, "z"]),
       p = unname(s$coefficients[, "Pr(>|z|)"]), lower = unname(s$conf.int[, "lower .95"]),
       upper = unname(s$conf.int[, "upper .95"]), logtest = unname(s$logtest), waldtest = unname(s$waldtest),
       sctest = unname(s$sctest)) }
clCase <- function(f, d, method) run(cl(clogit(f, data = d, method = method)))
pairsData <- function(m, d, seed) {
  md <- d[c(m$index.treated, m$index.control), ]; md$pair <- c(seq_along(m$index.treated), seq_along(m$index.control))
  set.seed(seed); md$y <- rbinom(nrow(md), 1, plogis(-0.3 + 0.6 * md$tr)); md }
p1 <- pairsData(fits$match_sim_ATT_m1_nocal, sim, 11)
p2 <- pairsData(fits$match_lalonde_ATT_m2_nocal, lal, 12)
data(infert, package = "datasets")
for (meth in c("exact", "approximate")) {
  out[[paste0("clogit_pairs_", meth)]] <- clCase(y ~ tr + strata(pair), p1, meth)
  out[[paste0("clogit_pairs_x1_", meth)]] <- clCase(y ~ tr + x1 + strata(pair), p1, meth)
  out[[paste0("clogit_m2_", meth)]] <- clCase(y ~ tr + age + strata(pair), p2, meth)
  out[[paste0("clogit_infert_", meth)]] <- clCase(case ~ spontaneous + induced + strata(stratum), infert, meth)
  # several cases per set (ties in the exact likelihood)
  set.seed(13); dd <- data.frame(s = rep(1:8, each = 5), x = round(rnorm(40), 2))
  dd$y <- as.integer(ave(dd$x + rnorm(40), dd$s, FUN = function(v) rank(v) > 3))
  out[[paste0("clogit_multi_", meth)]] <- clCase(y ~ x + strata(s), dd, meth)
  out[[paste0("clogit_multi_data_", meth)]] <- list(value = as.list(dd))
}
out$clogit_pairs_data <- list(value = as.list(p1[, c("y", "tr", "x1", "pair")]))
out$clogit_m2_data <- list(value = as.list(p2[, c("y", "tr", "age", "pair")]))
out$clogit_infert_data <- list(value = as.list(infert[, c("case", "spontaneous", "induced", "stratum")]))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "match.json"))
