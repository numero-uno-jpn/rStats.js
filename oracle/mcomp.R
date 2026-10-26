source("/oracle/_anova.R")
suppressPackageStartupMessages({library(PMCMRplus); library(dunn.test); library(multcomp)})

# Multiple comparisons (ROADMAP: Steel-Dwass, Dunn, Dunnett, Steel). Fixtures, one case per row of `cases`:
#   mcompPMCMR  (reference: the exact p-values of dunnettTest and of the single-step kwManyOneDunnTest)
#               PMCMRplus: fn one of dscfAllPairsTest (Steel-Dwass-Critchlow-Fligner), steelTest (Steel's many-one),
#               kwAllPairsDunnTest, kwManyOneDunnTest, dunnettTest, gamesHowellTest, tukeyTest; args x (values), g
#               (group labels), and p.adjust.method / alternative where given. Written: method, statistic and
#               p.value (matrices as arrays of rows, NA for the empty cells), rowNames, colNames, p.adjust.method.
#   mcompDunn   dunn.test::dunn.test(x, g, method, kw = FALSE, table = FALSE, altp): chi2 (Kruskal-Wallis), Z, P,
#               P.adjusted, comparisons.
#   mcompDunnett multcomp: summary(glht(aov(y ~ g), linfct = mcp(g = "Dunnett"))), with set.seed(1) before the call
#               (mvtnorm's integration is randomised): estimate, se, t, p (R's p-values are only about 1e-5 accurate:
#               the exact values follow from a one-dimensional integral, see ROADMAP), and PMCMRplus::pDunnett-free
#               reference p-values computed by that integral ("reference").
# The groups are given as labels; the first level (sorted) is the control for the many-one tests. PMCMRplus 1.9.12's
# steelTest fails on every input here (two-sided is not allowed; balanced data: "'data' must be of a vector type";
# unbalanced: "only valid for balanced designs"), so its cases record only these errors.

set.seed(20261120)
mkg <- function(sizes, shifts, sd = 1) {
  g <- rep(paste0("g", seq_along(sizes)), sizes)
  list(x = round(unlist(Map(function(n, s) rnorm(n, 10 + s, sd), sizes, shifts)), 2), g = g)
}
d1 <- mkg(c(8, 8, 8), c(0, 0.8, 1.5))
d2 <- mkg(c(6, 9, 7, 8), c(0, 0.3, 1.2, 0.5))
d3 <- mkg(c(10, 10, 10, 10, 10), c(0, 0, 0.6, 1, 1.4), sd = 1.5)
ties <- list(x = c(1, 2, 2, 3, 3, 3, 4, 2, 3, 3, 4, 5, 5, 6, 4, 5, 6, 6, 7, 7), g = rep(c("a", "b", "c"), c(7, 7, 6)))
datasets <- list(d1, d2, d3, ties)

# Dunnett's p-values exactly: the statistics t_i = (mean_i - mean_0) / (s sqrt(1/n_i + 1/n_0)) have correlations
# rho_ij = sqrt(lambda_i lambda_j) with lambda_i = n_i / (n_i + n_0), so P(max |t_i| < c) is the integral over the
# pooled sd ratio u (chi with df degrees of freedom, scaled) and a standard normal z0 of
#   prod_i [Phi((z0 sqrt(lambda_i) + c u) / sqrt(1 - lambda_i)) - Phi((z0 sqrt(lambda_i) - c u) / sqrt(1 - lambda_i))].
# The double integral (z0 inner, u outer) is computed with integrate at rel.tol 1e-13.
dunnett_p <- function(c, lambda, df, alternative) {
  inner <- function(u) vapply(u, function(uu) {
    f <- function(z) {
      pr <- 1
      for (l in lambda) {
        s <- sqrt(1 - l)
        pr <- pr * if (alternative == "two.sided") pnorm((z * sqrt(l) + c * uu) / s) - pnorm((z * sqrt(l) - c * uu) / s)
                   else pnorm((z * sqrt(l) + c * uu) / s)
      }
      pr * dnorm(z)
    }
    integrate(f, -Inf, Inf, rel.tol = 1e-13, subdivisions = 2000)$value
  }, 0)
  if (is.infinite(df)) return(1 - inner(1))
  dens <- function(u) exp(log(2) + (df / 2) * log(df / 2) - lgamma(df / 2) + (df - 1) * log(u) - df * u^2 / 2)
  1 - integrate(function(u) inner(u) * dens(u), 0, Inf, rel.tol = 1e-12, subdivisions = 2000)$value
}

pcases <- list()
addp <- function(...) pcases[[length(pcases) + 1]] <<- list(...)
for (d in datasets) {
  for (fn in c("dscfAllPairsTest", "kwAllPairsDunnTest", "gamesHowellTest", "tukeyTest")) addp(fn = fn, x = I(d$x), g = I(d$g))
  for (adj in c("holm", "bonferroni", "none", "BH")) addp(fn = "kwAllPairsDunnTest", x = I(d$x), g = I(d$g), p.adjust.method = adj)
  for (fn in c("steelTest", "kwManyOneDunnTest", "dunnettTest")) for (alt in c("two.sided", "greater", "less"))
    addp(fn = fn, x = I(d$x), g = I(d$g), alternative = alt)
}

write_anova_fixture("mcompPMCMR", pcases, function(a) {
  args <- list(x = unclass(a$x), g = factor(unclass(a$g)))
  for (k in c("p.adjust.method", "alternative")) if (!is.null(a[[k]])) args[[k]] <- a[[k]]
  r <- with_warnings(function() suppressMessages(do.call(get(a$fn, envir = asNamespace("PMCMRplus")), args)))
  v <- r$value
  m <- function(M) lapply(seq_len(nrow(M)), function(i) I(num2str(M[i, ])))
  list(method = v$method, statistic = m(as.matrix(v$statistic)), p.value = m(as.matrix(v$p.value)),
       rowNames = I(rownames(as.matrix(v$p.value))), colNames = I(colnames(as.matrix(v$p.value))),
       p.adjust.method = v$p.adjust.method, warnings = r$warnings)
}, ref = function(a) {
  # dunnettTest and the single-step kwManyOneDunnTest compute multivariate t / normal probabilities with mvtnorm's
  # randomised integration; their exact values follow from the one-dimensional integral above (correlations
  # sqrt(lambda_i lambda_j), lambda_i = n_i / (n_i + n_0)), with PMCMRplus's definitions: two-sided p = min(1, 2
  # P(max t_i >= |t|)) for dunnettTest and P(max |z_i| >= |z|) for kwManyOneDunnTest; greater P(max >= t); less
  # P(min <= t) = P(max >= -t) by symmetry
  single <- a$fn == "kwManyOneDunnTest" && (is.null(a$p.adjust.method) || a$p.adjust.method == "single-step")
  if (!(a$fn == "dunnettTest" || single)) return(NULL)
  args <- list(x = unclass(a$x), g = factor(unclass(a$g)))
  if (!is.null(a$alternative)) args$alternative <- a$alternative
  v <- tryCatch(suppressWarnings(suppressMessages(do.call(get(a$fn, envir = asNamespace("PMCMRplus")), args))), error = function(e) NULL)
  if (is.null(v)) return(NULL)
  n <- table(args$g); lam <- as.numeric(n[-1] / (n[-1] + n[[1]]))
  df <- if (a$fn == "dunnettTest") length(args$x) - length(n) else Inf
  alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
  st <- as.vector(v$statistic)
  p <- vapply(st, function(t) switch(alt,
    two.sided = if (a$fn == "dunnettTest") min(1, 2 * dunnett_p(abs(t), lam, df, "greater")) else dunnett_p(abs(t), lam, df, "two.sided"),
    greater = dunnett_p(t, lam, df, "greater"), less = dunnett_p(-t, lam, df, "greater")), 0)
  list(p.value = lapply(p, function(x) I(num2str(x))))
})

dcases <- list()
for (d in datasets) for (method in c("none", "bonferroni", "sidak", "holm", "hs", "hochberg", "bh", "by"))
  for (altp in c(FALSE, TRUE)) dcases[[length(dcases) + 1]] <- list(x = I(d$x), g = I(d$g), method = method, altp = altp)

write_anova_fixture("mcompDunn", dcases, function(a) {
  r <- with_warnings(function() {
    out <- utils::capture.output(v <- dunn.test(unclass(a$x), unclass(a$g), method = a$method, kw = FALSE,
                                                table = FALSE, altp = a$altp))
    v
  })
  v <- r$value
  list(chi2 = num2str(v$chi2), Z = I(num2str(v$Z)), P = I(num2str(if (a$altp) v$altP else v$P)),
       P.adjusted = I(num2str(if (a$altp) v$altP.adjusted else v$P.adjusted)), comparisons = I(v$comparisons),
       warnings = r$warnings)
})

ncases <- list()
for (d in datasets) for (alt in c("two.sided", "greater")) ncases[[length(ncases) + 1]] <- list(x = I(d$x), g = I(d$g), alternative = alt)

write_anova_fixture("mcompDunnett", ncases, function(a) {
  dat <- data.frame(y = unclass(a$x), g = factor(unclass(a$g)))
  fit <- aov(y ~ g, dat)
  set.seed(1)
  s <- summary(glht(fit, linfct = mcp(g = "Dunnett"), alternative = a$alternative))
  list(names = I(names(s$test$coefficients)), estimate = I(num2str(unname(s$test$coefficients))),
       se = I(num2str(unname(s$test$sigma))), t = I(num2str(unname(s$test$tstat))), p = I(num2str(unname(s$test$pvalues))),
       df = num2str(fit$df.residual))
}, ref = function(a) {
  dat <- data.frame(y = unclass(a$x), g = factor(unclass(a$g)))
  fit <- aov(y ~ g, dat); n <- table(dat$g); n0 <- n[[1]]; lam <- as.numeric(n[-1] / (n[-1] + n0))
  set.seed(1)
  s <- summary(glht(fit, linfct = mcp(g = "Dunnett"), alternative = a$alternative))
  ts <- unname(s$test$tstat)
  p <- vapply(ts, function(t) dunnett_p(if (a$alternative == "two.sided") abs(t) else t, lam, fit$df.residual, a$alternative), 0)
  list(p = I(num2str(p)))
})
