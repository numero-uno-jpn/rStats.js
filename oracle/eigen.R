source("/oracle/_linalg.R")

# eigen (symmetric matrices)

set.seed(20261026)
orth <- function(n) qr.Q(qr(rmat(n, n)))
sym <- function(n, scale = 1) { m <- rmat(n, n, scale); (m + t(m)) / 2 }
spec <- function(d) { q <- orth(length(d)); q %*% diag(d) %*% t(q) }
smats <- list(
  matrix(5, 1, 1), matrix(c(2, 1, 1, 3), 2, 2), matrix(c(1, 2, 2, 1), 2, 2),
  sym(3), sym(5), sym(10), sym(30), sym(60),
  spec(c(3, 3, 1, -2)), spec(c(1, 1, 1, 1, 2)), spec(c(5, 1e-10, -5, 2)),   # repeated and near-zero eigenvalues
  diag(c(3, -1, 2)), diag(c(1e-200, 1, 1e200)), matrix(0, 3, 3),
  hilbert(6), hilbert(12), crossprod(rmat(3, 6)),
  sym(5, 1e150), sym(5, 1e-150),
  matrix(c(2, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2), 4, 4)   # tridiagonal
)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
for (m in smats) {
  add(x = m)
  add(x = m, onlyValues = TRUE)
  add(x = m, symmetric = TRUE)
}
# Only the lower triangle is used / symmetry check
m <- sym(4); m[upper.tri(m)] <- 99
add(x = m, symmetric = TRUE)
m <- sym(4); m[1, 2] <- m[1, 2] * (1 + 1e-15)
add(x = m)
add(x = matrix(c(1, NaN, NaN, 1), 2, 2), symmetric = TRUE)
add(x = matrix(c(1, Inf, Inf, 1), 2, 2), symmetric = TRUE)
add(x = matrix(1:6, 2, 3) + 0)
cases <- lapply(cases, function(a) {
  if (!all(is.finite(a$x)) || nrow(a$x) != ncol(a$x)) return(a)
  vm <- vector_mask(eigen(a$x, symmetric = TRUE, only.values = TRUE)$values)
  if (length(vm$mask)) a$mask <- I(vm$mask)
  a$gap <- vm$gap
  a
})
write_linalg_fixture("eigenSymmetric", cases, function(a) {
  e <- eigen(a$x, symmetric = if (is.null(a$symmetric)) isSymmetric(a$x) else a$symmetric,
             only.values = isTRUE(a$onlyValues))
  out <- list(values = vec_out(e$values))
  if (!is.null(e$vectors)) out$vectors <- mat_out(align_columns(e$vectors, a$mask)$M)
  out
})

# eigen (nonsymmetric matrices)
companion <- function(coef) { n <- length(coef); m <- matrix(0, n, n); m[1, ] <- -coef; if (n > 1) m[cbind(2:n, 1:(n - 1))] <- 1; m }
gmats <- list(
  matrix(5, 1, 1), matrix(c(1, 2, 3, 4), 2, 2), matrix(c(0, 1, -1, 0), 2, 2),
  matrix(c(0, 1, 0, -1, 0, 0, 0, 0, 2), 3, 3),
  rmat(3, 3), rmat(5, 5), rmat(10, 10), rmat(30, 30), rmat(60, 60),
  companion(c(-6, 11, -6)), companion(c(1, 0, 0, 0, 1)), companion(c(2, -3, 1, 5, -1, 0.5)),
  matrix(c(2, 0, 0, 1, 3, 0, 4, 5, 6), 3, 3),        # upper triangular
  matrix(c(1, 1, 0, 1), 2, 2), matrix(c(2, 0, 0, 1, 2, 0, 0, 1, 2), 3, 3),   # Jordan block (eigenvectors are not unique)
  matrix(c(2, 0, 0, -2), 2, 2), diag(c(3, -1, 2)),
  rmat(5, 5, 1e150), rmat(5, 5, 1e-150),
  rmat(4, 4) %*% diag(c(1e6, 1, 1e-6, 1)) %*% solve(rmat(4, 4) + diag(4) * 3)
)
cases <- list()
for (m in gmats) {
  add(x = m, symmetric = FALSE)
  add(x = m, symmetric = FALSE, onlyValues = TRUE)
}
for (m in smats[c(2, 4, 6)]) add(x = m, symmetric = FALSE)
add(x = rmat(4, 4))                       # symmetry check (nonsymmetric)
add(x = matrix(c(1, NaN, 2, 1), 2, 2), symmetric = FALSE)
# (added later, at the end) badly scaled matrices: R's dgeev balances them first (permutation, then scaling)
dsim <- function(m, d) diag(d) %*% m %*% diag(1 / d)
bad <- list(
  matrix(c(1, 1e-8, 0, 1e8, 1, 1e-6, 0, 1e6, 2), 3, 3),
  dsim(rmat(5, 5), 10^c(-6, -3, 0, 3, 6)),
  dsim(rmat(6, 6), 10^c(8, -8, 4, -4, 0, 2)),
  dsim(matrix(c(0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 2, -3, 1), 4, 4), 10^c(0, 5, -5, 7)),   # complex pairs
  dsim(companion(c(2, -3, 1, 5, -1, 0.5)), 2^c(30, 10, -10, 0, -30, 20)),
  matrix(c(1, 0, 0, 0, 2, 3, 0, 0, 4, 5, 6, 0, 7, 8, 9, 10), 4, 4),          # triangular: permutation only
  matrix(c(1, 2, 0, 3, 4, 5, 0, 0, 0, 6, 7, 8, 9, 1, 0, 2, 3, 4, 0, 0, 5, 6, 7, 0, 8), 5, 5),   # zero rows and columns
  dsim(matrix(c(4, 1, 0, 0, 2, 3, 0, 0, 1, 5, 2, 1, 6, 7, 3, 1), 4, 4), 10^c(4, -4, 2, 0))
)
for (m in bad) {
  add(x = m, symmetric = FALSE)
  add(x = m, symmetric = FALSE, onlyValues = TRUE)
}
cases <- lapply(cases, function(a) {
  if (!all(is.finite(a$x))) return(a)
  e <- eigen(a$x, symmetric = FALSE)
  vm <- vector_mask(e$values)
  if (length(vm$mask)) a$mask <- I(vm$mask)
  a$gap <- vm$gap
  a$cond <- if (length(vm$mask)) Inf else kappa(e$vectors, exact = TRUE)
  a
})
write_linalg_fixture("eigenGeneral", cases, function(a) {
  e <- call_with(eigen, list(a$x, symmetric = a$symmetric, only.values = isTRUE(a$onlyValues)))
  out <- list(values = vec_out(Re(e$values)))
  cplx <- is.complex(e$values)
  if (cplx) out$valuesIm <- vec_out(Im(e$values))
  if (!is.null(e$vectors)) {
    v <- align_complex(e$vectors + 0i, a$mask)
    out$vectors <- mat_out(Re(v))
    if (cplx) out$vectorsIm <- mat_out(Im(v))
  }
  out
})
