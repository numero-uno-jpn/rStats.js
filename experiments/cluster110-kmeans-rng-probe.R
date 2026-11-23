# issue: 556
# cluster110-kmeans-rng-probe.R: public kmeans RNG consumption and equal-best-start probes
library(jsonlite)
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
dup <- rbind(c(1, 1), c(1, 1), c(1, 1), c(2, 2))
out <- list()
out$seed3_sample_then_rng <- run({ set.seed(3); picked <- sample.int(nrow(dup), 2); tail <- runif(3); list(picked = picked, tail = tail) })
out$seed3_fit_then_rng <- run({ set.seed(3); fit <- kmeans(dup, 2, nstart = 1); list(cluster = fit$cluster, centers = tab(fit$centers), tail = runif(3)) })
out$seed3_two_samples_then_rng <- run({ set.seed(3); first <- sample.int(nrow(dup), 2); second <- sample.int(nrow(dup), 2); list(first = first, second = second, tail = runif(3)) })
for (s in 1:8) out[[paste0("equal_best_nstart_", s)]] <- run({
  set.seed(s)
  fit <- kmeans(dup, 2, nstart = 5)
  list(cluster = fit$cluster, centers = tab(fit$centers), tot.withinss = fit$tot.withinss, tail = runif(2))
})
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
