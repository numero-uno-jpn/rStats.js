source("/oracle/_htest.R")

# R's warnings of the tests in each situation where R's code warns (fixture htestWarnings, test/htestWarnings.test.ts):
# the situations that the grids of the other fixtures may miss. Each case is an R call (args$r) and an id that the test
# maps to the rStats.js call; expected has R's warnings (each once, in R's order) and, where R stops after them, its
# error (rError). Only the warnings are recorded: the values are compared in the fixtures of each test.
# Made with the local R as well (node scripts/fixture-warnings.mjs --run htestwarnings): the warnings are texts.

cases <- list()
add <- function(id, r) cases[[length(cases) + 1]] <<- list(id = id, r = r)

# wilcox.test
add("wilcoxTest: one sample, ties", "wilcox.test(c(1,2,2,3,4,5))")
add("wilcoxTest: one sample, ties, interval", "wilcox.test(c(1,2,2,3,4,5), conf.int = TRUE)")
add("wilcoxTest: one sample, zero", "wilcox.test(c(0,1,2,3,4,5))")
add("wilcoxTest: one sample, zero, interval", "wilcox.test(c(0,1,2,3,4,5), conf.int = TRUE)")
add("wilcoxTest: one sample, ties and zero, interval", "wilcox.test(c(0,1,2,2,3,4,5), conf.int = TRUE)")
add("wilcoxTest: one sample, ties, exact false, interval", "wilcox.test(c(1,2,2,3,4,5), exact = FALSE, conf.int = TRUE)")
add("wilcoxTest: one sample, exact interval not achievable", "wilcox.test(c(1.1,2.3,3.6), conf.int = TRUE)")
add("wilcoxTest: one sample, exact interval not achievable, less", "wilcox.test(c(1.1,2.3,3.6), conf.int = TRUE, alternative = \"less\")")
add("wilcoxTest: one sample, exact interval", "wilcox.test(c(1.1,2.3,3.6,4.2,5.9,6.1,7.7), conf.int = TRUE)")
add("wilcoxTest: one sample, normal interval not achievable", "wilcox.test(c(1.1,2.3,3.6), conf.int = TRUE, exact = FALSE)")
add("wilcoxTest: one sample, ties, interval not achievable", "wilcox.test(c(1,2,2,3), conf.int = TRUE)")
add("wilcoxTest: one sample, all tied, interval", "wilcox.test(c(2,2,2), conf.int = TRUE)")
add("wilcoxTest: one sample, all tied, exact false, interval", "wilcox.test(c(2,2,2), conf.int = TRUE, exact = FALSE)")
add("wilcoxTest: one sample, one non-zero, interval", "wilcox.test(c(0,3), conf.int = TRUE)")
add("wilcoxTest: one sample, ties, n >= 50, interval", "wilcox.test(c(1:50, 3), conf.int = TRUE)")
add("wilcoxTest: paired, ties, interval", "wilcox.test(c(1,2,3,4,5), c(0,0,1,2,3), paired = TRUE, conf.int = TRUE)")
add("wilcoxTest: two samples, ties", "wilcox.test(c(1,2,3), c(3,4,5))")
add("wilcoxTest: two samples, ties, interval", "wilcox.test(c(1,2,3), c(3,4,5), conf.int = TRUE)")
add("wilcoxTest: two samples, ties after the shift", "wilcox.test(c(1,2,3), c(0,4,5), mu = 1)")
add("wilcoxTest: two samples, all tied", "wilcox.test(c(1,1), c(1,1))")
add("wilcoxTest: two samples, exact interval not achievable", "wilcox.test(c(1.1,2.2), c(3.3,4.4), conf.int = TRUE)")
add("wilcoxTest: two samples, exact interval not achievable, greater",
    "wilcox.test(c(1.1,2.2), c(3.3,4.4), conf.int = TRUE, alternative = \"greater\")")
add("wilcoxTest: two samples, normal interval", "wilcox.test(c(1.1,2.2), c(3.3,4.4), conf.int = TRUE, exact = FALSE)")
add("wilcoxTest: formula, ties, interval",
    "wilcox.test(y ~ g, data.frame(y = c(1,2,3,3,4,5), g = c('a','a','a','b','b','b')), conf.int = TRUE)")

# ansari.test
add("ansariTest: ties", "ansari.test(c(1,2,3,4), c(2,5,6,7))")
add("ansariTest: ties, interval", "ansari.test(c(1,2,3,4), c(2,5,6,7), conf.int = TRUE)")
add("ansariTest: ties, exact true, interval", "ansari.test(c(1,2,3,4), c(2,5,6,7), exact = TRUE, conf.int = TRUE)")
add("ansariTest: ties, exact false, interval", "ansari.test(c(1,2,3,4), c(2,5,6,7), exact = FALSE, conf.int = TRUE)")
add("ansariTest: ties, m >= 50", "ansari.test(c(1:50, 3), c(2,5,6,7))")
add("ansariTest: exact interval", "ansari.test(c(-2,-1,1,2), c(-4,-3,3,4), conf.int = TRUE)")
add("ansariTest: exact interval, location", "ansari.test(c(1.1,2.2,3.3), c(10.5,11.5,12.5), conf.int = TRUE)")
add("ansariTest: exact interval, location, less",
    "ansari.test(c(1.1,2.2,3.3), c(10.5,11.5,12.5), conf.int = TRUE, alternative = \"less\")")
add("ansariTest: exact interval, location, negative y", "ansari.test(c(1,2,3,4.5), c(-1,-2,-3,-4.5), conf.int = TRUE)")
add("ansariTest: exact interval, no positive ratio", "ansari.test(c(1,2,3), c(-1,-2,-4), conf.int = TRUE)")
add("ansariTest: normal interval, location", "ansari.test(c(-2,-1,1,2), c(-4,-3,3,4), conf.int = TRUE, exact = FALSE)")
add("ansariTest: normal interval, location, no estimate",
    "ansari.test(c(1.1,2.2,3.3), c(10.5,11.5,12.5), conf.int = TRUE, exact = FALSE)")
add("ansariTest: normal interval, ties, location", "ansari.test(c(1,1,2,3), c(10,11,11,12), conf.int = TRUE, exact = FALSE)")
add("ansariTest: normal interval, no positive ratio", "ansari.test(c(1,2,3), c(-1,-2,-4), conf.int = TRUE, exact = FALSE)")
add("ansariTest: normal interval, infinite range", "ansari.test(c(1,2,Inf), c(1.5,2.5,-4), conf.int = TRUE, exact = FALSE)")
add("ansariTest: normal interval, infinite range, zero", "ansari.test(c(1,2,3), c(0,2.5,-4), conf.int = TRUE, exact = FALSE)")
add("ansariTest: formula, ties, interval",
    "ansari.test(y ~ g, data.frame(y = c(1,2,3,4,2,5,6,7), g = rep(c('a','b'), each = 4)), conf.int = TRUE)")

# pairwise.wilcox.test (R repeats the warnings of each comparison)
g <- "rep(c('a','b','c'), each = 3)"
add("pairwiseWilcoxTest: no ties", sprintf("pairwise.wilcox.test(c(1.2,2.3,1.8,2.9,3.1,3.6,4.0,4.4,5.2), %s)", g))
add("pairwiseWilcoxTest: ties in every pair", sprintf("pairwise.wilcox.test(c(1,2,2,3,4,5,5,6,7), %s)", g))
add("pairwiseWilcoxTest: ties in one pair", sprintf("pairwise.wilcox.test(c(1,2,3,3.5,4.5,5.5,5.5,6,7), %s)", g))
add("pairwiseWilcoxTest: paired, zeros and ties", sprintf("pairwise.wilcox.test(c(1,2,3,1,2.5,3.5,0.5,2,4), %s, paired = TRUE)", g))

# fisher.test (all.equal's text of the rounding)
add("fisherTest: one count rounded", "fisher.test(matrix(c(3.5,1,1,3), 2, byrow = TRUE))")
add("fisherTest: three counts rounded", "fisher.test(matrix(c(2.5,1.2,0.7,3), 2, byrow = TRUE))")
add("fisherTest: a difference within the tolerance", "fisher.test(matrix(c(3+1e-9,1,1,3), 2, byrow = TRUE))")
add("fisherTest: rounded to 0", "fisher.test(matrix(c(0.4,1,1,3), 2, byrow = TRUE))")
add("fisherTest: a small relative difference", "fisher.test(matrix(c(1000000.4,2,3,4), 2, byrow = TRUE), conf.int = FALSE)")
add("fisherTest: eight digits", "fisher.test(matrix(c(10.3,1,1,3), 2, byrow = TRUE))")
add("fisherTest: 2 x 3", "fisher.test(matrix(c(1.5,2,3,4,5,6.25), 2, byrow = TRUE))")
add("fisherTest: integer counts", "fisher.test(matrix(c(3,1,1,3), 2, byrow = TRUE))")

# chisq.test
add("chisqTest: goodness of fit, expected below 5", "chisq.test(c(3,4,5))")
add("chisqTest: goodness of fit", "chisq.test(c(30,40,50))")
add("chisqTest: goodness of fit, given p", "chisq.test(c(10,10,1), p = c(0.45,0.45,0.1))")
add("chisqTest: goodness of fit, simulated", "set.seed(1); chisq.test(c(3,4,5), simulate.p.value = TRUE)")
add("chisqTest: table", "chisq.test(matrix(c(12,5,7,15), 2))")
add("chisqTest: table, expected below 5", "chisq.test(matrix(c(3,1,1,3), 2))")
add("chisqTest: table, simulated", "set.seed(1); chisq.test(matrix(c(3,1,1,3), 2), simulate.p.value = TRUE)")
add("chisqTest: table, simulated, zero margin", "chisq.test(matrix(c(30,0,10,0,20,0), 2), simulate.p.value = TRUE)")
add("chisqTest: factors", "chisq.test(c('a','b','a','b'), c('u','u','v','v'))")

# prop.test and pairwise.prop.test
add("propTest: one sample", "prop.test(3, 10)")
add("propTest: one sample, expected below 5", "prop.test(2, 8)")
add("propTest: one sample, given p, no correction", "prop.test(5, 10, p = 0.4, correct = FALSE)")
add("propTest: two samples", "prop.test(c(15,25), c(50,50))")
add("propTest: two samples, pooled expected below 5", "prop.test(c(2,5), c(10,10))")
add("propTest: table", "prop.test(matrix(c(2,6,5,5), 2, byrow = TRUE))")
add("propTest: given proportions", "prop.test(c(5,5), c(10,10), p = c(0.3,0.9))")
add("propTest: four samples", "prop.test(c(83,90,129,70), c(86,93,136,82))")
add("pairwisePropTest: none", "pairwise.prop.test(c(15,25,40), c(50,50,50))")
add("pairwisePropTest: every pair", "pairwise.prop.test(c(2,5,40), c(10,10,50))")

# ks.test
x <- "c(0.61,-1.2,0.33,1.57,-0.42,0.08,-0.85,1.1)"
add("ksTest: one sample", sprintf("ks.test(%s, 'pnorm')", x))
add("ksTest: one sample, ties", "ks.test(c(0.2,0.2,0.8), 'punif')")
add("ksTest: one sample, ties, exact true", "ks.test(c(0.2,0.2,0.8), 'punif', exact = TRUE)")
add("ksTest: one sample, ties, exact false", "ks.test(c(0.2,0.2,0.8), 'punif', exact = FALSE)")
add("ksTest: two samples", sprintf("ks.test(%s, c(0.9,2.1,1.4,2.8,1.7,0.4))", x))
add("ksTest: two samples, ties, exact", "ks.test(c(1,2,3,4), c(2,5,6,7))")
add("ksTest: two samples, ties, exact false", "ks.test(c(1,2,3,4), c(2,5,6,7), exact = FALSE)")
add("ksTest: two samples, no ties, exact false", "ks.test(c(1,2,3,4), c(2.5,5,6,7), exact = FALSE)")
add("ksTest: two samples, ties, m n >= 10000", "ks.test(c(1:100, 3), 1:100)")
add("ksTest: formula, ties, exact false",
    "ks.test(y ~ g, data.frame(y = c(1,2,3,4,2,5,6,7), g = rep(c('a','b'), each = 4)), exact = FALSE)")

# cor.test
x <- "c(1,2,3,4,5,6)"
y <- "c(2,1,4,3,7,8)"
tied <- "c(2,1,4,4,7,8)"
flat <- "c(2,2,2,2,2,2)"
add("corTest: pearson", sprintf("cor.test(%s, %s)", x, y))
add("corTest: pearson, constant", sprintf("cor.test(%s, %s)", x, flat))
add("corTest: pearson, infinite value", "cor.test(c(1,2,Inf,4), c(1,2,3,4))")
add("corTest: pearson, infinite constant", "cor.test(c(1,2,3,4), c(Inf,Inf,Inf,Inf))")
add("corTest: pearson, data of 1e-300", "cor.test(c(1e-300,2e-300,3e-300), c(1,2,3))")
add("corTest: pearson, constant of 1e308", "cor.test(c(1e308,1e308,1e308,1e308), 1:4)")
add("corTest: kendall, constant", sprintf("cor.test(%s, %s, method = 'kendall')", x, flat))
add("corTest: kendall, infinite constant", "cor.test(c(1,2,3,4), c(Inf,Inf,Inf,Inf), method = 'kendall')")
add("corTest: kendall, n = 2, constant", "cor.test(c(1,1), c(1,2), method = 'kendall')")
add("corTest: kendall, exact", sprintf("cor.test(%s, %s, method = 'kendall')", x, y))
add("corTest: kendall, ties", sprintf("cor.test(%s, %s, method = 'kendall')", x, tied))
add("corTest: kendall, ties, exact false", sprintf("cor.test(%s, %s, method = 'kendall', exact = FALSE)", x, tied))
add("corTest: kendall, ties, n >= 50", "cor.test(1:60, c(1:59, 59), method = 'kendall')")
add("corTest: spearman, constant", sprintf("cor.test(%s, %s, method = 'spearman')", x, flat))
add("corTest: spearman, infinite constants", "cor.test(c(Inf,Inf,Inf,Inf), c(Inf,Inf,Inf,Inf), method = 'spearman')")
add("corTest: spearman, exact", sprintf("cor.test(%s, %s, method = 'spearman')", x, y))
add("corTest: spearman, ties", sprintf("cor.test(%s, %s, method = 'spearman')", x, tied))
add("corTest: spearman, ties, exact false", sprintf("cor.test(%s, %s, method = 'spearman', exact = FALSE)", x, tied))
add("corTest: spearman, ties, n > 1290", "cor.test(1:1300, c(1:1299, 1299), method = 'spearman')")
add("corTest: spearman, n = 2, exact false", "cor.test(c(1,2), c(2,1), method = 'spearman', exact = FALSE)")
add("corTest: formula, spearman, ties",
    sprintf("cor.test(~ a + b, data.frame(a = %s, b = %s), method = 'spearman')", x, tied))

# effectsize's cohens_d and hedges_g
x <- "c(5.1,4.9,6.2,5.8)"
add("cohensD: two samples", sprintf("effectsize::cohens_d(%s, c(4.1,4.5,3.9,5.0))", x))
add("cohensD: y with 2 values", sprintf("effectsize::cohens_d(%s, c(4,5,4,5))", x))
add("cohensD: y with 2 values and NA", sprintf("effectsize::cohens_d(%s, c(4,5,4,NA))", x))
add("cohensD: NA in x, y with 2 values", "effectsize::cohens_d(c(5.1,NA,6.2,5.8), c(4,5,4,5))")
add("cohensD: paired, y with 2 values", sprintf("effectsize::cohens_d(%s, c(4,5,4,5), paired = TRUE)", x))
add("cohensD: y of 2 values", "effectsize::cohens_d(c(1,2), c(4,5))")
add("cohensD: one sample", sprintf("effectsize::cohens_d(%s)", x))
add("hedgesG: y with 2 values", sprintf("effectsize::hedges_g(%s, c(4,5,4,5))", x))
add("hedgesG: y with 2 values and NA", sprintf("effectsize::hedges_g(%s, c(4,5,4,NA))", x))

# psych::alpha (a matrix without column names, as rStats.js's rows of items)
add("cronbachAlpha: positive items", "psych::alpha(rbind(c(1,2,3), c(2,3,3), c(3,3,4), c(4,5,4), c(2,2,3)))")
add("cronbachAlpha: a constant item", "psych::alpha(rbind(c(1,5,5), c(1,4,4), c(1,3,2), c(1,1,1), c(1,2,4)))")
add("cronbachAlpha: two constant items", "psych::alpha(rbind(c(1,2,3,5,1), c(2,3,3,5,1), c(3,3,4,5,1), c(4,5,4,5,1), c(2,2,3,5,1)))")
add("cronbachAlpha: a negative item", "psych::alpha(rbind(c(1,2,4), c(2,1,3), c(3,4,1), c(4,3,2)))")
add("cronbachAlpha: two negative items, fewer subjects than items", "psych::alpha(rbind(c(1,2,3,4), c(2,3,1,5), c(3,1,2,2)))")
add("cronbachAlpha: two items correlated -1", "psych::alpha(rbind(c(1,3), c(2,2), c(3,1)))")
add("cronbachAlpha: two items correlated 1", "psych::alpha(rbind(c(1,1), c(2,2), c(3,3)))")
add("cronbachAlpha: uncorrelated items and a constant one", "psych::alpha(rbind(c(1,1,5), c(2,2,5), c(3,2,5), c(4,1,5)))")

# The warnings are collected by write_htest_fixture; an error after them is kept as rError (messages and printed
# output, such as psych's list of the negative items, are dropped)
write_htest_fixture("htestWarnings", cases, function(a) {
  err <- NULL
  invisible(capture.output(suppressMessages(tryCatch(eval(parse(text = a$r), envir = new.env()),
                                                     error = function(e) err <<- conditionMessage(e)))))
  if (is.null(err)) list() else list(rError = err)
}, warnings = TRUE)
