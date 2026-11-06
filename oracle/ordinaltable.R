source("/oracle/_htest.R")

# Tests and measures of r×c tables (see oracle/contingency-behaviour.md):
#   gTest                DescTools::GTest (independence and goodness of fit; correct = none, williams, yates)
#   stuartMaxwellTest    DescTools::StuartMaxwellTest
#   goodmanKruskalGamma  DescTools::GoodmanKruskalGamma (with and without the interval)
#   lblTest              coin::lbl_test on a table, asymptotic, default scores (Z and the three p-values)
#   chisqTestN1          the 'N-1' chi-squared test (Campbell 2007): Pearson's X² (chisq.test, correct = FALSE)
#                        times (N - 1) / N, with mantelhaen.test(correct = FALSE) on the table as a 2×2×1 array, which
#                        gives the same statistic for a 2×2 table, as a check
#   freemanTukey         Freeman-Tukey deviates sqrt(O) + sqrt(O + 1) - sqrt(4 E + 1) (Bishop, Fienberg and Holland
#                        1975, 14.7) with E from chisq.test, and the variant 2 (sqrt(O) - sqrt(E)); no R package in
#                        the image offers them, so these are the formulas evaluated by R
# Reference: GTest's p-value of a table is 1 - pchisq(G, df), which is 0 below 1.1e-16; the reference is the upper
# tail pchisq(G, df, lower.tail = FALSE).

suppressPackageStartupMessages({ library(DescTools); library(coin) })

set.seed(20261106)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
mat <- function(nr, v) matrix(v, nr, byrow = TRUE)
tabs <- list(mat(2, c(12, 5, 7, 9)), mat(2, c(12, 7, 3, 5, 9, 11)), mat(3, c(20, 3, 2, 4, 15, 6, 1, 5, 30)),
             mat(2, c(0, 1, 0, 1)), mat(2, c(5, 5, 5, 5)), mat(2, c(1000, 0, 0, 1000)), mat(2, c(12, 7, 3, 0, 0, 0)),
             mat(3, c(10, 5, 2, 3, 8, 6, 1, 4, 9)), mat(2, c(3, 1, 1, 3)), mat(4, c(5, 3, 2, 1, 4, 6, 3, 2, 2, 3, 7, 4, 1, 2, 3, 8)),
             mat(2, c(500, 300, 300, 500)), mat(3, c(1, 0, 0, 0, 1, 0, 0, 0, 1)), mat(2, c(0, 5, 3, 0)),
             mat(2, c(1e5, 2e5, 3e5, 4e5)))
for (i in 1:6) {
  nr <- sample(2:4, 1); nc <- sample(2:5, 1)
  tabs[[length(tabs) + 1]] <- matrix(rpois(nr * nc, sample(c(2, 8, 30), 1)), nr)
}

# ---- gTest ----
for (x in tabs) for (cr in c("none", "williams", "yates")) add(x = x, correct = cr)
gof <- list(c(10, 20, 30), c(10, 20), c(0, 5, 10), c(30, 10), c(15, 15), c(50, 49), c(1, 2, 3, 4, 5, 6))
for (v in gof) for (cr in c("none", "williams", "yates")) add(x = v, correct = cr)
add(x = c(10, 20, 30), p = c(0.2, 0.3, 0.5))
add(x = c(10, 20, 30), p = c(1, 2, 3), rescaleP = TRUE)
add(x = c(10, 20, 30), p = c(0.2, 0.3, 0.4))
add(x = c(10, 20), p = c(0.25, 0.75), correct = "yates")
add(x = c(10, 20, 30), correct = "w")
add(x = c(10, 20, 30), correct = "foo")
add(x = c(0, 0, 0))
add(x = 5)
add(x = c(10, -1, 30))
add(x = c(10.5, 20, 30))
add(x = c(10, NaN, 30))
add(x = matrix(0, 2, 2))
add(x = mat(2, c(1, -2, 3, 4)))
g_ref <- function(a) {
  r <- suppressWarnings(tryCatch(call_with(GTest, list(x = a$x, correct = a$correct, p = a$p,
                                                       rescale.p = a$rescaleP)), error = function(e) NULL))
  if (is.null(r) || !is.matrix(a$x)) return(NULL)
  list(pValue = num2str(pchisq(unname(r$statistic), unname(r$parameter), lower.tail = FALSE)))
}
write_htest_fixture("gTest", cases, function(a) {
  r <- call_with(GTest, list(x = a$x, correct = a$correct, p = a$p, rescale.p = a$rescaleP))
  f <- htest_fields(r)
  f$observed <- num_or_vec(r$observed)
  f$expected <- num_or_vec(r$expected)
  f
}, g_ref, warnings = TRUE)

# ---- stuartMaxwellTest ----
cases <- list()
sq <- list(mat(3, c(20, 3, 2, 4, 15, 6, 1, 5, 30)), mat(3, c(10, 0, 0, 0, 5, 3, 0, 2, 8)),
           mat(3, c(10, 0, 0, 0, 5, 0, 0, 0, 8)), mat(2, c(10, 5, 2, 8)), mat(3, c(5, 1, 0, 2, 5, 0, 0, 0, 0)),
           mat(4, c(35, 5, 2, 1, 4, 40, 6, 2, 1, 7, 30, 5, 0, 2, 6, 25)), mat(3, c(1, 2, 3, 4, 5, 6, 7, 8, 9)),
           mat(2, c(0, 0, 0, 0)), mat(2, c(5, 0, 0, 0)), mat(3, c(0, 4, 0, 0, 0, 4, 4, 0, 0)),
           mat(3, c(0, 4, 0, 0, 0, 3, 5, 0, 0)), mat(3, c(10, 2, 3, 2, 10, 4, 3, 4, 10)))
for (i in 1:4) { k <- sample(3:5, 1); sq[[length(sq) + 1]] <- matrix(rpois(k * k, 6), k) + diag(rpois(k, 20)) }
for (x in sq) add(x = x)
add(x = mat(2, c(1, 2, 3, 4, 5, 6)))
add(x = mat(2, c(1, -2, 3, 4)))
add(x = mat(2, c(1, NaN, 3, 4)))
add(x = matrix(5, 1, 1))
write_htest_fixture("stuartMaxwellTest", cases, function(a) {
  r <- StuartMaxwellTest(a$x)
  f <- htest_fields(r)
  f$N <- num2str(r$N)
  f
}, warnings = TRUE)

# ---- goodmanKruskalGamma ----
cases <- list()
gt <- list(mat(3, c(10, 5, 2, 3, 8, 6, 1, 4, 9)), mat(2, c(5, 0, 0, 5)), mat(2, c(5, 5, 5, 5)), mat(2, c(5, 5, 0, 0)),
           mat(2, c(0, 5, 5, 0)), mat(3, c(1, 0, 0, 0, 1, 0, 0, 0, 1)), mat(2, c(12, 7, 3, 5, 9, 11)),
           mat(4, c(5, 3, 2, 1, 4, 6, 3, 2, 2, 3, 7, 4, 1, 2, 3, 8)), mat(2, c(500, 300, 300, 500)), mat(1, c(1, 2, 3)),
           mat(2, c(3, 1, 1, 3)))
for (i in 1:4) gt[[length(gt) + 1]] <- matrix(rpois(12, 5), 3)
for (x in gt) {
  add(x = x)
  add(x = x, confLevel = 0.95)
  add(x = x, confLevel = 0.9)
}
add(x = gt[[1]], confLevel = 0.999999)
add(x = gt[[1]], confLevel = 1)
add(x = gt[[1]], confLevel = 0)
write_htest_fixture("goodmanKruskalGamma", cases, function(a) {
  r <- if (is.null(a$confLevel)) GoodmanKruskalGamma(a$x) else GoodmanKruskalGamma(a$x, conf.level = a$confLevel)
  if (length(r) == 1) list(gamma = num2str(unname(r))) else
    list(gamma = num2str(r[["gamma"]]), lwr.ci = num2str(r[["lwr.ci"]]), upr.ci = num2str(r[["upr.ci"]]))
}, warnings = TRUE)

# ---- lblTest ----
cases <- list()
lt <- list(mat(3, c(10, 5, 2, 3, 8, 6, 1, 4, 9)), mat(3, c(10, 0, 2, 3, 0, 6, 1, 0, 9)), mat(2, c(10, 5, 2, 3, 8, 6)),
           mat(3, c(10, 3, 5, 8, 2, 6)), mat(2, c(10, 5, 2, 3)), mat(4, c(5, 3, 2, 1, 4, 6, 3, 2, 2, 3, 7, 4, 1, 2, 3, 8)),
           mat(3, c(0, 0, 0, 1, 2, 3, 4, 5, 6)), mat(3, c(5, 5, 5, 5, 5, 5, 5, 5, 5)),
           mat(3, c(10, 0, 0, 0, 10, 0, 0, 0, 10)), mat(5, c(20, 10, 5, 2, 15, 15, 8, 4, 10, 12, 12, 9, 5, 8, 14, 15, 2, 4, 9, 22)))
for (i in 1:4) lt[[length(lt) + 1]] <- matrix(rpois(12, 6), 3)
for (x in lt) add(x = x)
write_htest_fixture("lblTest", cases, function(a) {
  tb <- as.table(a$x)
  r <- lbl_test(tb)
  list(method = r@method, statistic = num2str(unname(statistic(r))),
       pValue = num2str(as.numeric(pvalue(r))),
       pValueLess = num2str(as.numeric(pvalue(lbl_test(tb, alternative = "less")))),
       pValueGreater = num2str(as.numeric(pvalue(lbl_test(tb, alternative = "greater")))))
}, warnings = TRUE)

# ---- chisqTestN1 ----
cases <- list()
for (x in tabs) add(x = x)
write_htest_fixture("chisqTestN1", cases, function(a) {
  x <- a$x
  r <- chisq.test(x, correct = FALSE)
  N <- sum(x)
  stat <- unname(r$statistic) * (N - 1) / N
  out <- list(statistic = num2str(stat), parameter = num2str(unname(r$parameter)),
              pValue = num2str(pchisq(stat, unname(r$parameter), lower.tail = FALSE)),
              pearson = num2str(unname(r$statistic)))
  if (all(dim(x) == 2)) {
    mh <- tryCatch(mantelhaen.test(array(x, c(2, 2, 1)), correct = FALSE), error = function(e) NULL)
    if (!is.null(mh)) {
      out$mantelhaen.statistic <- num2str(unname(mh$statistic))
      out$mantelhaen.pValue <- num2str(mh$p.value)
    }
  }
  out
}, warnings = TRUE)

# ---- freemanTukey ----
write_htest_fixture("freemanTukey", cases, function(a) {
  x <- a$x
  E <- suppressWarnings(chisq.test(x, correct = FALSE))$expected
  ft <- sqrt(x) + sqrt(x + 1) - sqrt(4 * E + 1)
  list(expected = num_or_vec(E), residuals = num_or_vec(ft), statistic = num2str(sum(ft^2)),
       residualsSimple = num_or_vec(2 * (sqrt(x) - sqrt(E))), statisticSimple = num2str(sum(4 * (sqrt(x) - sqrt(E))^2)))
}, warnings = TRUE)
