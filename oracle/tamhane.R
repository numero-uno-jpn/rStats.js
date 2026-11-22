# issue: 549
# Full Tamhane T2/T2' oracle; all cases from experiments/tests19-small.R
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

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
