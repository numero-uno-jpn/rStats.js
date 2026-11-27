# tsmeta120-glmmrare.R: glmer on rare events (1.20.0, session 42; metaprop's GLMM with proportions about 1e-5 failed in
# rStats.js's glmer, log 110). lme4's fit of the same data for nAGQ 0, 1 and 7: theta, the fixed effect, the deviance
# and the log-likelihood, its convergence messages.
library(jsonlite)
suppressPackageStartupMessages(library(lme4))
e <- c(1, 2, 1, 3); n <- c(1e5, 2e5, 8e4, 3e5)
d <- data.frame(p = e / n, w = n, study = factor(paste0("s", 1:4)))
grab <- function(expr) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(expr, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") },
    message = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleMessage") }), error = function(err) list(error = conditionMessage(err)))
  if (length(w)) r$messages <- unique(w)
  r
}
out <- list(data = d)
for (q in c(0, 1, 7)) out[[paste0("nAGQ", q)]] <- grab({ f <- glmer(p ~ 1 + (1 | study), data = d, family = binomial, weights = w, nAGQ = q)
  list(theta = unname(getME(f, "theta")), fixef = unname(fixef(f)), deviance = deviance(f), loglik = as.numeric(logLik(f)), se = unname(sqrt(diag(as.matrix(vcov(f))))),
       optinfo = f@optinfo$conv$opt, messages_fit = unlist(f@optinfo$conv$lme4$messages)) })
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
