source("/oracle/_linalg.R")

# crossprod, tcrossprod, norm, backsolve, forwardsolve

set.seed(20261021)
mats <- list(
  matrix(3, 1, 1),
  rmat(5, 3), rmat(3, 5), rmat(20, 7), rmat(4, 4),
  matrix(1:12, 4, 3) + 0,
  rmat(6, 3, 1e150), rmat(6, 3, 1e-150), rmat(5, 2, 1e200),
  # columns that cancel each other
  cbind(c(1, 1e-8, -1), c(1, 1, 1), c(1e8, 1, -1e8)),
  matrix(c(1, NaN, Inf, 2, -Inf, 0), 3, 2),
  matrix(c(1, NA, 3, 4), 2, 2),
  hilbert(6)
)

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (m in mats) add(x = m)
for (m in mats[2:6]) add(x = m, y = rmat(nrow(m), 2))
add(x = I(c(1, 2, 3)))
add(x = I(c(1, 2, 3)), y = matrix(1:6, 3, 2) + 0)
add(x = rmat(3, 2), y = rmat(4, 2))  # row counts differ
write_linalg_fixture("crossprod", cases, function(a)
  list(value = mat_out(if (is.null(a$y)) crossprod(a$x) else crossprod(a$x, a$y))))

cases <- list()
for (m in mats) add(x = m)
for (m in mats[2:6]) add(x = m, y = rmat(3, ncol(m)))
add(x = I(c(1, 2, 3)))
add(x = rmat(3, 2), y = rmat(3, 4))  # column counts differ
write_linalg_fixture("tcrossprod", cases, function(a)
  list(value = mat_out(if (is.null(a$y)) tcrossprod(a$x) else tcrossprod(a$x, a$y))))

cases <- list()
for (m in mats) for (t in c("O", "I", "F", "M")) add(x = m, type = t)
for (t in c("o", "1", "i", "f", "e", "m", "One", "X")) add(x = rmat(3, 4), type = t)
add(x = rmat(3, 4))
add(x = matrix(c(1e300, 1e300, 1e300, 1e300), 2, 2), type = "F")
add(x = matrix(c(1e-300, 1e-320, 3e-310, 0), 2, 2), type = "F")
add(x = matrix(0, 3, 2), type = "F")
write_linalg_fixture("norm", cases, function(a)
  list(value = num2str(call_with(norm, list(a$x, type = a$type)))))

# Triangular matrices: well conditioned (larger diagonal) and ill conditioned
utri <- function(n, d = 3) { r <- rmat(n, n); r[lower.tri(r)] <- rnorm(sum(lower.tri(r))) * 100; diag(r) <- d + abs(diag(r)); r }
cases <- list()
for (fn in c("backsolve", "forwardsolve")) {
  for (n in c(1, 2, 5, 12)) {
    r <- utri(n)
    if (fn == "forwardsolve") r <- t(r)
    add(fn = fn, r = r, x = I(rnorm(n)))
    add(fn = fn, r = r, x = rmat(n, 3))
    add(fn = fn, r = r, x = rmat(n, 2), transpose = TRUE)
    add(fn = fn, r = t(r), x = I(rnorm(n)), upperTri = fn == "forwardsolve")
    if (n > 1) add(fn = fn, r = r, x = rmat(n, 2), k = n - 1)
  }
  r <- utri(4)
  if (fn == "forwardsolve") r <- t(r)
  add(fn = fn, r = r, x = I(rnorm(6)))  # right-hand side too long (only the first k rows are used)
  add(fn = fn, r = r, x = I(rnorm(3)))  # right-hand side too short
  add(fn = fn, r = r, x = I(rnorm(4)), k = 5)
  add(fn = fn, r = r, x = I(rnorm(4)), k = 0)
  r0 <- r; r0[3, 3] <- 0
  add(fn = fn, r = r0, x = I(rnorm(4)))
  add(fn = fn, r = r, x = I(c(1, NaN, 2, 3)))
  add(fn = fn, r = r, x = I(c(1e300, -1e300, 1e300, 1)))
  rh <- utri(8, 1e-6)
  if (fn == "forwardsolve") rh <- t(rh)
  add(fn = fn, r = rh, x = I(rnorm(8)))
  add(fn = fn, r = matrix(1:6, 3, 2) + 0, x = I(c(1, 2, 3)))  # rectangular (k = 2)
}
write_linalg_fixture("backsolve", cases, function(a) {
  f <- if (a$fn == "backsolve") backsolve else forwardsolve
  v <- call_with(f, list(a$r, unclass(a$x), k = a$k, upper.tri = a$upperTri, transpose = a$transpose))
  list(value = if (is.matrix(v)) mat_out(v) else vec_out(v))
})
