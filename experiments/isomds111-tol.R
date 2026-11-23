# issue: 560
# isomds111-tol.R (Claude, 2026-11-24): how tol changes R's isoMDS iterates (maxit = 4..12 at three tol) and the printout.
# rStats.js reproduces the tol = 1e-30 iterates exactly; the difference is what happens when the relative decrease falls below tol
suppressPackageStartupMessages(library(MASS)); d <- dist(swiss)
for (tl in c(1e-3, 1e-2, 1e-4)) {
  s <- sapply(4:12, function(k) { invisible(capture.output(r <- isoMDS(d, maxit = k, tol = tl))); r$stress })
  cat("tol", tl, "maxit 4..12:", sprintf("%.6f", s), "\n")
  p <- capture.output(r <- isoMDS(d, tol = tl)); cat("   printed:", paste(trimws(p), collapse = " | "), "\n")
}
