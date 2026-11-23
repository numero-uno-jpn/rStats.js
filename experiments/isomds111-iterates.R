# issue: 560
# isomds111-iterates.R (Claude, 2026-11-24): R's isoMDS iterates (maxit = 1..12, the same start) against the numerical
# gradient of the stress. Public outputs only; no source. Output: text
suppressPackageStartupMessages(library(MASS))
# Stress-1 (fraction) with R's fixed tie order, and its numerical gradient (the isotonic fit recomputed at each point)
S <- function(y, d) { r <- as.vector(dist(y)); o <- order(d); f <- isoreg(r[o])$yf; sqrt(sum((r[o] - f)^2) / sum(r^2)) }
G <- function(y, d) { g <- y; h <- 1e-6 * max(abs(y))
  for (i in seq_len(nrow(y))) for (j in seq_len(ncol(y))) { a <- b <- y; a[i, j] <- a[i, j] + h; b[i, j] <- b[i, j] - h
    g[i, j] <- (S(a, d) - S(b, d)) / (2 * h) }; g }
cs <- function(a, b) sum(a * b) / sqrt(sum(a^2) * sum(b^2))
for (nm in c("swiss", "eurodist")) {
  d <- if (nm == "swiss") dist(swiss) else eurodist; dv <- as.vector(d)
  Y <- list(cmdscale(d, 2)); for (k in 1:12) { invisible(capture.output(r <- isoMDS(d, maxit = k, tol = 1e-30))); Y[[k + 1]] <- r$points }
  cat(nm, ": stress", sprintf("%.6f", sapply(Y, S, d = dv) * 100), "\n"); prev <- NULL
  for (k in 1:12) {
    y <- Y[[k]]; s <- Y[[k + 1]] - y; g <- 100 * G(y, dv)
    if (sum(s^2) == 0) { cat(sprintf(" k=%d no move\n", k)); next }
    fit <- if (is.null(prev)) NA else { X <- cbind(as.vector(g), as.vector(prev)); b <- qr.solve(X, as.vector(s)); sqrt(sum((as.vector(s) - X %*% b)^2) / sum(s^2)) }
    cat(sprintf(" k=%d cos(s,-g)=%.6f |s|/|g|=%.4g resid(g,prev)=%s beta=%s centroid=%.2g\n", k, cs(s, -g), sqrt(sum(s^2) / sum(g^2)),
                format(fit, digits = 3), if (is.null(prev)) "NA" else paste(format(qr.solve(cbind(as.vector(g), as.vector(prev)), as.vector(s)), digits = 5), collapse = ","), max(abs(colMeans(Y[[k + 1]])))))
    prev <- s
  }
}
