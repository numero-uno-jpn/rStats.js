# issue: 560
# isomds111-ties.R (2026-11-24): inspect tied-pair order and explicit-start initial stress.
# Public R outputs only; compare maxit 1, 2, 3 point matrices and the printed initial value.
suppressPackageStartupMessages(library(MASS))

show_steps <- function(label, d, y = NULL, k = 2) {
  cat("\nCASE", label, "\n")
  for (m in 0:3) {
    args <- list(d = d, k = k, maxit = m, tol = 1e-30)
    if (!is.null(y)) args$y <- y
    printed <- capture.output(fit <- do.call(isoMDS, args))
    cat("maxit", m, "stress", sprintf("%.17g", fit$stress), "\n")
    cat(paste(printed, collapse = " | "), "\n")
    cat("points (row-major):", paste(sprintf("%.17g", as.vector(t(fit$points))), collapse = " "), "\n")
  }
}

show_steps("eurodist", eurodist)
show_steps("USArrests", dist(scale(USArrests)))
grid <- as.matrix(expand.grid(x = 0:2, y = 0:2))
grid_start <- grid
for (i in seq_len(nrow(grid))) {
  grid_start[i, 1] <- grid_start[i, 1] + 0.1 * sin(i)
  grid_start[i, 2] <- grid_start[i, 2] + 0.1 * cos(i)
}
show_steps("grid_ties_default", dist(grid))
show_steps("grid_ties", dist(grid), grid_start)
small <- rbind(c(1, 2, 0), c(4, 0, 3), c(-1, 5, 2), c(2, 7, 0), c(0, 0, 1))
show_steps("small_k1", dist(small), k = 1)

# Explicit y cases: maxit=0 exposes R's printed initial stress without an update.
show_steps("swiss_y", dist(swiss), as.matrix(swiss[, 2:3]))
show_steps("swiss_y_k1", dist(swiss), matrix(swiss[, 1], ncol = 1), k = 1)
