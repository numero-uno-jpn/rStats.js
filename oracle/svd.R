source("/oracle/_linalg.R")

# svd, norm (type = "2"), kappa, MASS::ginv

set.seed(20261025)
orth <- function(n) qr.Q(qr(rmat(n, n)))
mats <- list(
  matrix(5, 1, 1), matrix(-5, 1, 1), matrix(c(1, 2, 3), 1, 3), matrix(c(1, 2, 3), 3, 1),
  matrix(c(1, 2, 3, 4, 5, 6), 3, 2), t(matrix(c(1, 2, 3, 4, 5, 6), 3, 2)),
  rmat(4, 4), rmat(6, 4), rmat(4, 6), rmat(10, 10), rmat(30, 7), rmat(7, 30), rmat(25, 25),
  orth(5) %*% diag(c(3, 3, 1, 0.5, 0.1)) %*% t(orth(5)),     # repeated singular values
  orth(4) %*% diag(c(2, 1, 1, 1)) %*% t(orth(4)),
  diag(c(3, -1, 2)), diag(c(1e-200, 1, 1e200)), matrix(0, 3, 2), matrix(0, 2, 2),
  matrix(1:12, 4, 3) + 0, crossprod(rmat(3, 6)),              # rank deficient
  hilbert(8), rmat(5, 3, 1e150), rmat(5, 3, 1e-150),
  cbind(rnorm(6) * 1e8, rnorm(6), rnorm(6) * 1e-8),
  matrix(c(1, NaN, 3, 4), 2, 2), matrix(c(1, Inf, 3, 4), 2, 2)
)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
for (m in mats) {
  n <- nrow(m); p <- ncol(m)
  add(x = m)
  add(x = m, nu = 0, nv = 0)
  add(x = m, nu = n, nv = p)
  add(x = m, nu = 1, nv = 0)
}
add(x = rmat(4, 3), nu = 6, nv = 5)
cases <- lapply(cases, function(a) {
  if (!all(is.finite(a$x))) return(a)
  vm <- vector_mask(svd(a$x, 0, 0)$d)
  if (length(vm$mask)) a$mask <- I(vm$mask)
  a$gap <- vm$gap
  a
})
write_linalg_fixture("svd", cases, function(a) {
  s <- call_with(svd, list(a$x, nu = a$nu, nv = a$nv))
  mask <- c(a$mask, seq_len(max(ncol(s$u) %||% 0, ncol(s$v) %||% 0))[-seq_along(s$d)])
  out <- list(d = vec_out(s$d))
  if (!is.null(s$u) && ncol(s$u) > 0) {
    al <- align_columns(s$u, mask, if (!is.null(s$v) && ncol(s$v) > 0) s$v)
    out$u <- mat_out(al$M)
    if (!is.null(al$partner)) out$v <- mat_out(al$partner)
  } else if (!is.null(s$v) && ncol(s$v) > 0) {
    out$v <- mat_out(align_columns(s$v, mask)$M)
  }
  out
})

cases <- list()
for (m in mats) add(x = m, type = "2")
write_linalg_fixture("norm2", cases, function(a) list(value = num2str(norm(a$x, "2"))))

cases <- list()
for (m in mats) {
  if (nrow(m) != ncol(m) || !all(is.finite(m))) next
  add(z = m)
  add(z = m, exact = TRUE)
  add(z = m, exact = TRUE, norm = "1")
  add(z = m, exact = TRUE, norm = "I")
  add(z = m, exact = TRUE, norm = "F")
  add(z = m, exact = TRUE, norm = "M")
  add(z = m, norm = "1")
  add(z = m, norm = "I")
  add(z = m, method = "direct")
  add(z = m, method = "direct", norm = "I")
  add(z = m, method = "direct", triangular = TRUE)
  add(z = m, method = "direct", triangular = TRUE, uplo = "L")
}
for (m in list(rmat(6, 4), rmat(4, 6), matrix(1:6, 3, 2) + 0)) {
  add(z = m)
  add(z = m, exact = TRUE)
  add(z = m, norm = "I")
}
add(z = rmat(3, 3), method = "direct", norm = "2")
# Condition number (estimates are sensitive to rounding differences in the decomposition in proportion to it, so the tests widen the tolerance)
cases <- lapply(cases, function(a) { if (nrow(a$z) == ncol(a$z)) a$cond <- kappa(a$z, exact = TRUE); a })
write_linalg_fixture("kappa", cases, function(a)
  list(value = num2str(call_with(kappa, list(a$z, exact = a$exact, norm = a$norm, method = a$method,
                                             triangular = a$triangular, uplo = a$uplo)))))

cases <- list()
for (m in mats) {
  add(x = m)
  if (all(is.finite(m)) && any(m != 0)) add(x = m, tol = 1e-3)
}
cases <- lapply(cases, function(a) {
  if (all(is.finite(a$x)) && any(a$x != 0)) {
    d <- svd(a$x, 0, 0)$d; keep <- d[d > max((a$tol %||% sqrt(.Machine$double.eps)) * d[1], 0)]
    a$cond <- max(keep) / min(keep)
  }
  a
})
write_linalg_fixture("ginv", cases, function(a)
  list(value = mat_out(call_with(MASS::ginv, list(a$x, tol = a$tol)))))
