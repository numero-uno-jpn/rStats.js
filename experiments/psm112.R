# psm112.R: Matching (Match), cobalt (bal.tab), tableone (CreateTableOne) and survival (clogit) on small data, public
# functions only (1.12.0). Settles: how many random numbers Match(ties = FALSE) draws, the unit of the caliper, the
# pairs per estimand, the definitions of the SMD and the variance ratio, and one clogit fit.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
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
out <- list(R = R.version.string, arch = R.version$arch,
            versions = sapply(c("Matching", "cobalt", "tableone", "survival"), function(p) as.character(packageVersion(p))))

## data: 70 subjects, two covariates, treatment from a logistic model; a second X with ties (rounded to 1 decimal)
set.seed(20261124)
n <- 70
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4)
tr <- rbinom(n, 1, plogis(-1.3 + 0.9 * x1 + 0.8 * x2))
d <- data.frame(tr = tr, x1 = x1, x2 = x2)
ps <- fitted(glm(tr ~ x1 + x2, data = d, family = binomial()))
lp <- log(ps / (1 - ps))
lpTies <- round(lp, 1)
out$data <- list(tr = tr, x1 = x1, x2 = x2, lp = lp, lpTies = lpTies)

# the number of uniform draws Match consumed: compare .Random.seed after Match with the state after k runif draws
draws <- function(seed, f) {
  set.seed(seed); val <- f(); after <- .Random.seed
  set.seed(seed); k <- 0
  while (k <= 5000 && !identical(.Random.seed, after)) { runif(1); k <- k + 1 }
  list(fit = val, uniformDraws = if (k > 5000) NA else k, nextUniform = { .Random.seed <<- after; runif(1) })
}
mfit <- function(m) if (is.list(m) && !is.null(m$index.treated))
  list(index.treated = m$index.treated, index.control = m$index.control, weights = m$weights,
       index.dropped = m$index.dropped, caliper = m$caliper, ecaliper = m$ecaliper, nobs = m$nobs, wnobs = m$wnobs,
       orig.nobs = m$orig.nobs, orig.treated.nobs = m$orig.treated.nobs, ndrops = m$ndrops, estimand = m$estimand) else list(notMatched = TRUE, value = if (is.atomic(m)) m else NULL)
M1 <- function(X, ...) mfit(Match(Tr = tr, X = X, ties = FALSE, replace = FALSE, ...))

cases <- list(
  att_m1 = list(X = lp, estimand = "ATT", M = 1), att_m2 = list(X = lp, estimand = "ATT", M = 2),
  ate_m1 = list(X = lp, estimand = "ATE", M = 1), atc_m1 = list(X = lp, estimand = "ATC", M = 1),
  att_m1_cal02 = list(X = lp, estimand = "ATT", M = 1, caliper = 0.2),
  att_m2_cal05 = list(X = lp, estimand = "ATT", M = 2, caliper = 0.5),
  ties_att_m1 = list(X = lpTies, estimand = "ATT", M = 1), ties_att_m2 = list(X = lpTies, estimand = "ATT", M = 2),
  ties_ate_m1 = list(X = lpTies, estimand = "ATE", M = 1),
  ties_att_m1_cal02 = list(X = lpTies, estimand = "ATT", M = 1, caliper = 0.2))
for (nm in names(cases)) {
  a <- cases[[nm]]
  out$match[[nm]] <- run(draws(1234, function() do.call(M1, a)))
}
# the same tied case with two other seeds, and with ties = TRUE (the full tie sets) for comparison
out$match$ties_att_m1_seed1 <- run(draws(1, function() M1(lpTies, estimand = "ATT", M = 1)))
out$match$ties_att_m1_seed2 <- run(draws(2, function() M1(lpTies, estimand = "ATT", M = 1)))
out$tiesTrue <- run(mfit(Match(Tr = tr, X = lpTies, estimand = "ATT", M = 1, ties = TRUE, replace = TRUE)))
# candidates for the unit of the caliper
out$sd <- list(sdX = sd(lp), popSdX = sqrt(mean((lp - mean(lp))^2)), sdTreated = sd(lp[tr == 1]),
               sdControl = sd(lp[tr == 0]))

## balance: bal.tab on the ATT M = 1 match, before and after, mean differences and variance ratios
set.seed(1234); m <- Match(Tr = tr, X = lp, estimand = "ATT", M = 1, ties = FALSE, replace = FALSE)
bt <- run({ b <- bal.tab(m, formula = tr ~ x1 + x2, data = d, un = TRUE, disp.v.ratio = TRUE, binary = "std")
            list(Balance = lapply(as.list(b$Balance), function(v) if (is.numeric(v)) v else as.character(v)),
                 rows = rownames(b$Balance), observations = as.list(as.data.frame(b$Observations)), obsRows = rownames(b$Observations)) })
out$balTab <- bt
btRaw <- run({ b <- bal.tab(m, formula = tr ~ x1 + x2, data = d, un = TRUE, disp.v.ratio = TRUE)
               list(Balance = lapply(as.list(b$Balance), function(v) if (is.numeric(v)) v else as.character(v)),
                    rows = rownames(b$Balance)) })
out$balTabDefault <- btRaw
# tableone SMD before and after (matched data as ReactiveStat builds it: the rows of the pairs)
idx <- c(m$index.treated, m$index.control)
md <- d[idx, ]; md$grp <- factor(md$tr)
out$tableone <- run(list(
  pre = as.vector(ExtractSmd(CreateTableOne(vars = c("x1", "x2"), strata = "tr", data = d, factorVars = "x2", test = FALSE))),
  post = as.vector(ExtractSmd(CreateTableOne(vars = c("x1", "x2"), strata = "grp", data = md, factorVars = "x2", test = FALSE))),
  preNumeric = as.vector(ExtractSmd(CreateTableOne(vars = c("x1", "x2"), strata = "tr", data = d, test = FALSE)))))
# hand-made candidates to compare with (means and SDs by group)
g <- function(v, w) list(m1 = mean(v[w == 1]), m0 = mean(v[w == 0]), s1 = sd(v[w == 1]), s0 = sd(v[w == 0]))
out$moments <- list(pre_x1 = g(d$x1, d$tr), pre_x2 = g(d$x2, d$tr), post_x1 = g(md$x1, md$tr), post_x2 = g(md$x2, md$tr))

## clogit on the matched pairs (an outcome made up for the purpose), default method and "breslow"
set.seed(7)
md$y <- rbinom(nrow(md), 1, plogis(-0.2 + 0.7 * md$tr + 0.5 * md$x1))
md$pair <- c(seq_along(m$index.treated), seq_along(m$index.control))
cl <- function(fit) list(coef = unname(coef(fit)), var = as.vector(fit$var), loglik = fit$loglik,
                         score = fit$score, wald = fit$wald.test, n = fit$n, nevent = fit$nevent,
                         method = fit$method, iter = fit$iter,
                         summaryCoef = as.vector(summary(fit)$coefficients),
                         conf = as.vector(summary(fit)$conf.int), concordance = unname(fit$concordance))
out$clogit <- list(
  exact = run(cl(clogit(y ~ tr + x1 + strata(pair), data = md))),
  breslow = run(cl(clogit(y ~ tr + x1 + strata(pair), data = md, method = "breslow"))),
  approximate = run(cl(clogit(y ~ tr + x1 + strata(pair), data = md, method = "approximate"))),
  efron = run(cl(clogit(y ~ tr + x1 + strata(pair), data = md, method = "efron"))))
out$clogitData <- list(y = md$y, tr = md$tr, x1 = md$x1, pair = md$pair)

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
