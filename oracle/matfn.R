# oracle-platform: amd64
# (x86_64 R: arm64 R's Fortran fuses multiply-adds in expm's Padé and Taylor code, which moves their last bits)
source("/oracle/_linalg.R")
suppressPackageStartupMessages({library(Matrix); library(expm)})

# Linear algebra beyond base (ROADMAP: possible later): the real Schur decomposition (Matrix::Schur, LAPACK dgees)
# and the matrix exponential (expm::expm). Fixtures:
#   schur  x (square matrix): T (quasi-triangular), Q (orthogonal), EValues (real and imaginary parts). The
#          decomposition is not unique (order and signs), so a test should check x = Q T Q', the structure of T and
#          the eigenvalues, and compare T and Q with R's only where LAPACK's choices are reproduced.
#   expm   x, method ("Higham08.b", the default, "Higham08", "Pade", "Taylor", "PadeO", "TaylorO"): the matrix.
#          Where x is symmetric, "reference" holds V diag(exp(lambda)) V' from an eigendecomposition in Rmpfr
#          (512 bits, Jacobi), to judge R's accuracy.
set.seed(20261126)
mats <- list(
  matrix(c(4, 1, 2, 0.5, 3, 1, 2, 1, 5), 3),
  matrix(c(0, 1, -1, 0), 2),                                          # rotation: complex eigenvalues
  round(matrix(rnorm(16), 4), 3),
  round(crossprod(matrix(rnorm(16), 4)), 3),                         # symmetric positive definite
  diag(c(1, 2, 3)),
  matrix(c(1, 1, 0, 1), 2),                                           # Jordan block
  round(matrix(rnorm(25), 5) * 3, 3)
)
write_linalg_fixture("schur", lapply(mats, function(m) list(x = m)), function(a) {
  s <- Matrix::Schur(a$x, vectors = TRUE)
  ev <- s$EValues
  list(T = mat_out(as.matrix(s$T)), Q = mat_out(as.matrix(s$Q)), EValuesRe = vec_out(Re(ev)), EValuesIm = vec_out(Im(ev)))
})
ecases <- list()
for (m in mats) for (meth in c("Higham08.b", "Higham08", "Pade", "Taylor", "PadeO", "TaylorO")) ecases[[length(ecases) + 1]] <- list(x = m, method = meth)
ecases[[length(ecases) + 1]] <- list(x = matrix(c(-49, -64, 24, 31), 2), method = "Higham08.b")    # Moler & Van Loan's example
ecases[[length(ecases) + 1]] <- list(x = round(matrix(rnorm(9), 3) * 20, 2), method = "Higham08.b")  # large norm
suppressPackageStartupMessages(library(Rmpfr))
ref_expm_sym <- function(x) {
  n <- nrow(x); A <- mpfr(x, 512); V <- mpfr(diag(n), 512)
  for (sweep in 1:100) {
    off <- 0
    for (p in 1:(n - 1)) for (q in (p + 1):n) {
      if (abs(asNumeric(A[p, q])) < 1e-300) next
      off <- off + asNumeric(abs(A[p, q]))
      theta <- (A[q, q] - A[p, p]) / (2 * A[p, q])
      t <- sign(asNumeric(theta)) / (abs(theta) + sqrt(theta^2 + 1)); if (asNumeric(theta) == 0) t <- mpfr(1, 512)
      c <- 1 / sqrt(t^2 + 1); s <- t * c
      for (k in 1:n) { akp <- A[k, p]; akq <- A[k, q]; A[k, p] <- c * akp - s * akq; A[k, q] <- s * akp + c * akq }
      for (k in 1:n) { apk <- A[p, k]; aqk <- A[q, k]; A[p, k] <- c * apk - s * aqk; A[q, k] <- s * apk + c * aqk }
      for (k in 1:n) { vkp <- V[k, p]; vkq <- V[k, q]; V[k, p] <- c * vkp - s * vkq; V[k, q] <- s * vkp + c * vkq }
    }
    if (off < 1e-140) break
  }
  E <- mpfr(matrix(0, n, n), 512); for (i in 1:n) E[i, i] <- exp(A[i, i])
  asNumeric(V %*% E %*% t(V))
}
write_linalg_fixture("expm", ecases, function(a) list(value = mat_out(expm::expm(a$x, method = a$method))),
  ref = function(a) if (isSymmetric(a$x)) list(value = mat_out(ref_expm_sym(a$x))) else NULL)
