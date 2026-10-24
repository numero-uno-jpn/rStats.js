source("/oracle/_common.R")

# log1p-type functions that R implements in its C API (Rmath.h) but does not export to R code
# (fixtures log1pmx, lgamma1p, log1mexp, log1pexp). The expected values are the correctly rounded true values,
# computed with 512-bit Rmpfr, not R's output. Definitions (the same as Rmath and the DPQ package):
#   log1pmx(x)  = log(1 + x) - x            (x >= -1)
#   lgamma1p(x) = lgamma(1 + x) = log|Gamma(1 + x)|
#   log1mexp(x) = log(1 - exp(-x))          (x >= 0; note the sign of the argument)
#   log1pexp(x) = log(1 + exp(x))
# Out-of-domain arguments give NaN.

BITS <- 512
m <- function(x) Rmpfr::mpfr(x, BITS)
num <- function(v) Rmpfr::asNumeric(v)
set.seed(20261105)
dense <- function(lo, hi, n) sort(c(runif(n, lo, hi), 10^runif(n, -15, 0) * sample(c(-1, 1), n, TRUE)))

x1 <- c(-1, -1 + 2^-52, -1 + 1e-10, -0.9, -0.5 - 2^-53, -0.5, -0.5 + 2^-54, -0.4999, -0.1, -1e-5, -1e-10, -1e-300,
        0, 1e-300, 1e-10, 1e-5, 0.1, 0.4999, 0.5 - 2^-54, 0.5, 0.5 + 2^-53, 0.5001, 1, 2, 10, 1e10, 1e300,
        Inf, -1 - 2^-52, -2, -Inf, NaN, dense(-1, 3, 60))
write_fixture("log1pmx", data.frame(x = x1), function(r) {
  x <- r$x
  if (is.nan(x) || x < -1) return(NaN)
  if (x == -1) return(-Inf)
  if (is.infinite(x)) return(-Inf)
  if (x == 0) return(0)
  num(log1p(m(x)) - m(x))  # |x| <= 1e-300 loses its digits here, but the result underflows to 0 anyway
})

x2 <- c(-1 + 2^-52, -0.9999, -0.5, -0.2001, -0.2, -0.1999, -1e-10, -1e-300, 0, 1e-300, 1e-10, 0.1999, 0.2, 0.2001,
        0.4616321449683623, 0.5, 0.79, 0.8, 0.81, 0.99, 1 - 2^-53, 1, 1 + 2^-52, 1.01, 1.19, 1.2, 1.21, 2, 10, 170,
        1e5, 1e300, Inf, -1, -1.5, -2, -2.5, -100.5, -Inf, NaN, dense(-0.5, 2, 60))
write_fixture("lgamma1p", data.frame(x = x2), function(r) {
  x <- r$x
  if (is.nan(x) || x == -Inf) return(NaN)
  if (x == Inf) return(Inf)
  if (x <= -1 && x == floor(x)) return(Inf)
  if (x == 0 || x == 1) return(0)
  # enough bits for 1 + x to be exact when |x| is tiny
  bits <- BITS + max(0, ceiling(-log2(abs(x))))
  num(lgamma(Rmpfr::mpfr(x, bits) + 1))
})

x3 <- c(0, 1e-320, 1e-300, 1e-20, 1e-10, 1e-5, 0.1, 0.5, log(2) - 2^-53, log(2), log(2) + 2^-53, 0.7, 1, 2, 5,
        10, 20, 36, 37, 38, 40, 100, 700, 708, 745, 750, 1e10, Inf, -1e-300, -1, -Inf, NaN, 10^runif(60, -12, 2.5))
write_fixture("log1mexp", data.frame(x = x3), function(r) {
  x <- r$x
  if (is.nan(x) || x < 0) return(NaN)
  if (x == 0) return(-Inf)
  if (x == Inf) return(0)
  # 1 - exp(-x) would round to 1 for large x
  if (x > log(2)) num(log1p(-exp(-m(x)))) else num(log(-expm1(-m(x))))
})

x4 <- c(-Inf, -1e300, -1000, -746, -745, -709, -40, -37, -36, -18.1, -18, -1, -1e-10, 0, 1e-10, 1, 18, 18.1,
        33.3, 34, 36, 37, 40, 100, 709, 710, 1000, 1e300, Inf, NaN, runif(60, -60, 60))
write_fixture("log1pexp", data.frame(x = x4), function(r) {
  x <- r$x
  if (is.nan(x)) return(NaN)
  if (x == -Inf) return(0)
  if (x == Inf) return(Inf)
  # exp(x) overflows MPFR's exponent range for x = 1e300
  if (x > 0) num(m(x) + log1p(exp(-m(x)))) else num(log1p(exp(m(x))))
})
