# issue: 556
# mds110-asym-probe.R: compare public cmdscale results for asymmetric dissimilarity matrices
library(jsonlite)
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
cm <- function(v) {
  if (!is.list(v)) return(list(points = tab(v)))
  list(points = tab(v$points), eig = v$eig, x = if (is.null(v$x)) NULL else tab(v$x), ac = v$ac, GOF = v$GOF)
}
M <- matrix(c(0, 1, 2, 3, 0, 4, 5, 6, 0), 3)
out <- list(
  matrix_direct = run(cm(cmdscale(M, k = 2, eig = TRUE, x.ret = TRUE))),
  lower_triangle = run(cm(cmdscale(as.dist(M), k = 2, eig = TRUE, x.ret = TRUE))),
  upper_triangle = run(cm(cmdscale(as.dist(t(M)), k = 2, eig = TRUE, x.ret = TRUE))),
  arithmetic_symmetry = run(cm(cmdscale(as.dist((M + t(M)) / 2), k = 2, eig = TRUE, x.ret = TRUE))),
  rms_symmetry = run(cm(cmdscale(as.dist(sqrt((M^2 + t(M^2)) / 2)), k = 2, eig = TRUE, x.ret = TRUE)))
)
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
