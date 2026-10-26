source("/oracle/_anova.R")

# Formula interfaces of the hypothesis tests and the missing-value helpers (ROADMAP: data handling). Behaviour in
# oracle/formulatests-behaviour.md. Fixture formulaTests, one case per row:
#   fn       the R function: a test (t.test, wilcox.test, var.test, ansari.test, mood.test, ks.test, kruskal.test,
#            fligner.test, bartlett.test, oneway.test, friedman.test, quade.test, cor.test) called as
#            fn(formula, data = data, <options>), or complete.cases(data) / na.omit(data).
#   formula  the formula as a string; data: a data frame (format of oracle/_anova.R, with dataTypes); options: the
#            other arguments (R's names).
#   Written: the htest fields (oracle/_htest.R) for a test; for complete.cases the logical vector (complete); for
#   na.omit the remaining data frame (data, same format) and the 1-based row numbers dropped (omitted, empty when
#   none). Errors as {"error": message}.

set.seed(20261201)
n <- 24
d1 <- data.frame(y = round(rnorm(n, 10, 2), 2), g = rep(c("ctl", "trt"), each = 12),
                 g3 = rep(c("lo", "mid", "hi"), 8), k = rep(c(3, 1, 2), each = 8),
                 x = round(rnorm(n), 2), z = round(rnorm(n), 2))
d1$y[d1$g == "trt"] <- d1$y[d1$g == "trt"] + 1.3
d1$z <- round(d1$z + 0.6 * d1$x, 2)
dna <- d1
dna$y[c(3, 17)] <- NA; dna$g[5] <- NA; dna$g3[9] <- NA; dna$x[20] <- NA
pairs <- data.frame(before = round(rnorm(10, 5), 2), after = round(rnorm(10, 5.6), 2))
pairs$after[4] <- NA
two <- data.frame(y = round(rnorm(30, 20, 3), 1), A = rep(c("p", "q"), 15), B = rep(c("u", "v", "w"), each = 10))
two$y[two$A == "q" & two$B == "w"] <- two$y[two$A == "q" & two$B == "w"] + 4
blk <- data.frame(y = round(rnorm(18, 50, 5), 1), w = rep(c("t1", "t2", "t3"), 6), b = rep(paste0("s", 1:6), each = 3))
blk$y[blk$w == "t3"] <- blk$y[blk$w == "t3"] + 3
blkna <- blk; blkna$y[7] <- NA
mix <- data.frame(a = c(1, NA, 3, 4, 5), s = c("u", "v", NA, "w", "u"), f = c(TRUE, FALSE, TRUE, NA, FALSE),
                  b = c(2.5, 3.5, 1, 2, NaN))

cases <- list()
add <- function(fn, formula, data, ...) cases[[length(cases) + 1]] <<- list(fn = fn, formula = formula, data = data, options = list(...))
for (d in list(d1, dna)) {
  add("t.test", "y ~ g", d)
  add("t.test", "y ~ g", d, var.equal = TRUE, alternative = "less", conf.level = 0.9)
  add("t.test", "y ~ 1", d, mu = 10)
  add("wilcox.test", "y ~ g", d)
  add("wilcox.test", "y ~ g", d, exact = FALSE, correct = FALSE, conf.int = TRUE)
  add("var.test", "y ~ g", d)
  add("ansari.test", "y ~ g", d)
  add("mood.test", "y ~ g", d)
  add("ks.test", "y ~ g", d)
  add("kruskal.test", "y ~ g3", d)
  add("kruskal.test", "y ~ k", d)
  add("fligner.test", "y ~ g3", d)
  add("bartlett.test", "y ~ g3", d)
  add("oneway.test", "y ~ g3", d)
  add("oneway.test", "y ~ g3", d, var.equal = TRUE)
  add("cor.test", "~ x + z", d)
  add("cor.test", "~ x + z", d, method = "kendall")
  add("cor.test", "~ x + z", d, method = "spearman", alternative = "greater")
}
add("t.test", "Pair(before, after) ~ 1", pairs)
add("wilcox.test", "Pair(before, after) ~ 1", pairs)
add("t.test", "y ~ g3", d1)                      # three groups: error
add("t.test", "y ~ g", d1, paired = TRUE)        # error
add("oneway.test", "y ~ A + B", two)             # the interaction of A and B
add("kruskal.test", "y ~ A + B", two)            # error
add("friedman.test", "y ~ w | b", blk)
add("quade.test", "y ~ w | b", blk)
add("friedman.test", "y ~ w | b", blkna)         # the row with NA y is dropped first: not a complete block design
add("friedman.test", "y ~ w", blk)               # error
add("complete.cases", NULL, mix); add("na.omit", NULL, mix)
add("complete.cases", NULL, dna); add("na.omit", NULL, dna); add("na.omit", NULL, d1)
# (added later, at the end) numeric group labels with the same 15-digit text are one group
dg <- data.frame(y = c(3.1, 2.4, 5.6, 4.4, 6.1, 1.9, 7.3, 5.2, 4.8),
                 g = c(0.1 + 0.2, 0.3, 0.3, 0.7, 0.1 * 7, 0.7, 1e15, 1e15 + 1, 1e15))
add("kruskal.test", "y ~ g", dg)
add("oneway.test", "y ~ g", dg)
add("fligner.test", "y ~ g", dg)

write_anova_fixture("formulaTests", cases, function(a) {
  d <- a$data
  if (a$fn == "complete.cases") return(list(complete = I(complete.cases(d))))
  if (a$fn == "na.omit") {
    r <- na.omit(d); om <- attr(r, "na.action")
    rownames(r) <- NULL
    return(list(data = df_json(r), omitted = I(if (is.null(om)) integer(0) else as.integer(unname(om)))))
  }
  args <- c(list(as.formula(a$formula), data = d), a$options)
  htest_fields(do.call(get(a$fn, envir = asNamespace("stats")), args))
})
