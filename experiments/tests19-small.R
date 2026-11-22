# tests19-small.R: PMCMRplus 1.9.12 (tamhaneT2Test, pageTest) and outliers 0.15 (grubbs.test, pgrubbs, qgrubbs) on
# small data and boundary cases, public functions only (1.9.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
suppressMessages(library(PMCMRplus))
library(outliers)
library(jsonlite)
# Helpers (the same in each script): run() records the value, the warnings, the messages and the error of one call
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(m))
# the parts of an htest-like result, as numbers and strings
ht <- function(r) list(method = r$method, statistic = r$statistic, statisticNames = names(r$statistic),
                       parameter = r$parameter, parameterNames = names(r$parameter), p.value = r$p.value,
                       alternative = r$alternative, estimate = r$estimate, null.value = r$null.value)
# pairwise results: the lower-triangular matrices of statistics and p-values
pw <- function(r) list(method = r$method, statistic = tab(r$statistic), p.value = tab(r$p.value),
                       p.adjust.method = r$p.adjust.method, dist = r$dist, alternative = r$alternative)
out <- list()

## Tamhane's T2 (all pairs, unequal variances)
for (w in c(TRUE, FALSE)) {
  tag <- if (w) "welch" else "T2prime"
  out[[paste0("t2_PlantGrowth_", tag)]] <- run(pw(tamhaneT2Test(PlantGrowth$weight, PlantGrowth$group, welch = w)))
  out[[paste0("t2_InsectSprays_", tag)]] <- run(pw(tamhaneT2Test(InsectSprays$count, InsectSprays$spray, welch = w)))
  out[[paste0("t2_chickwts_", tag)]] <- run(pw(tamhaneT2Test(chickwts$weight, chickwts$feed, welch = w)))
}
out$t2_formula_na <- run(pw(tamhaneT2Test(Ozone ~ factor(Month), data = airquality)))
out$t2_list <- run(pw(tamhaneT2Test(list(a = c(1, 3, 2, 5), b = c(10, 12, 9, 14, 11), c = c(4, 4.5, 6)))))
out$t2_two_groups <- run(pw(tamhaneT2Test(c(1, 2, 4, 3, 8, 9, 12, 10), rep(c("x", "y"), each = 4))))
out$t2_aov <- run(pw(tamhaneT2Test(aov(weight ~ group, data = PlantGrowth))))
out$t2_alternative_greater <- run(pw(tamhaneT2Test(PlantGrowth$weight, PlantGrowth$group, alternative = "greater")))
out$t2_p_adjust_holm <- run(pw(tamhaneT2Test(PlantGrowth$weight, PlantGrowth$group, p.adjust.method = "holm")))
out$t2_group_of_one <- run(pw(tamhaneT2Test(c(1, 2, 3, 10, 11, 12, 5), c(1, 1, 1, 2, 2, 2, 3))))
out$t2_zero_variance <- run(pw(tamhaneT2Test(c(1, 1, 1, 5, 6, 7, 9, 10, 12), rep(1:3, each = 3))))
out$t2_all_equal <- run(pw(tamhaneT2Test(rep(2, 9), rep(1:3, each = 3))))
out$t2_large_scale <- run(pw(tamhaneT2Test(PlantGrowth$weight * 1e100, PlantGrowth$group)))
out$t2_shift <- run(pw(tamhaneT2Test(PlantGrowth$weight + 1e8, PlantGrowth$group)))

## Page's test (ordered alternative, blocks x treatments)
# Page (1963)-style matrix: rows are blocks, columns are treatments in the hypothesised order
m1 <- matrix(c(3.4, 4.1, 4.8, 5.0,
               2.9, 3.0, 3.8, 4.4,
               3.1, 3.9, 3.7, 4.9,
               2.5, 3.6, 4.0, 4.1,
               3.0, 2.8, 4.5, 4.6), nrow = 5, byrow = TRUE)
for (alt in c("two.sided", "greater", "less")) {
  out[[paste0("page_m1_", alt)]] <- run(ht(pageTest(m1, alternative = alt)))
}
out$page_m1_reversed <- run(ht(pageTest(m1[, 4:1])))
# sizes around any switch between an exact distribution and an approximation (k treatments, n blocks)
set.seed(19)
for (k in 3:8) for (n in c(2, 3, 4, 5, 8, 12, 20)) {
  m <- matrix(round(rnorm(n * k) + rep(seq_len(k) / 3, each = n), 2), nrow = n)
  out[[sprintf("page_size_k%d_n%d", k, n)]] <- run(ht(pageTest(m)))
  out[[sprintf("page_size_k%d_n%d_greater", k, n)]] <- run(ht(pageTest(m, alternative = "greater")))
}
# ties within blocks, whole tied blocks, a single block, two treatments, NA
mt <- matrix(c(1, 2, 2, 3,  1, 1, 2, 2,  2, 3, 3, 4,  1, 2, 3, 3,  4, 4, 4, 4,  1, 3, 2, 4), nrow = 6, byrow = TRUE)
out$page_ties <- run(ht(pageTest(mt)))
out$page_ties_greater <- run(ht(pageTest(mt, alternative = "greater")))
out$page_one_block <- run(ht(pageTest(matrix(c(1, 2, 3, 4), nrow = 1))))
out$page_two_treatments <- run(ht(pageTest(matrix(c(1, 2, 3, 5, 2, 1, 4, 6), ncol = 2))))
out$page_na <- run({ mm <- m1; mm[2, 3] <- NA; ht(pageTest(mm)) })
out$page_vectors <- run(ht(pageTest(as.vector(m1), groups = rep(1:4, each = 5), blocks = rep(1:5, 4))))
out$page_factor_order <- run(ht(pageTest(as.vector(m1), groups = factor(rep(c("d", "c", "b", "a"), each = 5)),
                                         blocks = rep(1:5, 4))))

## Grubbs' test (outliers)
x1 <- c(199.31, 199.53, 200.19, 200.82, 201.92, 201.95, 202.18, 245.57)
x2 <- c(-3.1, 0.2, 0.4, 0.5, 0.7, 0.9, 1.1, 1.2, 1.3, 4.8)
x3 <- c(8.1, 8.3, 8.4, 8.6, 8.8, 9.0, 9.1, 12.4, 12.9)
for (xn in c("x1", "x2", "x3")) {
  x <- switch(xn, x1 = x1, x2 = x2, x3 = x3)
  for (type in c(10, 11, 20)) for (opp in c(FALSE, TRUE)) for (ts in c(FALSE, TRUE)) {
    out[[sprintf("grubbs_%s_type%d_opp%d_two%d", xn, type, opp, ts)]] <-
      run(ht(grubbs.test(x, type = type, opposite = opp, two.sided = ts)))
  }
}
out$grubbs_n3 <- run(ht(grubbs.test(c(1, 2, 10))))
out$grubbs_n3_type11 <- run(ht(grubbs.test(c(1, 2, 10), type = 11)))
out$grubbs_n4_type20 <- run(ht(grubbs.test(c(1, 2, 3, 10), type = 20)))
out$grubbs_n30_type20 <- run(ht(grubbs.test(c(seq(1, 2.8, length.out = 28), 9, 10), type = 20)))
out$grubbs_n31_type20 <- run(ht(grubbs.test(c(seq(1, 2.9, length.out = 29), 9, 10), type = 20)))
out$grubbs_n2 <- run(ht(grubbs.test(c(1, 2))))
out$grubbs_constant <- run(ht(grubbs.test(rep(3, 6))))
out$grubbs_na <- run(ht(grubbs.test(c(1, 2, NA, 3, 10))))
out$grubbs_large_n <- run(ht(grubbs.test(c(seq(-2, 2, length.out = 199), 6))))
out$grubbs_tie_extremes <- run(ht(grubbs.test(c(1, 1, 2, 3, 4, 9, 9))))
out$grubbs_symmetric <- run(ht(grubbs.test(c(-5, 0, 0.1, -0.1, 0.2, -0.2, 5))))
out$grubbs_scale <- run(ht(grubbs.test(x1 * 1e100)))
out$grubbs_shift <- run(ht(grubbs.test(x2 + 1e8)))

## pgrubbs and qgrubbs (the distribution functions behind the p-values). They take one value at a time (a vector
## stops with "the condition has length > 1") and pgrubbs has no lower.tail; each value is a call of its own
each <- function(v, f) lapply(v, function(a) run(f(a)))
qs <- c(0.5, 1, 1.5, 2, 2.5, 3, 3.5)
for (type in c(10, 11, 20)) for (n in c(3, 4, 5, 7, 10, 20, 30, 50)) {
  qq <- if (type == 10) qs else if (type == 11) qs + 1.5 else c(0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99)
  out[[sprintf("pgrubbs_type%d_n%d", type, n)]] <- list(q = qq, p = each(qq, function(a) pgrubbs(a, n, type = type)))
  ps <- c(0.001, 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99)
  out[[sprintf("qgrubbs_type%d_n%d", type, n)]] <- list(p = ps, q = each(ps, function(a) qgrubbs(a, n, type = type)),
                                                        qrev = each(ps, function(a) qgrubbs(a, n, type = type, rev = TRUE)))
}
# type 20 on a fine grid of n and q (the tabulated distribution and its interpolation)
for (n in c(4, 6, 8, 9, 11, 15, 16, 25, 29)) {
  qq <- seq(0.02, 0.98, by = 0.04)
  out[[sprintf("pgrubbs_type20_grid_n%d", n)]] <- list(q = qq, p = each(qq, function(a) pgrubbs(a, n, type = 20)))
}
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
