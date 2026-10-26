source("/oracle/_common.R")

lmp <- function(x) log(mp(x))
lg <- function(x) lgamma(mp(x))
fin <- function(...) all(is.finite(c(...)))
out <- function(ld, log) if (log) ld else exp(ld)

# ---- Beta distribution ----
ab <- c(0, 1e-10, 0.01, 0.5, 1, 1.5, 2, 2.5, 5, 10, 50, 100, 1000, 1e5, Inf)
bx <- c(0, 1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 0.001, 0.01, 0.1, 0.25, 0.4, 0.5,
        0.6, 0.75, 0.9, 0.99, 0.999, 1 - 1e-10, 1, -0.1, 1.1, NaN)
bgrid <- rbind(grid_of(x = bx, shape1 = ab, shape2 = c(0.5, 2.5, 100)),
               grid_of(x = bx, shape1 = c(0.5, 2.5, 100), shape2 = ab),
               data.frame(x = 0.3, shape1 = c(-1, 2, NaN), shape2 = c(2, -1, 2)),
               # (added later, at the end) shape 1: the terms with a = 1 or b = 1 are exactly 0, lbeta(1, 1) = 0
               grid_of(x = c(0.3, 0.5, 1e-300, 0.999, 1 - 1e-10), shape1 = 1, shape2 = c(1, 1.5, 2, 3, 0.5)),
               grid_of(x = c(0.3, 0.5, 1e-300, 0.999, 1 - 1e-10), shape1 = c(1.5, 2, 3, 0.5), shape2 = 1))
ref_dbeta <- function(x, a, b, log) {
  if (!(fin(x, a, b) && x > 0 && x < 1 && a > 0 && b > 0)) return(NA)
  out((mp(a) - 1) * lmp(x) + (mp(b) - 1) * log(1 - mp(x)) - (lg(a) + lg(b) - lg(mp(a) + b)), log)
}
write_fixture("dbeta", with_log(bgrid), function(r)
  dbeta(r$x, r$shape1, r$shape2, log = r$log),
  function(r) ref_dbeta(r$x, r$shape1, r$shape2, r$log))
names(bgrid)[1] <- "q"
write_fixture("pbeta", with_tails(bgrid), function(r)
  pbeta(r$q, r$shape1, r$shape2, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) if (is.finite(r$q) && r$q > 0 && r$q < 1)
    ref_betainc(r$shape1, r$shape2, r$q, r$lowerTail, r$logP) else NA)
qb <- unique(rbind(grid_of(shape1 = ab, shape2 = c(0.5, 2.5, 100)),
                   grid_of(shape1 = c(0.5, 2.5, 100), shape2 = ab),
                   data.frame(shape1 = c(-1, NaN), shape2 = c(2, 2))))
write_fixture("qbeta", quantile_grid(qb), function(r)
  qbeta(r$p, r$shape1, r$shape2, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Binomial distribution ----
sizes <- c(0, 1, 2, 5, 10, 20, 50, 100, 1000, 1e5, 1e7, 2.5, -1)
probs <- c(0, 1e-10, 0.001, 0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 1 - 1e-10, 1, -0.1, NaN)
nx <- c(0:12, 20, 25, 30, 50, 99, 100, 101, 500, 999, 1000, 5e4, 1e5, 1e7, 2.5, -1, Inf, NaN)
ngrid <- grid_of(x = nx, size = sizes, prob = probs)
ngrid <- ngrid[is.na(ngrid$x) | !is.finite(ngrid$x) | ngrid$x <= pmax(ngrid$size, 0) + 2 |
                 ngrid$x %in% c(0, 1, 5), ]
# Threshold for the integer check (R uses relative 1e-9 for both x and size)
ngrid <- rbind(ngrid, data.frame(x = c(2 + 1e-8, 2 + 9e-10, 1, 1), size = c(5, 5, 5 + 1e-8, 5 + 9e-10), prob = 0.5))
# (added later, at the end) size = Inf: the density is 0 (1 at x = 0 for prob = 0); pbinom stays NaN
ngrid <- rbind(ngrid, grid_of(x = c(0, 1, 3, 2.5, 1e10, -1, Inf, NaN), size = Inf, prob = c(0, 0.3, 1, -0.1, NaN)))
ref_dbinom <- function(x, n, p, log) {
  if (!(fin(x, n, p) && x >= 0 && x <= n && x == round(x) && n == round(n) && p > 0 && p < 1)) return(NA)
  out(lg(mp(n) + 1) - lg(mp(x) + 1) - lg(mp(n) - x + 1) + x * lmp(p) + (mp(n) - x) * log(1 - mp(p)), log)
}
write_fixture("dbinom", with_log(ngrid), function(r)
  dbinom(r$x, r$size, r$prob, log = r$log),
  function(r) ref_dbinom(r$x, r$size, r$prob, r$log))
names(ngrid)[1] <- "q"
# P[X <= x] = 1 - I_p(x + 1, n - x)
write_fixture("pbinom", with_tails(ngrid), function(r) {
  pbinom(r$q, r$size, r$prob, lower.tail = r$lowerTail, log.p = r$logP)
}, function(r) {
  x <- floor(r$q + 1e-7)
  if (!(fin(r$q, r$size, r$prob) && r$size == round(r$size) && x >= 0 && x < r$size &&
        r$prob > 0 && r$prob < 1)) return(NA)
  n <- r$size
  # With few terms, sum the binomial probabilities directly (positive terms, so no cancellation)
  pmf <- function(k) exp(lg(mp(n) + 1) - lg(mp(k) + 1) - lg(mp(n) - k + 1) +
                           k * lmp(r$prob) + (mp(n) - k) * log(1 - mp(r$prob)))
  # Sum the smaller side until the terms become negligible (2000 terms at a time)
  tail_sum <- function(ks) {
    s <- mp(0)
    for (st in seq(1, length(ks), by = 2000)) {
      blk <- pmf(ks[st:min(length(ks), st + 1999)])
      s <- s + sum(blk)
      if (asNumeric(blk[length(blk)] / s) < 2^-300) break
    }
    s
  }
  lo_sum <- function() tail_sum(x:0)
  up_sum <- function() tail_sum((x + 1):n)
  # On the near side of the mean the terms decrease monotonically, so the sum can stop early. The other side is 1 - (this side)
  mean <- n * r$prob
  small <- if (x < mean) lo_sum() else up_sum()
  small_is_lower <- x < mean
  if (r$lowerTail == small_is_lower) return(if (r$logP) log(small) else small)
  return(if (r$logP) log1p(-small) else 1 - small)
})
qn <- grid_of(size = sizes, prob = probs)
write_fixture("qbinom", quantile_grid(qn), function(r)
  qbinom(r$p, r$size, r$prob, lower.tail = r$lowerTail, log.p = r$logP))

# ---- t distribution ----
tdf <- c(1e-10, 0.1, 0.5, 1, 1.5, 2, 3, 5, 10, 30, 100, 1000, 1e5, 1e10, Inf, 0, -1, NaN)
tx <- c(-Inf, -1e300, -1e154, -1e100, -1e20, -1e10, -1e5, -1000, -100, -40, -20, -10, -5,
        -3, -2, -1.5, -1, -0.5, -0.1, -1e-5, -1e-10, -1e-300, 0, 1e-300, 1e-10, 1e-5, 0.1,
        0.5, 1, 1.5, 2, 3, 5, 10, 20, 40, 100, 1000, 1e5, 1e10, 1e20, 1e100, 1e154, 1e300,
        Inf, NaN)
tgrid <- grid_of(x = tx, df = tdf)
ref_dt <- function(x, n, log) {
  if (!(fin(x, n) && n > 0)) return(NA)
  N <- mp(n); X <- mp(x)
  out(lg((N + 1) / 2) - lg(N / 2) - 0.5 * log(N * Const("pi", MPFR_BITS)) -
        (N + 1) / 2 * log1p(X * X / N), log)
}
write_fixture("dt", with_log(tgrid), function(r) dt(r$x, r$df, log = r$log),
              function(r) ref_dt(r$x, r$df, r$log))
names(tgrid)[1] <- "q"
# P[T > |t|] = I_{n/(n+t^2)}(n/2, 1/2) / 2 (x and 1 - x are built exactly in mpfr)
ref_pt <- function(t, n, lower, log) {
  if (!(fin(t, n) && n > 0 && t != 0)) return(NA)
  # Rounding of x and 1 - x is amplified by the parameter, so build them with ample precision (6500 bits)
  T2 <- Rmpfr::mpfr(t, 6500)^2; N <- Rmpfr::mpfr(n, 6500)
  half <- ref_betainc(n / 2, 0.5, N / (N + T2), TRUE, FALSE, xc = T2 / (N + T2))
  if (is.na(half)) return(NA)
  small <- half / 2
  if ((t < 0) == lower) return(if (log) log(small) else small)
  if (log) log1p(-small) else 1 - small
}
write_fixture("pt", with_tails(tgrid), function(r)
  pt(r$q, r$df, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pt(r$q, r$df, r$lowerTail, r$logP))
write_fixture("qt", quantile_grid(data.frame(df = tdf)), function(r)
  qt(r$p, r$df, lower.tail = r$lowerTail, log.p = r$logP))

# ---- F distribution ----
fdf <- c(0.1, 0.5, 1, 1.5, 2, 3, 5, 10, 30, 100, 1e4, 1e6, Inf)
fx <- c(0, 1e-300, 1e-100, 1e-10, 1e-5, 0.001, 0.01, 0.1, 0.5, 0.9, 1, 1.1, 2, 3, 5, 10,
        30, 100, 1e5, 1e10, 1e100, 1e300, Inf, -1, NaN)
fgrid <- rbind(grid_of(x = fx, df1 = fdf, df2 = c(1, 5, 30, Inf)),
               grid_of(x = fx, df1 = c(1, 5, 30), df2 = fdf),
               data.frame(x = 1, df1 = c(-1, 2, 0, NaN), df2 = c(2, -1, 3, 2)))
fgrid <- unique(fgrid)
ref_df <- function(x, m, n, log) {
  if (!(fin(x, m, n) && x > 0 && m > 0 && n > 0)) return(NA)
  M <- mp(m); N <- mp(n); X <- mp(x)
  out(M / 2 * log(M) + N / 2 * log(N) + (M / 2 - 1) * log(X) -
        (lg(M / 2) + lg(N / 2) - lg((M + N) / 2)) - (M + N) / 2 * log(N + M * X), log)
}
write_fixture("df", with_log(fgrid), function(r) df(r$x, r$df1, r$df2, log = r$log),
              function(r) ref_df(r$x, r$df1, r$df2, r$log))
names(fgrid)[1] <- "q"
# P[F <= x] = I_{m x/(n + m x)}(m/2, n/2)
ref_pf <- function(x, m, n, lower, log) {
  # Infinite degrees of freedom: χ²_m / m (n = Inf) or n / χ²_n (m = Inf)
  if (is.finite(x) && x > 0 && is.finite(m) && m > 0 && n == Inf)
    return(ref_gammainc(m / 2, x * m / 2, lower, log))
  if (is.finite(x) && x > 0 && m == Inf && is.finite(n) && n > 0)
    return(ref_gammainc(n / 2, n / x / 2, !lower, log))
  if (!(fin(x, m, n) && x > 0 && m > 0 && n > 0)) return(NA)
  M <- Rmpfr::mpfr(m, 6500); N <- Rmpfr::mpfr(n, 6500); X <- Rmpfr::mpfr(x, 6500)
  ref_betainc(m / 2, n / 2, M * X / (N + M * X), lower, log, xc = N / (N + M * X))
}
write_fixture("pf", with_tails(fgrid), function(r)
  pf(r$q, r$df1, r$df2, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pf(r$q, r$df1, r$df2, r$lowerTail, r$logP))
qfp <- unique(rbind(grid_of(df1 = fdf, df2 = c(1, 5, 30, Inf)), grid_of(df1 = c(1, 5, 30), df2 = fdf)))
write_fixture("qf", quantile_grid(qfp), function(r)
  qf(r$p, r$df1, r$df2, lower.tail = r$lowerTail, log.p = r$logP))
