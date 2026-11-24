# issue: 560
# isomds111-diverge.R (Claude, 2026-11-24): R's isoMDS stress for maxit = 0..8 (tol = 1e-30) in the cases that still differ.
# rStats.js gives the same 10 digits in swiss_y, grid_ties and small_k1; swiss_y_k1 differs: R never moves (the start has two equal
# values, 65, so one configuration distance is 0)
suppressPackageStartupMessages(library(MASS))
small <- matrix(c(1, 2, 0, 4, 0, 3, -1, 5, 2, 2, 7, 0, 0, 0, 1), nrow = 5, byrow = TRUE)
grid <- as.matrix(expand.grid(x = 0:2, y = 0:2))
cs <- list(swiss_y = list(dist(swiss), as.matrix(swiss[, c(2, 3)]), 2), swiss_y_k1 = list(dist(swiss), as.matrix(swiss[, 1, drop = FALSE]), 1),
           grid_ties = list(dist(grid), grid + 0.1 * cbind(sin(1:9), cos(1:9)), 2), small_k1 = list(dist(small), NULL, 1))
for (nm in names(cs)) { z <- cs[[nm]]
  s <- sapply(0:8, function(m) { invisible(capture.output(r <- if (is.null(z[[2]])) isoMDS(z[[1]], k = z[[3]], maxit = m, tol = 1e-30) else isoMDS(z[[1]], y = z[[2]], k = z[[3]], maxit = m, tol = 1e-30))); r$stress })
  cat(nm, sprintf("%.10f", s), "\n") }
