source("/oracle/_htest.R")

# Equivalence of two proportions as the compared application tests it: equivalence::tost (Welch's two one-sided t
# tests) on 0/1 data (fixture tost). The data are given as counts: group x has x1 ones among n1 values, group y x2
# among n2; the R vectors are c(rep(1, x1), rep(0, n1 - x1)) and the same for y. Fields are tost's own.
# For the alternatives (TOST with Wald or score statistics), whose duals are the intervals of binomDiffCI at level
# 1 - 2 alpha, see oracle/contingency-behaviour.md.

suppressPackageStartupMessages(library(equivalence))

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
data <- list(c(40, 50, 35, 50), c(80, 100, 78, 100), c(45, 50, 44, 50), c(5, 50, 4, 50), c(150, 200, 140, 210),
             c(9, 10, 3, 10), c(0, 10, 1, 10), c(10, 10, 9, 10), c(1, 2, 1, 3), c(500, 1000, 480, 1000))
for (v in data) for (eps in c(0.1, 0.2)) {
  add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], epsilon = eps)
  add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], epsilon = eps, confLevel = 0.9)
}
add(x1 = 40, n1 = 50, x2 = 35, n2 = 50)                     # default epsilon 1
add(x1 = 40, n1 = 50, x2 = 35, n2 = 50, epsilon = 0.2, alpha = 0.1)
add(x1 = 40, n1 = 50, x2 = 35, n2 = 50, epsilon = 0.2, varEqual = TRUE)
add(x1 = 5, n1 = 5, x2 = 5, n2 = 5, epsilon = 0.2)           # both constant
add(x1 = 0, n1 = 5, x2 = 5, n2 = 5, epsilon = 0.2)
add(x1 = 5, n1 = 5, x2 = 4, n2 = 5, epsilon = 0.2)           # one group constant
add(x1 = 1, n1 = 1, x2 = 4, n2 = 5, epsilon = 0.2)           # one observation
add(x1 = 40, n1 = 50, x2 = 35, n2 = 50, epsilon = 0.2, confLevel = 1.5)
# pooled standard error with unequal sizes (where it differs from Welch's), and paired tests (the pairs are the
# elements in order: x1 ones then zeros against x2 ones then zeros)
add(x1 = 30, n1 = 40, x2 = 50, n2 = 80, epsilon = 0.2, varEqual = TRUE)
add(x1 = 3, n1 = 10, x2 = 9, n2 = 30, epsilon = 0.3, varEqual = TRUE)
add(x1 = 40, n1 = 50, x2 = 35, n2 = 50, epsilon = 0.2, paired = TRUE)
add(x1 = 8, n1 = 20, x2 = 11, n2 = 20, epsilon = 0.25, paired = TRUE, confLevel = 0.9)

write_htest_fixture("tost", cases, function(a) {
  x <- c(rep(1, a$x1), rep(0, a$n1 - a$x1)); y <- c(rep(1, a$x2), rep(0, a$n2 - a$x2))
  r <- call_with(tost, list(x = x, y = y, epsilon = a$epsilon, conf.level = a$confLevel, alpha = a$alpha,
                            var.equal = a$varEqual, paired = a$paired))
  list(method = r$method, parameter = num2str(unname(r$parameter)), tostPValue = num2str(r$tost.p.value),
       result = r$result, tostInterval = I(num2str(as.vector(r$tost.interval))),
       confLevel = num2str(attr(r$tost.interval, "conf.level")), estimate = I(num2str(unname(r$estimate))),
       estimateNames = I(names(r$estimate)),
       seDiff = num2str(r$se.diff), epsilon = num2str(r$epsilon))
}, warnings = TRUE)
