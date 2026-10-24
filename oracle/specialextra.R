source("/oracle/_common.R")

# Special functions that R lacks, as jStat has them (fixtures gammainc, erfinv, erfcinv, perm):
#   gammainc(x, a): the incomplete gamma functions without regularisation, lower gamma(a, x) = P(a, x) Gamma(a) and
#                   upper Gamma(a, x) = Q(a, x) Gamma(a) (pracma::gammainc(x, a) returns them as lowinc / uppinc, but
#                   gives NA for large arguments, so the values here come from R's pgamma and gamma). Also their logs
#                   (logLower / logUpper), which stay finite where the values overflow.
#   erfinv(y), erfcinv(y): inverses of erf and erfc (pracma::erfinv / erfcinv), from qnorm:
#                   erfinv(y) = sign(y) * -qnorm((1 - |y|) / 2) / sqrt(2) (1 - |y| is exact for |y| >= 1/2),
#                   erfcinv(y) = -qnorm(y / 2) / sqrt(2)
#   perm(n, k):     the number of ordered selections n! / (n - k)! = Gamma(n + 1) / Gamma(n - k + 1) (jStat's
#                   permutation), from 256-bit Rmpfr.

ga <- grid_of(x = c(0, 1e-300, 1e-10, 0.1, 0.5, 1, 2, 3, 5, 10, 30, 100, 1e3, 1e5, Inf, -1, NaN),
              a = c(0.1, 0.5, 1, 2.5, 3, 10, 50, 171, 200, 1e4, 0, -1, NaN))
write_fixture("gammainc", ga, function(r) {
  if (is.nan(r$x) || is.nan(r$a) || r$a <= 0 || r$x < 0) return(c(NaN, NaN, NaN, NaN))
  lo <- pgamma(r$x, r$a, log.p = TRUE) + lgamma(r$a)
  up <- pgamma(r$x, r$a, lower.tail = FALSE, log.p = TRUE) + lgamma(r$a)
  # values: lower, upper, log lower, log upper
  c(exp(lo), exp(up), lo, up)
})

ys <- c(-1, -0.999999, -0.5, -1e-10, 0, 1e-300, 1e-10, 0.1, 0.5, 0.9, 0.99, 0.999999, 1 - 1e-15, 1 - 2^-53, 1, 1.5,
        -1.5, NaN)
write_fixture("erfinv", data.frame(y = ys), function(r) {
  y <- r$y
  if (is.nan(y) || abs(y) > 1) return(NaN)
  if (y == 0) return(0)
  sign(y) * -qnorm((1 - abs(y)) / 2) / sqrt(2)
})
yc <- c(0, 1e-320, 1e-300, 1e-100, 1e-10, 0.01, 0.5, 1, 1.5, 1.99, 2 - 1e-15, 2, 2.5, -0.5, NaN)
write_fixture("erfcinv", data.frame(y = yc), function(r) {
  y <- r$y
  if (is.nan(y) || y < 0 || y > 2) return(NaN)
  -qnorm(y / 2) / sqrt(2)
})

pk <- rbind(grid_of(n = c(0, 1, 5, 10, 20, 50, 170, 300), k = c(0, 1, 2, 5, 10, 20)),
            data.frame(n = c(5.5, 10.25, 3, 5, -1, 5, NaN), k = c(2, 3, 5, 6, 1, -1, 1)))
write_fixture("perm", pk, function(r) {
  n <- r$n; k <- r$k
  if (is.nan(n) || is.nan(k) || k < 0 || n < 0) return(NaN)
  if (n == floor(n) && k > n) return(0)
  v <- gamma(Rmpfr::mpfr(n + 1, 256)) / gamma(Rmpfr::mpfr(n - k + 1, 256))
  Rmpfr::asNumeric(v)
})
