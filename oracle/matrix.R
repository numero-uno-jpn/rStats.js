source("/oracle/_linalg.R")

# Matrix arithmetic and constructors: %*%, elementwise + - * / (with R's recycling), outer, t, diag, cbind, rbind,
# matrix, kronecker, seq; Matrix::lu and prcomp.

set.seed(20261025)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
out_any <- function(r) if (is.matrix(r)) mat_out(r) else vec_out(r)

# --- %*% (vectors are treated as R does: a row or a column, whichever conforms) ---------------------------
mats <- list(rmat(3, 4), rmat(4, 2), rmat(2, 2), matrix(1:6, 2, 3) + 0, rmat(5, 3, 1e150), hilbert(4))
for (a in mats) for (b in mats) if (ncol(a) == nrow(b)) add(x = a, y = b)
add(x = mats[[1]], y = mats[[1]]); add(x = mats[[3]], y = mats[[1]][1:3, ])  # non-conformable
add(x = I(c(1, 2, 3)), y = I(c(4, 5, 6)))            # inner product (1 x 1)
add(x = I(c(1, 2, 3)), y = matrix(1:6, 3, 2) + 0)     # vector times matrix
add(x = matrix(1:6, 2, 3) + 0, y = I(c(1, 0, -1)))    # matrix times vector
add(x = matrix(c(1, NaN, Inf, 2), 2, 2), y = rmat(2, 2))
write_linalg_fixture("matMul", cases, function(a) list(value = out_any(a$x %*% a$y)))

# --- elementwise + - * / ----------------------------------------------------------------------------------
cases <- list()
A <- rmat(3, 2); B <- rmat(3, 2)
for (op in c("+", "-", "*", "/")) {
  add(op = op, x = A, y = B)
  add(op = op, x = A, y = 2.5)
  add(op = op, x = 2.5, y = A)
  add(op = op, x = A, y = I(c(1, 2, 3)))            # recycled down the columns
  add(op = op, x = A, y = I(c(1, 2)))               # length 2 into 6 elements
  add(op = op, x = A, y = I(c(1, 2, 3, 4)))         # not a multiple: R warns and recycles
  add(op = op, x = A, y = rmat(2, 3))               # non-conformable
  add(op = op, x = I(c(1, 2, 3, 4)), y = I(c(10, 20)))
  add(op = op, x = I(c(1, 0, -1)), y = I(c(0, 0, 0)))
}
write_linalg_fixture("arith", cases, function(a) list(value = out_any(get(a$op)(a$x, a$y))))

# --- outer, t, diag, cbind, rbind, matrix, kronecker ------------------------------------------------------
cases <- list()
for (fn in c("*", "+", "-", "/", "^")) {
  add(x = I(c(1, 2, 3)), y = I(c(4, 5)), fun = fn)
  add(x = I(c(0.5)), y = I(c(-1, 0, 2)), fun = fn)
}
write_linalg_fixture("outer", cases, function(a) list(value = mat_out(outer(a$x, a$y, a$fun))))

cases <- list()
for (m in c(mats, list(matrix(5, 1, 1)))) add(x = m)
add(x = I(c(1, 2, 3)))
write_linalg_fixture("transpose", cases, function(a) list(value = mat_out(t(a$x))))

cases <- list()
add(x = rmat(3, 3)); add(x = rmat(2, 4)); add(x = rmat(4, 2))     # matrix: its diagonal
add(x = I(c(1, 2, 3)))                                          # vector: diagonal matrix
add(x = 3)                                                      # single number: identity of that size
add(x = I(c(2)))                                                # length-1 vector: also an identity of size 2 in R
add(x = 1, nrow = 2, ncol = 3)
add(x = I(c(1, 2)), nrow = 3)                                   # recycled
add(x = 0)
write_linalg_fixture("diag", cases, function(a) {
  x <- if (inherits(a$x, "AsIs")) unclass(a$x) else a$x
  list(value = out_any(call_with(diag, list(x = x, nrow = a$nrow, ncol = a$ncol))))
})

cases <- list()
add(x = rmat(3, 2), y = rmat(3, 1)); add(x = I(c(1, 2, 3)), y = I(c(4, 5, 6))); add(x = rmat(3, 2), y = I(c(9, 8, 7)))
add(x = rmat(3, 2), y = 1); add(x = rmat(3, 2), y = rmat(2, 2))
write_linalg_fixture("cbind", cases, function(a) list(value = mat_out(cbind(a$x, a$y))))
cases <- list()
add(x = rmat(2, 3), y = rmat(1, 3)); add(x = I(c(1, 2, 3)), y = I(c(4, 5, 6))); add(x = rmat(2, 3), y = I(c(9, 8, 7)))
add(x = rmat(2, 3), y = 1); add(x = rmat(2, 3), y = rmat(2, 2))
write_linalg_fixture("rbind", cases, function(a) list(value = mat_out(rbind(a$x, a$y))))

cases <- list()
add(data = I(1:6 + 0), nrow = 2); add(data = I(1:6 + 0), ncol = 2); add(data = I(1:6 + 0), nrow = 2, byrow = TRUE)
add(data = 0, nrow = 3, ncol = 2); add(data = I(c(1, 2)), nrow = 3, ncol = 2); add(data = I(c(1, 2, 3)), nrow = 2, ncol = 2)
add(data = I(1:6 + 0), nrow = 4)
write_linalg_fixture("matrix", cases, function(a)
  list(value = mat_out(call_with(matrix, list(data = unclass(a$data), nrow = a$nrow, ncol = a$ncol,
                                              byrow = isTRUE(a$byrow))))))

cases <- list()
add(x = rmat(2, 2), y = rmat(2, 3)); add(x = diag(2), y = matrix(1:4, 2, 2) + 0); add(x = I(c(1, 2)), y = I(c(1, 10)))
write_linalg_fixture("kronecker", cases, function(a) list(value = out_any(kronecker(a$x, a$y))))

# --- seq --------------------------------------------------------------------------------------------------
cases <- list()
add(from = 1, to = 10); add(from = 10, to = 1); add(from = 0, to = 1, by = 0.1); add(from = 1, to = 2, by = 0.3)
add(from = 0, to = 1, lengthOut = 11); add(from = 5, by = 2, lengthOut = 4); add(to = 5, by = 2, lengthOut = 4)
add(from = 0, to = 1, lengthOut = 1); add(from = 1.5, to = 4); add(from = 0, to = -1, by = -0.25)
add(from = 0, to = 1e-300, lengthOut = 3); add(from = 1, to = 1); add(from = 0, to = 0.3, by = 0.1)
add(from = 1, to = 10, by = -1); add(from = 0, to = 1, lengthOut = -1)
write_linalg_fixture("seq", cases, function(a)
  list(value = vec_out(call_with(seq, list(from = a$from, to = a$to, by = a$by, length.out = a$lengthOut)))))

# --- Matrix::lu (dense LU with partial pivoting, A = P L U) -----------------------------------------------
cases <- list()
for (m in list(rmat(3, 3), rmat(5, 5), hilbert(5), matrix(c(0, 1, 1, 0), 2, 2), matrix(c(1, 2, 2, 4), 2, 2),
               rmat(4, 4, 1e150), matrix(5, 1, 1), rmat(4, 3), rmat(3, 4)))
  add(x = m)
write_linalg_fixture("lu", cases, function(a) {
  e <- Matrix::expand(Matrix::lu(a$x))
  list(P = mat_out(as.matrix(e$P)), L = mat_out(as.matrix(e$L)), U = mat_out(as.matrix(e$U)))
})

# --- prcomp (rotation and scores aligned to a canonical sign, as align_columns does for svd) --------------
cases <- list()
X1 <- rmat(20, 4) %*% matrix(c(2, 0.5, 0, 0, 0, 1, 0.3, 0, 0, 0, 1, 0.2, 0, 0, 0, 0.1), 4, 4)
for (m in list(X1, rmat(10, 3), cbind(rnorm(15, 1e6), rnorm(15, 1e6, 1e-2), rnorm(15))))
  for (ce in c(TRUE, FALSE)) for (sc in c(FALSE, TRUE)) add(x = m, center = ce, scale = sc)
add(x = cbind(c(1, 2, 3), c(5, 5, 5)), center = TRUE, scale = TRUE)    # constant column cannot be scaled
write_linalg_fixture("prcomp", cases, function(a) {
  p <- prcomp(a$x, center = a$center, scale. = a$scale)
  m <- vector_mask(p$sdev)
  al <- align_columns(p$rotation, m$mask, p$x)
  out <- list(sdev = vec_out(p$sdev), rotation = mat_out(al$M), x = mat_out(al$partner))
  if (!isFALSE(p$center)) out$center <- vec_out(p$center)
  if (!isFALSE(p$scale)) out$scale <- vec_out(p$scale)
  out
})
