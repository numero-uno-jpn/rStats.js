# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages(library(cmprsk))

# Fine-Gray regression of the subdistribution hazard: cmprsk::crr, summary.crr and predict.crr (fixture crr).
# Behaviour in oracle/competing-behaviour.md. x86_64 R, as oracle/coxph.R (Newton-Raphson: the last bits of the
# iterations differ between platforms). The API of rStats.js is not decided yet, so the fixture keeps R's names.
#   Arguments: ftime, fstatus (numbers, or strings with fstatusType "character"), cov1 (matrix, rows = observations;
#   "NA" for a missing value), and optionally cov2 (matrix) with tf (one of the time functions below, by name:
#   "t" = u, "logt" = log(u), "t,t2" = cbind(u, u^2), "t,logt" = cbind(u, log(u))), cengroup (labels), failcode,
#   cencode, subset (booleans), gtol, maxiter, init, variance (FALSE), confLevel (summary's conf.int), newCov1 /
#   newCov2 (matrices for predict.crr).
#   Written: coefNames, coef, loglik, loglikNull, score, inf, var, invinf (NaN matrices when variance = FALSE),
#   converged, n, nMissing, uftime, bfitj, res (matrix: rows = unique failure times, as R), tfs (matrix; R's 1 x 1
#   zero without cov2); summary: se, z, pValue (unrounded 2 pnorm(-|z|)), pSummary (summary.crr's rounded p-value),
#   expCoef, lower, upper (conf.int of exp(coef) at confLevel, default 0.95), logtest (test, df); predict (only
#   with newCov1/newCov2: R's matrix, first column the unique failure times); omitted (R's printed count of rows
#   dropped for missing values, 0 when none); warnings. Errors as {"error": message}.

TF <- list("t" = function(u) u, "logt" = function(u) log(u), "t,t2" = function(u) cbind(u, u^2),
           "t,logt" = function(u) cbind(u, log(u)))

set.seed(20261110)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

# the example of the help page
set.seed(10)
ft <- rexp(200); fs <- sample(0:2, 200, replace = TRUE); cv <- matrix(runif(600), nrow = 200)
add(ftime = I(ft), fstatus = I(fs), cov1 = cv, newCov1 = rbind(c(.1, .5, .8), c(.1, .5, .2)))
add(ftime = I(ft), fstatus = I(fs), cov1 = cv, failcode = 2)
add(ftime = I(ft), fstatus = I(fs), cov1 = cv, cov2 = cbind(cv[, 1], cv[, 1]), tf = "t,t2")
set.seed(20261110)
sim <- function(n, p, tie = FALSE) {
  x <- matrix(round(rnorm(n * p), 3), n)
  t <- rexp(n, 0.2 * exp(0.5 * x[, 1])); c <- rexp(n, 0.08)
  st <- ifelse(t <= c, sample(1:2, n, TRUE, prob = c(0.6, 0.4)), 0); tm <- pmin(t, c)
  tm <- if (tie) ceiling(tm) else round(tm, 6)
  list(ftime = tm, fstatus = st, cov1 = x)
}
s1 <- sim(60, 1); s2 <- sim(120, 2); s3 <- sim(250, 3); t2 <- sim(150, 2, tie = TRUE)
addd <- function(d, ...) add(ftime = I(d$ftime), fstatus = I(d$fstatus), cov1 = d$cov1, ...)
addd(s1); addd(s2); addd(s3); addd(t2)
addd(s2, confLevel = 0.9); addd(s2, failcode = 2)
addd(s2, newCov1 = rbind(c(0, 0), c(1, -1), c(-2, 0.5)))
addd(t2, newCov1 = rbind(c(0, 0), c(1, -1)))
# the iterations: init, maxiter 0, 1, 2, gtol
addd(s2, init = I(c(0.3, -0.2))); addd(s2, maxiter = 0, init = I(c(0.3, -0.2))); addd(s2, maxiter = 0)
addd(s2, maxiter = 1); addd(s2, maxiter = 2); addd(s2, gtol = 1e-3); addd(s2, gtol = 1e-12)
addd(s2, maxiter = 0, init = I(unname(crr(s2$ftime, s2$fstatus, s2$cov1)$coef)))   # converged at init
# covariates with |coef| > 1 (the convergence criterion scales the score by max(|coef|, 1))
s4 <- s3; s4$cov1 <- s4$cov1 * 0.05; addd(s4); addd(s4, gtol = 1e-4)
# scaling: times by 2^-40 and 2^40 (invariant), a covariate by 2^10
addd(list(ftime = s2$ftime * 2^-40, fstatus = s2$fstatus, cov1 = s2$cov1))
addd(list(ftime = s2$ftime * 2^40, fstatus = s2$fstatus, cov1 = s2$cov1))
addd(list(ftime = s2$ftime, fstatus = s2$fstatus, cov1 = s2$cov1 * c(2^10, 1)))
# a 0/1 covariate and a monotone likelihood (coefficient towards infinity: not converged after 10 iterations)
s5 <- s2; s5$cov1[, 2] <- as.numeric(s5$cov1[, 2] > 0); addd(s5)
addd(list(ftime = s1$ftime, fstatus = s1$fstatus, cov1 = cbind(as.numeric(s1$fstatus == 1))))
addd(list(ftime = s1$ftime, fstatus = s1$fstatus, cov1 = cbind(as.numeric(s1$fstatus == 1))), maxiter = 3)
# time-varying effects (cov2, tf)
addd(s2, cov2 = s2$cov1[, 1, drop = FALSE], tf = "t")
addd(s2, cov2 = s2$cov1[, c(1, 1)], tf = "t,logt")
addd(s2, cov2 = s2$cov1[, 1, drop = FALSE], tf = "logt", newCov1 = rbind(c(0, 0), c(1, -1)), newCov2 = rbind(0, 1))
add(ftime = I(s2$ftime), fstatus = I(s2$fstatus), cov2 = s2$cov1, tf = "t,t2")                # cov2 only
addd(t2, cov2 = t2$cov1[, 2, drop = FALSE], tf = "t")
# censoring groups (point estimates and the log pseudo-likelihood are described; the variance is not determined)
cg <- sample(c("a", "b", "c"), 120, TRUE); addd(s2, cengroup = I(cg))
addd(t2, cengroup = I(sample(1:2, 150, TRUE)))
addd(list(ftime = c(3, 3, 3, 3, 3, 4, 4, 5), fstatus = c(0, 0, 1, 2, 0, 1, 1, 1),
          cov1 = cbind(c(-0.84, -2.62, 0.89, -0.71, 0.18, 1.76, -0.27, -0.08))), cengroup = I(c(2, 1, 1, 2, 1, 2, 2, 1)))
# codes, subsets, missing values
addd(list(ftime = s2$ftime, fstatus = c(9, 1, 2)[s2$fstatus + 1], cov1 = s2$cov1), cencode = 9)
add(ftime = I(s2$ftime), fstatus = I(c("cens", "relapse", "death")[s2$fstatus + 1]), fstatusType = "character",
    cov1 = s2$cov1, failcode = "relapse", cencode = "cens")
addd(s2, subset = I(s2$ftime > 1))
s6 <- s2; s6$ftime[3] <- NA; s6$cov1[7, 2] <- NA; addd(s6)
addd(s2, variance = FALSE)
addd(list(ftime = s1$ftime, fstatus = rep(1, 60), cov1 = s1$cov1))                  # no censoring, no competing
addd(list(ftime = c(1, 2, 3, 4, 5), fstatus = c(1, 2, 1, 0, 1), cov1 = cbind(c(0.5, -1, 2, 0, 1))))  # tiny
# errors
addd(list(ftime = s2$ftime, fstatus = ifelse(s2$fstatus == 1, 2, s2$fstatus), cov1 = s2$cov1))  # no failures of failcode
addd(s2, failcode = 3)
addd(list(ftime = s2$ftime, fstatus = s2$fstatus, cov1 = cbind(s2$cov1, 1)))        # constant covariate
addd(list(ftime = s2$ftime, fstatus = s2$fstatus, cov1 = cbind(s2$cov1, 2 * s2$cov1[, 1])))  # collinear

mrows <- function(m) lapply(seq_len(nrow(m)), function(i) I(num2str(m[i, ])))

run <- function(a) {
  args <- list(ftime = unclass(a$ftime), fstatus = unclass(a$fstatus))
  if (!is.null(a$cov1)) args$cov1 <- a$cov1
  if (!is.null(a$cov2)) { args$cov2 <- a$cov2; args$tf <- TF[[a$tf]] }
  if (!is.null(a$cengroup)) args$cengroup <- unclass(a$cengroup)
  for (nm in c("failcode", "cencode", "gtol", "maxiter", "variance")) if (!is.null(a[[nm]])) args[[nm]] <- a[[nm]]
  if (!is.null(a$init)) args$init <- unclass(a$init)
  if (!is.null(a$subset)) args$subset <- unclass(a$subset)
  # call crr with symbols (crr names the coefficients from the deparsed arguments: cov1 gives "cov11", "cov12", ...)
  env <- list2env(args, parent = environment())
  cl <- as.call(c(list(quote(crr)), sapply(names(args), as.name, simplify = FALSE)))
  out <- capture.output(z <- eval(cl, env))
  om <- regmatches(out, regexpr("^[0-9]+(?= cases omitted)", out, perl = TRUE))
  p <- length(z$coef)
  nanm <- function(m) if (is.null(m) || all(is.na(m))) matrix(NaN, p, p) else m
  res <- list(coefNames = I(names(z$coef)), coef = I(num2str(unname(z$coef))), loglik = num2str(z$loglik),
              loglikNull = num2str(z$loglik.null), score = I(num2str(z$score)), inf = mrows(nanm(z$inf)),
              var = mrows(nanm(z$var)), invinf = mrows(nanm(z$invinf)), converged = z$converged, n = z$n,
              nMissing = z$n.missing, uftime = I(num2str(z$uftime)), bfitj = I(num2str(z$bfitj)),
              res = if (is.null(z$res)) NULL else mrows(as.matrix(z$res)), tfs = mrows(as.matrix(z$tfs)))
  if (isTRUE(a$variance) || is.null(a$variance)) {
    s <- summary(z, conf.int = if (is.null(a$confLevel)) 0.95 else a$confLevel)
    se <- sqrt(diag(z$var)); zz <- z$coef / se
    res$se <- I(num2str(unname(se))); res$z <- I(num2str(unname(zz))); res$pValue <- I(num2str(unname(2 * pnorm(-abs(zz)))))
    res$pSummary <- I(num2str(unname(s$coef[, "p-value"]))); res$expCoef <- I(num2str(unname(s$conf.int[, 1])))
    res$lower <- I(num2str(unname(s$conf.int[, 3]))); res$upper <- I(num2str(unname(s$conf.int[, 4])))
    res$logtest <- I(num2str(unname(s$logtest)))
  }
  if (!is.null(a$newCov1) || !is.null(a$newCov2)) {
    pa <- list(z); if (!is.null(a$newCov1)) pa$cov1 <- a$newCov1; if (!is.null(a$newCov2)) pa$cov2 <- a$newCov2
    res$predict <- mrows(do.call(predict, pa))
  }
  res$omitted <- if (length(om)) as.integer(om) else 0L
  res
}

write_anova_fixture("crr", cases, function(a) {
  r <- tryCatch(with_warnings(function() run(a)),
                error = function(e) list(value = list(error = conditionMessage(e)), warnings = I(character(0))))
  c(r$value, list(warnings = r$warnings))
})
