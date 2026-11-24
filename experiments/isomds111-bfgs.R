# issue: 560
# choices 13: original coordinates, identity inverse Hessian; no scale normalization.
# isomds111-bfgs.R (Claude, 2026-11-24): a textbook BFGS (inverse-Hessian update, Nocedal & Wright ch. 6) written from
# the observations of isomds111-iterates.R, compared with R's isoMDS iterates. Public outputs only; no source. Output: text
suppressPackageStartupMessages(library(MASS))
# stress in percent (R's fixed tie order) and its analytic gradient (the isotonic fit held fixed)
SG <- function(y, d, grad = TRUE) {
  n <- nrow(y); r <- as.vector(dist(y)); o <- order(d); f <- r; f[o] <- isoreg(r[o])$yf
  sr <- sum((r - f)^2); tt <- sum(r^2); s <- 100 * sqrt(sr / tt)
  if (!grad) return(s)
  w <- 100 / (2 * sqrt(sr / tt)) * (2 * (r - f) * tt - sr * 2 * r) / tt^2 / r   # dS/dr / r
  W <- matrix(0, n, n); W[lower.tri(W)] <- w; W <- W + t(W)
  g <- (rowSums(W) * y - W %*% y)
  list(s = s, g = g)
}
# textbook BFGS on the inverse Hessian: H0 = I, unit first trial step, Armijo (c = 1e-4) backtracking by `red`;
# a line search that changes nothing resets H to I (counted as an iteration)
bfgs <- function(y0, d, iters, red = 0.2, c1 = 1e-4) {
  x <- as.vector(y0); k <- ncol(y0); np <- length(x); H <- diag(np)
  e <- SG(matrix(x, ncol = k), d); out <- list(); reset <- TRUE
  for (it in 1:iters) {
    g <- as.vector(e$g); t <- -H %*% g; gp <- sum(t * g)
    if (gp >= 0) { H <- diag(np); t <- -g; gp <- sum(t * g); reset <- TRUE }
    st <- 1; acc <- FALSE
    repeat {
      xn <- x + st * as.vector(t)
      if (all(xn == x)) break
      fn <- SG(matrix(xn, ncol = k), d, FALSE)
      if (fn <= e$s + c1 * st * gp) { acc <- TRUE; break }
      st <- st * red
    }
    if (!acc) { H <- diag(np); out[[it]] <- matrix(x, ncol = k); if (reset) break; reset <- TRUE; next }
    en <- SG(matrix(xn, ncol = k), d); s <- xn - x; yv <- as.vector(en$g) - g; sy <- sum(s * yv)
    if (sy > 0) { Hy <- H %*% yv; H <- H + ((sy + sum(yv * Hy)) / sy^2) * (s %*% t(s)) - (Hy %*% t(s) + s %*% t(Hy)) / sy }
    else H <- diag(np)
    x <- xn; e <- en; reset <- FALSE; out[[it]] <- matrix(x, ncol = k)
  }
  out
}
for (nm in c("swiss", "eurodist")) {
  d <- if (nm == "swiss") dist(swiss) else eurodist; dv <- as.vector(d); y0 <- cmdscale(d, 2)
  R <- lapply(1:10, function(k) { invisible(capture.output(r <- isoMDS(d, maxit = k, tol = 1e-30))); r$points })
  for (red in c(0.2, 0.5)) {
    B <- bfgs(y0, dv, 10, red)
    cat(nm, "red", red, ": max|R_k - BFGS_k| / max|R_k| =", sprintf("%.1e", sapply(seq_along(B), function(k) max(abs(R[[k]] - B[[k]])) / max(abs(R[[k]])))), "\n")
  }
}
cat("--- shifted: R_{k+1} vs BFGS_k, original coordinates, H0 = I\n")
for (nm in c("swiss", "eurodist")) {
  d <- if (nm == "swiss") dist(swiss) else eurodist; dv <- as.vector(d); y0 <- cmdscale(d, 2)
  R <- lapply(1:13, function(k) { invisible(capture.output(r <- isoMDS(d, maxit = k, tol = 1e-30))); r$points })
  B <- bfgs(y0, dv, 12, 0.2)
  first <- identical(unname(R[[2]]), unname(B[[1]]))
  cat(nm, "first step bitwise identical (R maxit=2 vs BFGS 1):", first,
      "; max abs error:", format(max(abs(R[[2]] - B[[1]])), digits = 17), "\n")
  stopifnot(first)
  absolute <- sapply(1:12, function(k) max(abs(R[[k + 1]] - B[[k]])))
  stopifnot(max(absolute[1:11]) <= 1e-11)
  relative <- sapply(1:12, function(k) absolute[k] / max(abs(R[[k + 1]])))
  cat(nm, "absolute max errors k=1..12:", sprintf("%.3e", absolute), "\n")
  cat(nm, "relative max errors k=1..12:", sprintf("%.3e", relative), "\n")
  cat(nm, "11th absolute max error:", format(absolute[11], digits = 17), "\n")
  cat(nm, "R stress:", sprintf("%.5f", sapply(R, SG, d = dv, grad = FALSE)), "\n")
  cat(nm, "B stress:", sprintf("%.5f", sapply(B, SG, d = dv, grad = FALSE)), "\n")
}
