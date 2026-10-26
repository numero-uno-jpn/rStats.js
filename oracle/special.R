source("/oracle/_common.R")

# ---- Normal density ----
x <- c(-Inf, -1e5, -40, -38.6, -37.5, -30, -20, -10, -5, -2, -1, -0.5, -1e-10, 0, 1e-300,
       0.5, 1, 1.96, 3, 8, 10, 20, 27, 35, 38, 40, 1e5, Inf, NaN, seq(-9.9, 9.9, by = 0.37))
params <- data.frame(mean = c(0, 5, -3, 1e10, 0, 0, Inf, 0, NaN),
                     sd = c(1, 2, 0.1, 1e5, 0, -1, 1, Inf, 1))
g <- merge(data.frame(x = x), params, by = NULL)
ref_dnorm <- function(x, m, s, log) {
  if (!(all(is.finite(c(x, m, s))) && s > 0)) return(NA)
  z <- (mp(x) - m) / s
  ld <- -z * z / 2 - log(sqrt(2 * Const("pi", MPFR_BITS))) - log(mp(s))
  if (log) ld else exp(ld)
}
write_fixture("dnorm", with_log(g), function(r) dnorm(r$x, r$mean, r$sd, log = r$log),
              function(r) ref_dnorm(r$x, r$mean, r$sd, r$log))

# ---- Gamma and beta functions ----
gx <- c(-171.5, -100.5, -34.5, -33.5, -10.5, -2.5, -1.5, -0.5, -1e-10, 1e-300, 1e-100, 1e-10,
        0.001, 0.1, 0.5, 0.9, 0.99, 1, 1 + 1e-10, 1.01, 1.1, 1.5, 1.9, 1.99, 2, 2 + 1e-10,
        2.01, 2.5, 3, 5, 10, 12.5, 13, 20, 33, 34, 50, 100, 143, 150, 170, 171.6, 172,
        1000, 1e5, 1e10, 1e100, 1e300, 0, -1, -2, -100, Inf, -Inf, NaN)
gg <- data.frame(x = gx)
ref_lgamma <- function(x) if (is.finite(x) && (x > 0 || x != round(x))) log(abs(gamma(mp(x)))) else NA
ref_gamma <- function(x) if (is.finite(x) && (x > 0 || x != round(x)) && abs(x) < 172) gamma(mp(x)) else NA
write_fixture("gamma", gg, function(r) gamma(r$x), function(r) ref_gamma(r$x))
write_fixture("lgamma", gg, function(r) lgamma(r$x), function(r) ref_lgamma(r$x))

ba <- c(1e-300, 1e-10, 0.001, 0.5, 1, 1.5, 2, 3.7, 10, 50, 100, 170, 1000, 1e5, 1e10, 0, Inf, NaN)
bg <- grid_of(a = ba, b = ba)
# (added later, at the end) negative arguments: NaN in R (-0 counts as 0)
bg <- rbind(bg, grid_of(a = c(-0.5, -1, -3.5, -1e-300, -0, 2.5), b = c(-0.5, 2.5, -1, -0, 3)))
ref_lbeta <- function(a, b) if (all(is.finite(c(a, b))) && a > 0 && b > 0)
  lgamma(mp(a)) + lgamma(mp(b)) - lgamma(mp(a) + b) else NA
write_fixture("beta", bg, function(r) beta(r$a, r$b),
              function(r) { l <- ref_lbeta(r$a, r$b); if (is.na(asNumeric(l))) NA else exp(l) })
write_fixture("lbeta", bg, function(r) lbeta(r$a, r$b), function(r) ref_lbeta(r$a, r$b))
