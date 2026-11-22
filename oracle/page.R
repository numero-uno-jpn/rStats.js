# issue: 549
# Full Page oracle; all cases from experiments/tests19-small.R
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

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
