source("/oracle/_linalg.R")

# qr (LINPACK-style default and LAPACK = TRUE) and the functions that use it

set.seed(20261023)
a <- rnorm(6); b <- rnorm(6)
mats <- list(
  matrix(3, 1, 1), matrix(c(1, 2), 1, 2), matrix(c(3, 4), 2, 1), matrix(0, 3, 2),
  matrix(c(1, 2, 3, 4, 5, 6.5), 3, 2),
  rmat(10, 3), rmat(30, 5), rmat(4, 4), rmat(8, 8), rmat(2, 3), rmat(3, 7),
  matrix(1:9, 3, 3) + 0, matrix(1:12, 4, 3) + 0,
  cbind(1, 1:4, 2 * (1:4), c(1, 0, 0, 1)),
  cbind(1, 0, 1:3), cbind(0, 0, 1:3), cbind(1:3, 0),
  cbind(1:3, 1e-8 * c(1, -2, 1) + 1:3), cbind(1:3, 1e-5 * c(1, -2, 1) + 1:3),
  cbind(a, a, a), cbind(a, b, a + b, b), cbind(a, b, a, a + b, rnorm(6)),
  cbind(a, b, 2 * a - b, rnorm(6), a),
  cbind(a, b + 1e-9 * rnorm(6), b), cbind(a, b, b + 1e-6 * rnorm(6)),
  # Factor dummy variables plus intercept (columns sum to the intercept, so rank deficient)
  cbind(1, rep(c(1, 0, 0), 4), rep(c(0, 1, 0), 4), rep(c(0, 0, 1), 4), rnorm(12)),
  hilbert(6), hilbert(12),
  cbind(rnorm(8) * 1e10, rnorm(8) * 1e-10, rnorm(8)),
  rmat(6, 3, 1e150), rmat(6, 3, 1e-150),
  t(rmat(5, 3)) %*% rmat(5, 6)   # 3 × 6, rank 3
)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (m in mats) {
  add(x = m)
  add(x = m, LAPACK = TRUE)
}
add(x = cbind(a, b, b + 1e-6 * rnorm(6)), tol = 1e-4)
add(x = cbind(a, b + 1e-9 * rnorm(6), b), tol = 1e-12)
add(x = hilbert(12), tol = 1e-12)
add(x = hilbert(12), tol = 0)
add(x = matrix(c(1, NaN, 3, 4), 2, 2))
add(x = matrix(c(1, Inf, 3, 4), 2, 2))
# (added later, at the end) wide matrices with LAPACK: qraux has min(n, p) elements
# (fixed matrices: random ones here would shift the random numbers of the cases below)
wide <- list(matrix(c(2, -1, 0.5, 3, 1, -2, 0.7, 4, -1.5, 1, 2.2, -0.3, 5, 1, 1, -2, 0.1, 3), 3, 6),
             matrix(c(1, 4, -2, 0.5, 3, 3, -1, 2, 0.25, -6), 2, 5), matrix(c(3, -1, 2, 0.5), 1, 4))
for (m in wide) for (lp in c(FALSE, TRUE)) add(x = m, LAPACK = lp)

# Put the numerical rank numRank and the condition number cond of the columns within it into args.
# For linearly dependent columns (after numRank in pivoted order) the transformation vectors are determined by rounding error alone,
# and their direction changes completely with the order of operations. They are not compared (set to NaN in both the oracle and the tests).
# Columns only about 1e-8 away from dependence have rounding differences that grow with the condition number, so the tests widen the tolerance by cond
with_cond <- function(a) {
  q <- tryCatch(call_with(qr, list(a$x, tol = a$tol, LAPACK = a$LAPACK)), error = function(e) NULL)
  r <- num_rank(a$x)
  if (is.null(q) || is.na(r)) return(a)
  a$numRank <- r
  if (r > 0) a$cond <- kappa(a$x[, q$pivot[seq_len(r)], drop = FALSE], exact = TRUE)
  a
}
cases <- lapply(cases, with_cond)
write_linalg_fixture("qr", cases, function(a) {
  q <- call_with(qr, list(a$x, tol = a$tol, LAPACK = a$LAPACK))
  m <- q$qr; aux <- q$qraux
  if (!is.null(a$numRank)) for (j in seq_len(ncol(m))) if (j > a$numRank) {
    if (j < nrow(m)) m[(j + 1):nrow(m), j] <- NaN
    aux[j] <- NaN
  }
  list(qr = mat_out(m), qraux = vec_out(aux), rank = num2str(q$rank), pivot = vec_out(q$pivot))
})

# Functions that use the decomposition (y is a vector or a 2-column matrix)
# For numerically rank-deficient matrices, functions that use the rounding-determined transformation (LAPACK-style Q, qy, qty, coef)
# cannot be compared meaningfully, so they are not generated (qr.X can be compared because Q R = X)
fcases <- list()
addf <- function(...) fcases[[length(fcases) + 1]] <<- Filter(Negate(is.null), list(...))
for (m in mats) {
  if (!all(is.finite(m))) next
  n <- nrow(m)
  for (lap in c(FALSE, TRUE)) {
    L <- if (lap) TRUE else NULL
    y <- rnorm(n); Y <- rmat(n, 2)
    deficient <- lap && num_rank(m) < min(dim(m))
    for (fn in c("coef", "qty", "qy", "fitted", "resid")) {
      if (deficient && fn %in% c("coef", "qty", "qy")) next
      addf(fn = fn, x = m, LAPACK = L, y = I(y))
      addf(fn = fn, x = m, LAPACK = L, y = Y)
    }
    if (!deficient) {
      addf(fn = "Q", x = m, LAPACK = L)
      addf(fn = "Q", x = m, LAPACK = L, complete = TRUE)
    }
    addf(fn = "R", x = m, LAPACK = L)
    addf(fn = "R", x = m, LAPACK = L, complete = TRUE)
    addf(fn = "X", x = m, LAPACK = L)
    if (!deficient) addf(fn = "X", x = m, LAPACK = L, complete = TRUE)
    if (ncol(m) > 1) addf(fn = "X", x = m, LAPACK = L, ncol = ncol(m) - 1)
    if (!lap) {
      addf(fn = "solve", x = m)
      addf(fn = "solve", x = m, y = I(y))
      addf(fn = "fitted", x = m, y = I(y), k = max(qr(m)$rank - 1, 0))
    }
  }
}
addf(fn = "Q", x = rmat(5, 3), dvec = I(c(2, -1, 0.5)))
addf(fn = "Q", x = rmat(5, 3), dvec = I(c(2, -1, 0.5, 1, 3)), complete = TRUE)
addf(fn = "coef", x = rmat(5, 3), y = I(rnorm(4)))   # row counts differ
addf(fn = "solve", x = rmat(4, 4), tol = 1e-3)
fcases <- lapply(fcases, with_cond)
write_linalg_fixture("qrFunctions", fcases, function(a) {
  q <- call_with(qr, list(a$x, tol = a$tol, LAPACK = a$LAPACK))
  y <- unclass(a$y)
  v <- switch(a$fn,
    coef = qr.coef(q, y), qty = qr.qty(q, y), qy = qr.qy(q, y),
    fitted = call_with(qr.fitted, list(q, y, k = a$k)), resid = qr.resid(q, y),
    Q = call_with(qr.Q, list(q, complete = a$complete, Dvec = unclass(a$dvec))),
    R = call_with(qr.R, list(q, complete = a$complete)),
    X = call_with(qr.X, list(q, complete = a$complete, ncol = a$ncol)),
    solve = call_with(qr.solve, list(a$x, y, tol = a$tol)))
  list(value = if (is.matrix(v)) mat_out(v) else vec_out(v))
})
