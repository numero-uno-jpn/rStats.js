source("/oracle/_linalg.R")
suppressMessages(library(gmp))

# solve, determinant (det), rcond
# Reference: solve and determinant are computed exactly with gmp rationals (double inputs are exactly representable as rationals)

set.seed(20261024)
mats <- list(
  matrix(3, 1, 1), matrix(c(2, 1, 1, 3), 2, 2), matrix(c(0, 1, 1, 0), 2, 2),
  rmat(3, 3), rmat(5, 5), rmat(10, 10), rmat(30, 30),
  matrix(c(1, 2, 3, 4, 5, 6, 7, 8, 10), 3, 3),
  hilbert(4), hilbert(6), hilbert(10), hilbert(12),
  matrix(c(1, 2, 2, 4), 2, 2), matrix(c(1, 2, 2, 4 + 1e-15), 2, 2), matrix(c(1, 2, 2, 4 + 1e-12), 2, 2),
  matrix(0, 2, 2), matrix(c(0, 0, 1, 2), 2, 2),
  diag(c(1e-200, 1, 1e200)), rmat(4, 4, 1e150), rmat(4, 4, 1e-150),
  diag(200) * 10, diag(c(-1, 2, -3)),
  matrix(c(1, NaN, 2, 4), 2, 2), matrix(c(1, Inf, 2, 4), 2, 2),
  matrix(1:6, 2, 3) + 0
)
exact_ok <- function(m) all(is.finite(m)) && nrow(m) == ncol(m) && nrow(m) <= 12
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (m in mats) {
  n <- nrow(m)
  add(a = m)
  add(a = m, b = I(rnorm(n)))
  add(a = m, b = rmat(n, 2))
}
add(a = matrix(c(1, 2, 2, 4 + 1e-15), 2, 2), tol = 0)
add(a = hilbert(12), tol = 0)
add(a = hilbert(10), tol = 1e-10)
add(a = matrix(c(2, 1, 1, 3), 2, 2), b = I(c(1, 2, 3)))
mat_q <- function(m) matrix(as.bigq(m), nrow(m))
# Condition number (used by the tests to widen the rounding tolerance)
with_cond <- function(a, key) {
  m <- a[[key]]
  if (all(is.finite(m)) && nrow(m) == ncol(m) && any(m != 0)) a$cond <- kappa(m, exact = TRUE)
  a
}
cases <- lapply(cases, with_cond, "a")
write_linalg_fixture("solve", cases, function(a) {
  v <- call_with(solve, list(a$a, unclass(a$b), tol = a$tol))
  list(value = if (is.matrix(v)) mat_out(v) else vec_out(v))
}, ref = function(a) {
  if (!exact_ok(a$a) || (!is.null(a$b) && !all(is.finite(a$b)))) return(NULL)
  b <- if (is.null(a$b)) diag(nrow(a$a)) else unclass(a$b)
  # gmp's solve does not accept a multi-column right-hand side for a 1-row matrix, so solve column by column
  b <- as.matrix(b); A <- mat_q(a$a)
  v <- tryCatch(vapply(seq_len(ncol(b)), function(j) as.numeric(solve(A, mat_q(b[, j, drop = FALSE]))), numeric(nrow(b))),
                error = function(e) { message("no reference value: ", conditionMessage(e), " ", paste(dim(a$a), collapse = "x")); NULL })
  if (is.null(v)) return(NULL)
  v <- matrix(v, nrow(b))
  list(value = if (is.null(a$b) || is.matrix(a$b)) mat_out(v) else vec_out(v))
})

# Rational determinant (Gaussian elimination)
det_q <- function(m) {
  n <- nrow(m)
  rows <- lapply(seq_len(n), function(i) as.bigq(m[i, ]))
  d <- as.bigq(1)
  for (k in seq_len(n)) {
    p <- k
    while (p <= n && rows[[p]][k] == 0) p <- p + 1
    if (p > n) return(as.bigq(0))
    if (p != k) { t <- rows[[k]]; rows[[k]] <- rows[[p]]; rows[[p]] <- t; d <- -d }
    d <- d * rows[[k]][k]
    if (k < n) for (i in (k + 1):n) rows[[i]] <- rows[[i]] - rows[[i]][k] / rows[[k]][k] * rows[[k]]
  }
  d
}
cases <- list()
for (m in mats) {
  add(x = m)
  add(x = m, logarithm = FALSE)
}
cases <- lapply(cases, with_cond, "x")
write_linalg_fixture("determinant", cases, function(a) {
  d <- call_with(determinant, list(a$x, logarithm = a$logarithm))
  list(modulus = num2str(as.vector(d$modulus)), sign = num2str(d$sign), det = num2str(det(a$x)))
}, ref = function(a) {
  if (!exact_ok(a$x)) return(NULL)
  d <- det_q(a$x)
  if (d == 0) return(NULL)
  ad <- Rmpfr::.bigq2mpfr(abs(d), 256)
  list(modulus = num2str(as.numeric(if (isFALSE(a$logarithm)) ad else log(ad))),
       det = num2str(as.numeric(Rmpfr::.bigq2mpfr(d, 256))))
})

cases <- list()
for (m in mats) {
  for (nm in c("O", "I")) add(x = m, norm = nm)
  add(x = m, norm = "O", triangular = TRUE)
  add(x = m, norm = "I", triangular = TRUE, uplo = "L")
}
add(x = rmat(5, 3)); add(x = rmat(3, 5)); add(x = rmat(5, 3), norm = "I")
add(x = rmat(3, 3), norm = "1"); add(x = rmat(3, 3), norm = "F")
cases <- lapply(cases, with_cond, "x")
write_linalg_fixture("rcond", cases, function(a)
  list(value = num2str(call_with(rcond, list(a$x, norm = a$norm, triangular = a$triangular, uplo = a$uplo)))))
