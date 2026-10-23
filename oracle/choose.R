source("/oracle/_common.R")

# choose, lchoose, factorial, lfactorial (R's base).
# Not yet run: written without R at hand, together with the mpmath reference fixtures
# (scripts/mpmath/choose.py). The tests compare with these R fixtures once they exist.

# Exact or high-precision reference: the falling product in mpfr for integer k (k is rounded as R does)
ref_choose <- function(n, k) {
  if (!(is.finite(n) && is.finite(k))) return(NA)
  k <- round(k)
  if (k < 0) return(mp(0))
  if (k == 0) return(mp(1))
  if (k > 2e5) return(NA)
  bits <- max(MPFR_BITS, ceiling(log2(abs(n) + 2)) + 200)
  j <- Rmpfr::mpfr(0:(k - 1), bits)
  prod((Rmpfr::mpfr(n, bits) - j) / (j + 1))
}

cn <- c(0, 1, 2, 5, 10, 29, 30, 31, 50, 100, 1000, 1e5, 1e10, 1e15, 1e300, -1, -2, -5, -50, -1e5,
        1e-10, 0.5, 2.5, 4.3, 10.3, 29.7, 30.5, 99.9, 1234.567, 1e5 + 0.5, 1e12 + 0.25,
        -1e-10, -0.5, -2.7, -29.5, -1000.25, Inf, -Inf, NaN)
ck <- c(0, 1, 2, 3, 5, 10, 20, 29, 30, 31, 50, 100, 500, 1000, 1e5, -1, -2.5, 2.2, 2.5, 3.5, 30.5,
        Inf, -Inf, NaN)
cg <- grid_of(n = cn, k = ck)
write_fixture("choose", cg, function(r) choose(r$n, r$k), function(r) ref_choose(r$n, r$k))
write_fixture("lchoose", cg, function(r) lchoose(r$n, r$k), function(r) {
  v <- ref_choose(r$n, r$k)
  if (is.na(asNumeric(v)) || asNumeric(v) == 0) NA else log(abs(v))
})

fx <- c(0, 1, 2, 5, 10, 20, 50, 100, 150, 170, 170.5, 171, 172, 1e-300, 1e-10, 1e-3, 0.1, 0.5, 0.9,
        1.5, 2.5, 7.25, 33.3, 99.99, -1e-10, -0.1, -0.5, -0.9, -1.5, -2.5, -10.5, -100.5, -170.5,
        -1, -2, -100, Inf, -Inf, NaN)
ref_fact <- function(x) if (is.finite(x) && (x > -1 || x != round(x))) gamma(Rmpfr::mpfr(x, 2000) + 1) else NA
write_fixture("factorial", data.frame(x = fx), function(r) factorial(r$x), function(r) ref_fact(r$x))
write_fixture("lfactorial", data.frame(x = c(fx, 1e5, 1e10, 1e100, 1e300, 1e-200)), function(r) lfactorial(r$x),
  function(r) { v <- ref_fact(r$x); if (is.na(asNumeric(v))) NA else log(abs(v)) })
