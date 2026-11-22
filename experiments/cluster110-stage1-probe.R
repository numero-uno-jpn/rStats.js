# issue: 556
# cluster110-stage1-probe.R: targeted public-output probes for unresolved stage-1 details
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
out <- list()
dup <- rbind(c(1, 1), c(1, 1), c(1, 1), c(2, 2))
for (s in 1:12) out[[paste0("duplicate_start_seed_", s)]] <- run({
  set.seed(s)
  picked <- sample.int(nrow(dup), 2)
  fit <- kmeans(dup, 2, nstart = 1)
  list(picked = picked, cluster = fit$cluster, centers = tab(fit$centers),
       tot.withinss = fit$tot.withinss, iter = fit$iter, ifault = fit$ifault)
})
small <- matrix(c(1, 2, 0, 4, 0, 3, -1, 5, 2, 2, 7, 0, 0, 0, 1), nrow = 5, byrow = TRUE)
starts <- small[c(1, 3, 5), , drop = FALSE]
for (a in c("Hartigan-Wong", "Lloyd", "Forgy", "MacQueen")) {
  for (m in 1:5) out[[paste0("iter_", a, "_", m)]] <- run({
    fit <- kmeans(small, starts, algorithm = a, iter.max = m)
    list(cluster = fit$cluster, centers = tab(fit$centers), tot.withinss = fit$tot.withinss,
         iter = fit$iter, ifault = fit$ifault)
  })
}
# Tie-heavy input with deliberately non-monotone object labels.
line <- c(5, 1, 3, 0, 4, 2)
for (a in c("single", "complete", "average", "ward.D", "ward.D2", "median", "centroid")) {
  fit <- hclust(stats::dist(line), method = a)
  out[[paste0("line_ties_", a)]] <- list(merge = unname(fit$merge), height = fit$height, order = fit$order)
}
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
