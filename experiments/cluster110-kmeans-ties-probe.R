# issue: 556
# cluster110-kmeans-ties-probe.R: public exact-tie and equal-best-start probes
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
mx <- matrix(c(0, 2, 1), ncol = 1)
starts <- matrix(c(0, 2), ncol = 1)
out <- list()
for (alg in c("Hartigan-Wong", "Lloyd", "Forgy", "MacQueen")) out[[paste0("midpoint_", alg)]] <- run({
  fit <- kmeans(mx, starts, algorithm = alg, iter.max = 20)
  list(cluster = fit$cluster, centers = tab(fit$centers), withinss = fit$withinss,
       tot.withinss = fit$tot.withinss, iter = fit$iter, ifault = fit$ifault)
})
xx <- matrix(0:3, ncol = 1)
for (seed_value in 1:8) out[[paste0("equal_best_start_", seed_value)]] <- run({
  set.seed(seed_value)
  first_draw <- sample.int(nrow(xx), 2)
  set.seed(seed_value)
  fit <- kmeans(xx, 2, nstart = 8)
  list(first_draw = first_draw, cluster = fit$cluster, centers = tab(fit$centers),
       tot.withinss = fit$tot.withinss, iter = fit$iter, tail = runif(2))
})
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
