source("/oracle/_anova.R")
suppressPackageStartupMessages({library(car); library(clinfun); library(DescTools); library(nortest)})

# More tests (ROADMAP): fixture moreTests, one case per call. fn and its arguments:
#   leveneTest       car::leveneTest(y ~ g, center = "median" | "mean"): table (Df, F value, Pr(>F))
#   prop.trend.test  stats: x, n, score (optional): htest fields
#   jonckheere.test  clinfun::jonckheere.test(x, g as ordered scores, alternative, nperm = NULL): statistic, p.value
#   JonckheereTerpstraTest  DescTools (exact = NULL, alternative): htest fields
#   CochranQTest     DescTools::CochranQTest(y matrix of 0/1, rows blocks): htest fields
#   ad.test, lillie.test, cvm.test, sf.test, pearson.test  nortest: htest fields
# Written as htest_fields(), or {table} for leveneTest; warnings.

set.seed(20261121)
g3 <- rep(c("a", "b", "c"), c(8, 10, 9)); y3 <- round(rnorm(27, 5, rep(c(1, 2, 1.3), c(8, 10, 9))), 2)
g4 <- rep(c("p", "q", "r", "s"), each = 6); y4 <- round(rnorm(24, 3 + rep(0:3, each = 6) * 0.4), 2)
yt <- c(1, 2, 2, 3, 3, 3, 4, 2, 3, 3, 4, 5, 5, 6, 4, 5, 6, 6, 7, 7); gt <- rep(c("a", "b", "c"), c(7, 7, 6))
cases <- list()
add <- function(.fn, ...) cases[[length(cases) + 1]] <<- c(list(fn = .fn), list(...))
for (d in list(list(y3, g3), list(y4, g4), list(yt, gt))) for (ctr in c("median", "mean"))
  add("leveneTest", y = I(d[[1]]), g = I(d[[2]]), center = ctr)
add("prop.trend.test", x = I(c(15, 10, 8, 4)), n = I(c(30, 30, 30, 30)))
add("prop.trend.test", x = I(c(83, 90, 129, 70)), n = I(c(86, 93, 136, 82)))
add("prop.trend.test", x = I(c(15, 10, 8, 4)), n = I(c(30, 30, 30, 30)), score = I(c(0, 1, 2, 5)))
for (d in list(list(y4, g4), list(yt, gt), list(y3, g3))) for (alt in c("two.sided", "increasing", "decreasing")) {
  add("jonckheere.test", x = I(d[[1]]), g = I(d[[2]]), alternative = alt)
}
for (d in list(list(y4, g4), list(yt, gt))) for (alt in c("two.sided", "increasing", "decreasing"))
  add("JonckheereTerpstraTest", x = I(d[[1]]), g = I(d[[2]]), alternative = alt)
add("JonckheereTerpstraTest", x = I(y4[1:12]), g = I(g4[1:12]), alternative = "two.sided", exact = TRUE)
cq <- matrix(c(1,1,0, 1,0,0, 1,1,1, 0,0,0, 1,1,0, 1,0,1, 1,1,0, 0,1,0, 1,1,1, 1,0,0, 1,1,0, 1,0,0), ncol = 3, byrow = TRUE)
add("CochranQTest", y = cq)
add("CochranQTest", y = cq[, 1:2])
for (fn in c("ad.test", "lillie.test", "cvm.test", "sf.test", "pearson.test")) {
  add(fn, x = I(y3)); add(fn, x = I(round(rexp(40), 3))); add(fn, x = I(yt))
}

write_anova_fixture("moreTests", cases, function(a) {
  r <- with_warnings(function() {
    switch(a$fn,
      leveneTest = tab_out(car::leveneTest(y ~ g, data.frame(y = unclass(a$y), g = factor(unclass(a$g))), center = a$center)),
      prop.trend.test = htest_fields(if (is.null(a$score)) prop.trend.test(unclass(a$x), unclass(a$n))
                                     else prop.trend.test(unclass(a$x), unclass(a$n), unclass(a$score))),
      jonckheere.test = { v <- clinfun::jonckheere.test(unclass(a$x), as.integer(factor(unclass(a$g))), alternative = a$alternative)
        list(statistic = num2str(unname(v$statistic)), pValue = num2str(v$p.value), method = v$method) },
      JonckheereTerpstraTest = htest_fields(DescTools::JonckheereTerpstraTest(unclass(a$x), ordered(unclass(a$g)),
                                            alternative = a$alternative, exact = a$exact)),
      CochranQTest = htest_fields(DescTools::CochranQTest(a$y)),
      htest_fields(get(a$fn, envir = asNamespace("nortest"))(unclass(a$x))))
  })
  c(r$value, list(warnings = r$warnings))
})
