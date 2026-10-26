source("/oracle/_anova.R")
suppressPackageStartupMessages({library(irr); library(psych); library(polycor); library(GPArotation)})

# Agreement, reliability and correlation (ROADMAP). Fixture agreement, one case per call; fn and arguments:
#   kappa2         irr::kappa2(ratings (n x 2), weight = "unweighted" | "equal" | "squared"): value, statistic, p.value
#   kappam.fleiss  irr::kappam.fleiss(ratings (n x raters), exact): value, statistic, p.value
#   icc            irr::icc(ratings, model = "oneway" | "twoway", type = "consistency" | "agreement", unit = "single" |
#                  "average", conf.level): value, Fvalue, df1, df2, p.value, lbound, ubound
#   alpha          psych::alpha(x): raw_alpha, std.alpha, G6(smc), average_r (the "total" row), and alpha if each item
#                  is dropped (raw_alpha column of alpha.drop)
#   omega          psych::omega(x, nfactors, fm = "minres" by default, plot = FALSE): omega_h, alpha, omega.tot
#   partial.r      psych::partial.r(x, xy = c(i, j), z = the others): the partial correlation matrix of i and j
#   polychor       polycor::polychor(table or x, y, ML, std.err): rho, and var and the thresholds with ML / std.err
#   polyserial     polycor::polyserial(x numeric, y ordinal, ML, std.err): rho
# Written: the listed values; warnings. "reference": the kappa p-values computed without cancellation.

set.seed(20261124)
n <- 60
truth <- sample(1:4, n, TRUE)
r1 <- pmin(4, pmax(1, truth + sample(c(-1, 0, 0, 0, 1), n, TRUE)))
r2 <- pmin(4, pmax(1, truth + sample(c(-1, 0, 0, 1), n, TRUE)))
r3 <- pmin(4, pmax(1, truth + sample(c(-1, 0, 0, 0, 0, 1), n, TRUE)))
R2 <- cbind(r1, r2); R3 <- cbind(r1, r2, r3)
cont <- round(cbind(truth + rnorm(n, 0, 0.5), truth + rnorm(n, 0.3, 0.7), truth + rnorm(n, -0.2, 0.6), truth * 0.5 + rnorm(n)), 2)
items <- round(matrix(rnorm(n * 6), n) + truth, 2)
cases <- list()
add <- function(.fn, ...) cases[[length(cases) + 1]] <<- c(list(fn = .fn), list(...))
for (w in c("unweighted", "equal", "squared")) add("kappa2", ratings = R2, weight = w)
add("kappam.fleiss", ratings = R3); add("kappam.fleiss", ratings = R3, exact = TRUE)
for (model in c("oneway", "twoway")) for (type in c("consistency", "agreement")) for (unit in c("single", "average"))
  add("icc", ratings = cont, model = model, type = type, unit = unit)
add("icc", ratings = cont, model = "twoway", type = "agreement", unit = "single", conf.level = 0.9)
add("alpha", x = items); add("alpha", x = cont)
add("omega", x = items, nfactors = 3); add("omega", x = cbind(items, cont), nfactors = 2)
add("partial.r", x = cont, i = 1, j = 2); add("partial.r", x = items, i = 2, j = 5)
tab <- table(r1, r2)
for (ML in c(FALSE, TRUE)) {
  add("polychor", x = I(r1), y = I(r2), ML = ML, std.err = ML)
  add("polychor", x = I(as.integer(r1 > 2)), y = I(as.integer(r2 > 2)), ML = ML, std.err = ML)   # tetrachoric
  add("polyserial", x = I(cont[, 1]), y = I(r2), ML = ML, std.err = ML)
}

write_anova_fixture("agreement", cases, function(a) {
  r <- with_warnings(function() switch(a$fn,
    kappa2 = { v <- kappa2(a$ratings, weight = a$weight); list(value = num2str(v$value), statistic = num2str(v$statistic), p.value = num2str(v$p.value)) },
    kappam.fleiss = { v <- kappam.fleiss(a$ratings, exact = isTRUE(a$exact)); list(value = num2str(v$value), statistic = num2str(v$statistic), p.value = num2str(v$p.value)) },
    icc = { v <- icc(a$ratings, model = a$model, type = a$type, unit = a$unit, conf.level = if (is.null(a$conf.level)) 0.95 else a$conf.level)
      list(value = num2str(v$value), Fvalue = num2str(v$Fvalue), df1 = num2str(v$df1), df2 = num2str(v$df2),
           p.value = num2str(v$p.value), lbound = num2str(v$lbound), ubound = num2str(v$ubound)) },
    alpha = { v <- suppressMessages(psych::alpha(a$x)); tot <- v$total
      list(raw_alpha = num2str(tot$raw_alpha), std.alpha = num2str(tot$std.alpha), G6 = num2str(tot[["G6(smc)"]]),
           average_r = num2str(tot$average_r), alpha.drop = I(num2str(v$alpha.drop$raw_alpha))) },
    omega = { v <- suppressMessages(psych::omega(a$x, nfactors = a$nfactors, plot = FALSE))
      list(omega_h = num2str(v$omega_h), alpha = num2str(v$alpha), omega.tot = num2str(v$omega.tot)) },
    partial.r = { x <- a$x; colnames(x) <- paste0("v", seq_len(ncol(x)))
      z <- setdiff(seq_len(ncol(x)), c(a$i, a$j)); v <- psych::partial.r(as.data.frame(x), c(a$i, a$j), z)
      list(r = num2str(unclass(v)[1, 2])) },
    polychor = { v <- polychor(unclass(a$x), unclass(a$y), ML = a$ML, std.err = a$std.err)
      if (is.numeric(v)) list(rho = num2str(v)) else list(rho = num2str(v$rho), var = I(num2str(as.vector(v$var))),
                                                          row.cuts = I(num2str(v$row.cuts)), col.cuts = I(num2str(v$col.cuts))) },
    polyserial = { v <- polyserial(unclass(a$x), unclass(a$y), ML = a$ML, std.err = a$std.err)
      if (is.numeric(v)) list(rho = num2str(v)) else list(rho = num2str(v$rho), var = I(num2str(as.vector(v$var))), cuts = I(num2str(v$cuts))) }))
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  # irr forms the p-values as 2 (1 - pnorm(|z|)), which loses the small ones; the reference is 2 pnorm(-|z|)
  if (!(a$fn %in% c("kappa2", "kappam.fleiss"))) return(NULL)
  v <- if (a$fn == "kappa2") kappa2(a$ratings, weight = a$weight) else kappam.fleiss(a$ratings, exact = isTRUE(a$exact))
  if (is.null(v$statistic)) return(NULL)
  list(p.value = num2str(2 * pnorm(-abs(v$statistic))))
})
