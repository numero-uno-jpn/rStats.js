source("/oracle/_common.R")

# Distributions that R lacks, from extraDistr (argument names and parameterisation as in extraDistr):
#   invgamma(alpha, beta)  beta is a scale: f(x) = beta^alpha x^(-alpha-1) e^(-beta/x) / Gamma(alpha)
#   kumar(a, b)            f(x) = a b x^(a-1) (1 - x^a)^(b-1) on (0, 1)
#   pareto(a, b)           a is the shape, b the scale: F(x) = 1 - (b/x)^a for x >= b
#   triang(a, b, c)        minimum a, maximum b, mode c
#   laplace(mu, sigma)     f(x) = exp(-|x - mu| / sigma) / (2 sigma)
# and the arcsine distribution on (a, b) (not in extraDistr): the beta(1/2, 1/2) distribution scaled to (a, b),
# computed here from dbeta / pbeta / qbeta.
# All of them have closed forms (invgamma through the incomplete gamma function), so high-precision references
# can be computed with mpmath where extraDistr is inaccurate; no Rmpfr references are registered here.

library(extraDistr)

dist <- function(name, xs, params, d, p, q) {
  g <- merge(data.frame(x = xs), params, by = NULL)
  write_fixture(paste0("d", name), with_log(g), function(r) d(r, r$x, r$log))
  names(g)[1] <- "q"
  write_fixture(paste0("p", name), with_tails(g), function(r) p(r, r$q, r$lowerTail, r$logP))
  write_fixture(paste0("q", name), quantile_grid(params), function(r) q(r, r$p, r$lowerTail, r$logP))
}

pos_x <- c(0, 1e-300, 1e-10, 1e-3, 0.05, 0.1, 0.3, 0.5, 1, 1.5, 2, 3, 5, 10, 50, 100, 1e5, 1e10, 1e300, Inf,
           -1, -Inf, NaN)
unit_x <- c(0, 1e-300, 1e-10, 1e-3, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1 - 1e-10, 1, 1.5, -0.5, Inf, -Inf, NaN)
real_x <- c(-Inf, -1e300, -1000, -50, -10, -3, -1, -0.5, -1e-10, 0, 1e-10, 0.5, 1, 2, 3, 10, 50, 750, 1000, 1e300,
            Inf, NaN)

dist("invgamma", pos_x,
     data.frame(alpha = c(1, 3, 0.5, 10, 100, 1e-3, 2, 0, -1, NaN, Inf),
                beta = c(1, 2, 0.1, 5, 1e3, 1, 1e-5, 1, 1, 1, 1)),
     function(r, x, log) dinvgamma(x, r$alpha, r$beta, log = log),
     function(r, q, lt, lp) pinvgamma(q, r$alpha, r$beta, lower.tail = lt, log.p = lp),
     function(r, p, lt, lp) qinvgamma(p, r$alpha, r$beta, lower.tail = lt, log.p = lp))

dist("kumar", unit_x,
     data.frame(a = c(1, 2, 0.5, 5, 0.1, 20, 1, 0, -1, NaN, Inf),
                b = c(1, 3, 0.5, 1, 10, 0.2, 1e3, 1, 1, 1, 1)),
     function(r, x, log) dkumar(x, r$a, r$b, log = log),
     function(r, q, lt, lp) pkumar(q, r$a, r$b, lower.tail = lt, log.p = lp),
     function(r, p, lt, lp) qkumar(p, r$a, r$b, lower.tail = lt, log.p = lp))

dist("pareto", pos_x,
     data.frame(a = c(1, 2, 0.5, 5, 1e-3, 100, 3, 0, -1, NaN, Inf),
                b = c(1, 1.5, 0.1, 10, 1, 1e-5, 1e5, 1, 1, 1, 1)),
     function(r, x, log) dpareto(x, r$a, r$b, log = log),
     function(r, q, lt, lp) ppareto(q, r$a, r$b, lower.tail = lt, log.p = lp),
     function(r, p, lt, lp) qpareto(p, r$a, r$b, lower.tail = lt, log.p = lp))

dist("triang", c(real_x, 0.25, 0.75, 1.25),
     data.frame(a = c(-1, 0, 0, 0, -10, 1, 0, 1, 0, NaN),
                b = c(1, 1, 1, 1, 5, 1 + 1e-10, 3, 0, 1, 1),
                c = c(0, 0, 1, 0.3, 4, 1, 1.5, 0.5, 2, 0.5)),
     function(r, x, log) dtriang(x, r$a, r$b, r$c, log = log),
     function(r, q, lt, lp) ptriang(q, r$a, r$b, r$c, lower.tail = lt, log.p = lp),
     function(r, p, lt, lp) qtriang(p, r$a, r$b, r$c, lower.tail = lt, log.p = lp))

dist("laplace", real_x,
     data.frame(mu = c(0, 1, -5, 1e10, 0, 0, 0, Inf, NaN),
                sigma = c(1, 2, 0.5, 1, 1e-10, 1e10, 0, 1, 1)),
     function(r, x, log) dlaplace(x, r$mu, r$sigma, log = log),
     function(r, q, lt, lp) plaplace(q, r$mu, r$sigma, lower.tail = lt, log.p = lp),
     function(r, p, lt, lp) qlaplace(p, r$mu, r$sigma, lower.tail = lt, log.p = lp))

# Arcsine on (a, b): d = dbeta((x - a)/(b - a), 1/2, 1/2) / (b - a), and likewise for p and q.
# Parameters with b <= a are invalid (NaN), as in the rest of the library.
arcsine_ok <- function(r) is.finite(r$a) && is.finite(r$b) && r$a < r$b
dist("arcsine", c(unit_x, -0.75, 2.5),
     data.frame(a = c(0, -1, 2, 0, 1e-10, 1, 0), b = c(1, 1, 5, 1e-5, 2e-10, 1, NaN)),
     function(r, x, log) {
       if (!arcsine_ok(r) || is.nan(x)) return(NaN)
       w <- r$b - r$a; v <- dbeta((x - r$a) / w, 0.5, 0.5, log = log)
       if (log) v - log(w) else v / w
     },
     function(r, q, lt, lp) if (!arcsine_ok(r)) NaN else
       pbeta((q - r$a) / (r$b - r$a), 0.5, 0.5, lower.tail = lt, log.p = lp),
     function(r, p, lt, lp) if (!arcsine_ok(r)) NaN else
       r$a + (r$b - r$a) * qbeta(p, 0.5, 0.5, lower.tail = lt, log.p = lp))
