# issue: 556
# cluster110-kmeans-nstart-probe.R: verify which equal-WSS start is retained
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
xx <- matrix(0:3, ncol = 1)
out <- list()
for (trial in 1:8) out[[paste0("equal_best_start_", trial)]] <- run({
  set.seed(trial)
  first_draw <- sample.int(nrow(xx), 2)
  set.seed(trial)
  fit <- kmeans(xx, 2, nstart = 8)
  list(first_draw = first_draw, cluster = fit$cluster, centers = tab(fit$centers),
       tot.withinss = fit$tot.withinss, iter = fit$iter, tail = runif(2))
})
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
