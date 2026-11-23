# sammon111.R: MASS 7.3.66 (sammon) on small data and boundary cases, public functions only (1.11.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
library(MASS)
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
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
# sammon prints its progress (initial stress, the stress every 10 iterations, the final stress): captured, kept as text
sm <- function(expr) {
  printed <- capture.output(r <- expr)
  list(points = tab(r$points), stress = r$stress, printed = printed)
}
out <- list()

small <- matrix(c(1, 2, 0, 4, 0, 3, -1, 5, 2, 2, 7, 0, 0, 0, 1), nrow = 5, byrow = TRUE,
                dimnames = list(c("a", "b", "c", "d", "e"), c("x", "y", "z")))
ds <- dist(small)
dsw <- dist(swiss)
du <- dist(USArrests)
nonE <- as.dist(matrix(c(0, 1, 1, 3, 1, 0, 1, 1, 1, 1, 0, 1, 3, 1, 1, 0), 4))

## the defaults (niter = 100, magic = 0.2, tol = 1e-4, the start from cmdscale) and each argument
out$sammon_swiss <- run(sm(sammon(dsw)))
out$sammon_swiss_k1 <- run(sm(sammon(dsw, k = 1)))
out$sammon_swiss_k3 <- run(sm(sammon(dsw, k = 3)))
out$sammon_swiss_niter5 <- run(sm(sammon(dsw, niter = 5)))
out$sammon_swiss_niter0 <- run(sm(sammon(dsw, niter = 0)))
out$sammon_swiss_niter1 <- run(sm(sammon(dsw, niter = 1)))
out$sammon_swiss_magic <- run(sm(sammon(dsw, magic = 0.5)))
out$sammon_swiss_magic_small <- run(sm(sammon(dsw, magic = 0.01, niter = 50)))
out$sammon_swiss_tol <- run(sm(sammon(dsw, tol = 1e-8, niter = 1000)))
out$sammon_swiss_tol_loose <- run(sm(sammon(dsw, tol = 0.1)))
out$sammon_swiss_y <- run(sm(sammon(dsw, y = as.matrix(swiss[, c(2, 3)]))))
out$sammon_swiss_y_k1 <- run(sm(sammon(dsw, y = as.matrix(swiss[, 1, drop = FALSE]), k = 1)))
out$sammon_swiss_y_wrong_rows <- run(sm(sammon(dsw, y = as.matrix(swiss[1:10, 1:2]))))
out$sammon_swiss_y_wrong_k <- run(sm(sammon(dsw, y = as.matrix(swiss[, 1:3]))))
out$sammon_eurodist <- run(sm(sammon(eurodist)))
out$sammon_usarrests <- run(sm(sammon(du)))
out$sammon_small <- run(sm(sammon(ds)))
out$sammon_small_k1 <- run(sm(sammon(ds, k = 1)))
out$sammon_non_euclidean <- run(sm(sammon(nonE)))
out$sammon_matrix <- run(sm(sammon(as.matrix(ds))))
out$sammon_perfect <- run(sm(sammon(dist(small[, 1:2]))))
out$sammon_line <- run(sm(sammon(dist(c(0, 1, 3, 6, 10)), k = 1)))
out$sammon_three <- run(sm(sammon(dist(c(0, 1, 3)), k = 1)))
out$sammon_two <- run(sm(sammon(dist(c(0, 1)), k = 1)))
out$sammon_k_too_big <- run(sm(sammon(ds, k = 5)))
grid <- as.matrix(expand.grid(x = 0:2, y = 0:2)); rownames(grid) <- paste0("g", 1:9)
out$sammon_grid <- run(sm(sammon(dist(grid), y = grid + 0.1 * cbind(sin(1:9), cos(1:9)))))
out$sammon_grid_default <- run(sm(sammon(dist(grid))))
# boundary cases: zero distances (sammon divides by them), duplicate starting points, negative and missing values
out$sammon_zero_distance <- run(sm(sammon(dist(c(1, 1, 2, 5)), k = 1)))
out$sammon_zero_distance_y <- run(sm(sammon(dist(c(1, 1.5, 2, 5)), y = matrix(c(1, 1, 2, 5)), k = 1)))
out$sammon_negative <- run(sm(sammon(as.dist(matrix(c(0, -1, 2, -1, 0, 3, 2, 3, 0), 3)), k = 1)))
out$sammon_na <- run(sm(sammon(as.dist(matrix(c(0, 1, NA, 1, 2, 0, 2, 3, NA, 2, 0, 1, 1, 3, 1, 0), 4)), k = 1)))
out$sammon_inf <- run(sm(sammon(as.dist(matrix(c(0, 1, Inf, 1, 0, 2, Inf, 2, 0), 3)), k = 1)))
# scale: the configuration scales with the distances, the stress does not
out$sammon_scale_big <- run(sm(sammon(dsw * 2^300)))
out$sammon_scale_small <- run(sm(sammon(dsw * 2^-300)))
out$sammon_scale_y <- run(sm(sammon(dsw, y = cmdscale(dsw) * 2^100)))

## tight convergence (the pass condition of 1.11.0): many iterations and a tiny tol
tight <- function(d, ...) sm(sammon(d, niter = 100000, tol = 1e-14, ...))
out$tight_swiss <- run(tight(dsw))
out$tight_swiss_k1 <- run(tight(dsw, k = 1))
out$tight_swiss_k3 <- run(tight(dsw, k = 3))
out$tight_eurodist <- run(tight(eurodist))
out$tight_usarrests <- run(tight(du))
out$tight_small <- run(tight(ds))
out$tight_small_k1 <- run(tight(ds, k = 1))
out$tight_non_euclidean <- run(tight(nonE))
out$tight_line <- run(tight(dist(c(0, 1, 3, 6, 10)), k = 1))
out$tight_grid <- run(tight(dist(grid), y = grid + 0.1 * cbind(sin(1:9), cos(1:9))))

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
