source("/oracle/_htest.R")

# Shared code for linear-algebra fixtures. Same format as the hypothesis-test fixtures (write_htest_fixture).

# LAPACK and BLAS used by R (recorded because the OpenBLAS version can change the last digits)
LINALG_INFO <- list(lapack = La_version(), lapack_library = basename(La_library()),
                    blas = basename(extSoftVersion()[["BLAS"]]))

write_linalg_fixture <- function(name, cases, fun, ref = NULL)
  write_htest_fixture(name, cases, fun, ref, info = LINALG_INFO)

# Matrix (numeric matrices are written as arrays of rows; length-1 dimensions are kept)
mat_out <- function(m) {
  m <- unname(as.matrix(m))
  lapply(seq_len(nrow(m)), function(i) I(num2str(m[i, ])))
}
vec_out <- function(v) I(num2str(unname(as.vector(v))))

# Random matrix
rmat <- function(n, p, scale = 1) matrix(rnorm(n * p) * scale, n, p)
hilbert <- function(n) outer(seq_len(n), seq_len(n), function(i, j) 1 / (i + j - 1))

# Numerical rank (number of singular values above 1e-13 times the largest). NA if NaN or Inf is present
num_rank <- function(x) {
  if (!all(is.finite(x)) || length(x) == 0) return(NA)
  d <- svd(x, 0, 0)$d
  if (d[1] == 0) 0L else sum(d > d[1] * 1e-13)
}

# How singular vectors / eigenvectors are compared (same rules as alignColumns in test/helpers/linalg.ts)
# - Non-unique columns (repeated values, zero singular values) are set to NaN and not compared. mask holds their indices (1-based)
# - The remaining columns get a canonical sign: the first component whose absolute value is >= (1 - 1e-8) times the maximum is made positive.
#   u and v (only vectors for eigenvectors) flip the same columns together
align_columns <- function(M, mask, partner = NULL) {
  flip <- rep(1, ncol(M))
  for (k in seq_len(ncol(M))) {
    if (k %in% mask) { M[, k] <- NaN; if (!is.null(partner) && k <= ncol(partner)) partner[, k] <- NaN; next }
    a <- abs(M[, k]); i <- which(a >= max(a) * (1 - 1e-8))[1]
    if (M[i, k] < 0) flip[k] <- -1
  }
  M <- sweep(M, 2, flip, "*")
  if (!is.null(partner)) {
    for (k in mask) if (k > ncol(M) && k <= ncol(partner)) partner[, k] <- NaN
    k <- seq_len(min(ncol(M), ncol(partner)))
    partner[, k] <- sweep(partner[, k, drop = FALSE], 2, flip[k], "*")
  }
  list(M = M, partner = partner)
}

# From the values d (descending), find the columns whose vectors are not unique (difference from another value below 1e-8 times
# the largest value, or value at most 1e-13 times the largest) and the smallest relative gap among the remaining columns
vector_mask <- function(d) {
  s <- max(abs(d)); if (s == 0) return(list(mask = seq_along(d), gap = 1))
  gaps <- vapply(seq_along(d), function(k) if (length(d) == 1) 1 else min(abs(d[k] - d[-k])) / s, 0)
  bad <- which(gaps < 1e-8 | abs(d) <= 1e-13 * s)
  ok <- setdiff(seq_along(d), bad)
  list(mask = bad, gap = if (length(ok)) min(gaps[ok]) else 1)
}

# Align columns of complex eigenvectors (same rules as alignComplexColumns in test/helpers/linalg.ts):
# mask columns are NaN; the others are rotated so that "the first component whose absolute value is >= (1 - 1e-8) times the maximum" is a positive real
align_complex <- function(M, mask) {
  for (k in seq_len(ncol(M))) {
    if (k %in% mask) { M[, k] <- NaN; next }
    a <- Mod(M[, k]); i <- which(a >= max(a) * (1 - 1e-8))[1]
    M[, k] <- M[, k] * Conj(M[i, k]) / Mod(M[i, k])
    M[i, k] <- complex(real = Re(M[i, k]), imaginary = 0)
  }
  M
}
