# iptw113-edge3.R: the denominator of bal.tab's standardised difference when the groups' SDs are (nearly) zero, and
# trim() with a fractional at below 0.5 (1.13.0), public calls only.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(WeightIt); library(cobalt) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(R = R.version.string)
tr <- c(0, 0, 0, 0, 1, 1, 1, 1)
w <- c(1, 2, 1, 1, 1, 1, 2, 1)
# a covariate equal to the treatment plus noise of size e within each group
for (e in c(0, 1e-15, 1e-12, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-4, 1e-2)) for (est in c("ATE", "ATT", "ATO")) {
  z <- tr + e * c(1, -1, 2, 0, 1, -2, 0, 1)
  out[[sprintf("sd_%g_%s", e, est)]] <- run({
    b <- bal.tab(data.frame(z = z), treat = tr, weights = w, method = "weighting", estimand = est, un = TRUE)
    list(z = z, diffUn = b$Balance$Diff.Un, diffAdj = b$Balance$Diff.Adj) })
}
# the same with the covariate on another scale (relative or absolute threshold?)
for (e in c(1e-10, 1e-8, 1e-6)) {
  z <- 1000 * (tr + e * c(1, -1, 2, 0, 1, -2, 0, 1))
  out[[sprintf("sd1000_%g", e)]] <- run({
    b <- bal.tab(data.frame(z = z), treat = tr, weights = w, method = "weighting", estimand = "ATE", un = TRUE)
    list(z = z, diffUn = b$Balance$Diff.Un, diffAdj = b$Balance$Diff.Adj) })
}
# trim with a fractional at below 0.5
wv <- c(5, 1, 2, 9, 3, 4, 8, 6, 7, 10)
for (at in c(0.1, 0.3, 0.5, 0.7)) for (lo in c(TRUE, FALSE)) out[[sprintf("trim_%g_%s", at, lo)]] <- run(trim(wv, at = at, lower = lo))
for (at in c(2, 7, 8)) out[[sprintf("trim_%g_TRUE", at)]] <- run(trim(wv, at = at, lower = TRUE))
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
