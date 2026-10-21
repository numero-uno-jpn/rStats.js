source("/oracle/_linalg.R")

# chol (without and with pivoting), chol2inv

set.seed(20261022)
spd <- function(n, cond = 1) { q <- qr.Q(qr(rmat(n, n))); q %*% diag(cond^(-(seq_len(n) - 1) / max(n - 1, 1))) %*% t(q) }
lowrank <- function(n, r) crossprod(rmat(r, n))
mats <- list(
  matrix(4, 1, 1), matrix(c(4, 2, 2, 3), 2, 2),
  spd(3), spd(5), spd(10), spd(30),
  spd(6, 1e8), spd(8, 1e14), hilbert(6), hilbert(10),
  crossprod(rmat(10, 4)) * 1e150, crossprod(rmat(10, 4)) * 1e-150,
  matrix(c(4, 99, 2, 3), 2, 2),             # lower triangle is not used
  matrix(c(1, 2, 2, 1), 2, 2),              # not positive definite
  lowrank(5, 3), lowrank(6, 1),             # rank deficient
  matrix(c(1, 1, 1, 1, 1, 1, 1, 1, 2), 3, 3),
  matrix(c(-1, 0, 0, -2), 2, 2), matrix(c(1, 0.5, 0.5, -3), 2, 2),
  matrix(0, 1, 1), matrix(0, 3, 3),
  matrix(c(NaN, 2, 2, 3), 2, 2), matrix(c(4, 2, NaN, 3), 2, 2), matrix(c(1, 0, 0, NaN), 2, 2),
  matrix(c(Inf, 0, 0, 1), 2, 2),
  matrix(1:6, 2, 3) + 0                     # not square
)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
# For positive semidefinite rank-deficient matrices, success without pivoting depends on rounding, so only the pivoted version is used
for (m in mats) {
  if (!any(vapply(mats[15:16], identical, TRUE, m))) add(x = m)
  add(x = m, pivot = TRUE)
}
add(x = lowrank(6, 3) + diag(1e-9, 6), pivot = TRUE)
add(x = lowrank(6, 3) + diag(1e-9, 6), pivot = TRUE, tol = 1e-6)
add(x = lowrank(6, 3) + diag(1e-9, 6), pivot = TRUE, tol = 1e-12)
add(x = spd(5), pivot = TRUE, tol = 0)
# Condition number (used by the tests to widen the rounding tolerance; for pivoted, that of the factorised part)
cases <- lapply(cases, function(a) {
  r <- tryCatch(suppressWarnings(call_with(chol, list(a$x, pivot = a$pivot, tol = a$tol))), error = function(e) NULL)
  if (is.null(r) || !all(is.finite(a$x))) return(a)
  k <- if (isTRUE(a$pivot)) attr(r, "rank") else nrow(a$x)
  p <- if (isTRUE(a$pivot)) attr(r, "pivot")[seq_len(k)] else seq_len(k)
  if (k > 0) { s <- a$x[p, p, drop = FALSE]; s[lower.tri(s)] <- t(s)[lower.tri(s)]; a$cond <- kappa(s, exact = TRUE) }
  a
})
write_linalg_fixture("chol", cases, function(a) {
  r <- suppressWarnings(call_with(chol, list(a$x, pivot = a$pivot, tol = a$tol)))
  out <- list(value = mat_out(r))
  if (isTRUE(a$pivot)) { out$pivot <- vec_out(attr(r, "pivot")); out$rank <- num2str(attr(r, "rank")) }
  out
})

cases <- list()
for (m in mats[1:12]) {
  r <- chol(m)
  add(x = r)
  if (nrow(r) > 2) add(x = r, size = nrow(r) - 1)
}
add(x = matrix(c(2, 5, 1, 3), 2, 2))           # lower triangle is not used
add(x = matrix(c(2, 1, NaN, 3), 2, 2))
add(x = matrix(c(1, 0, 0, 0), 2, 2))           # 0 on the diagonal
add(x = matrix(1:6, 3, 2) + 0)                 # tall (size = 2)
add(x = matrix(1:6, 2, 3) + 0)                 # wide (size = 3 > number of rows)
add(x = matrix(c(4, 2, 0, 3), 2, 2), size = 3)
add(x = matrix(c(4, 2, 0, 3), 2, 2), size = 0)
add(x = I(2))
add(x = I(c(2, 3)))
add(x = rmat(4, 4) + diag(5, 4))               # lower triangle has values
write_linalg_fixture("chol2inv", cases, function(a)
  list(value = mat_out(call_with(chol2inv, list(unclass(a$x), size = a$size)))))
