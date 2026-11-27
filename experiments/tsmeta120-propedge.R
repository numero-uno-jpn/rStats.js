# tsmeta120-propedge.R: metaprop with proportions near 0 and 1 (1.20.0, session 42; the spec's "Edge-case plan",
# probabilities): events 0, 1, n - 1 and n, every summary measure, and the GLMM; meta's defaults otherwise.
library(jsonlite)
suppressPackageStartupMessages(library(meta))
grab <- function(expr) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(expr, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") }),
                error = function(e) list(error = conditionMessage(e)))
  if (length(w)) r$warnings <- unique(w)
  r
}
sets <- list(zeros = list(e = c(0, 1, 0, 2), n = c(50, 80, 40, 120)), all = list(e = c(50, 79, 40, 118), n = c(50, 80, 40, 120)),
             tiny = list(e = c(1, 2, 1, 3), n = c(1e5, 2e5, 8e4, 3e5)), huge = list(e = c(1e6 - 1, 2e6 - 3, 1e6, 5e5), n = c(1e6, 2e6, 1e6, 5e5)),
             mixed = list(e = c(0, 25, 50, 3), n = c(50, 50, 50, 60)))
out <- list(sets = sets)
for (nm in names(sets)) {
  s <- sets[[nm]]; r <- list()
  for (sm in c("PLOGIT", "PFT", "PAS", "PRAW", "PLN")) r[[sm]] <- grab({ m <- metaprop(s$e, s$n, sm = sm, method = "Inverse")
    list(TE = m$TE, seTE = m$seTE, TE.common = m$TE.common, TE.random = m$TE.random, seTE.random = m$seTE.random, tau2 = m$tau2, lower.random = m$lower.random, upper.random = m$upper.random) })
  r$GLMM <- grab({ m <- metaprop(s$e, s$n); list(TE.random = m$TE.random, seTE.random = m$seTE.random, TE.common = m$TE.common, tau2 = m$tau2) })
  out[[nm]] <- r
}
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
