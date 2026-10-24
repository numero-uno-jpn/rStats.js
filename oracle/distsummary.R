source("/oracle/_htest.R")

# Summaries of distributions (fixture distSummary): mean, variance, median, mode, skewness and excess kurtosis.
# R has no function for these, so they are written here from the closed forms, and every finite value is checked
# against numerical moments (integrate / summation) and the mode against the density before it is written; the
# oracle stops if a formula disagrees.
#
# Conventions (the TS function should follow them):
# - Undefined values are NaN (the mean of the Cauchy distribution; the variance when the mean is infinite);
#   infinite moments are Inf (the variance of t with 1 < df <= 2, the mean of pareto with a <= 1).
# - median is the q function at 0.5 (for discrete distributions the smallest x with F(x) >= 0.5, as R's q).
# - mode: the maximum of the density. NaN when it is not unique (uniform, beta(1, 1), beta with both shapes < 1,
#   arcsine). For discrete distributions with two adjacent modes, the larger one (as Boost.Math).
#   Where the density is unbounded at a boundary (gamma with shape < 1), that boundary.
# - kurtosis is the excess kurtosis (0 for the normal distribution).
# - Parameter names are the d/p/q argument names (gamma: shape and rate; nbinom: size and prob, or size and mu).

library(extraDistr)
M <- function(x) Rmpfr::mpfr(x, 256)
N <- function(x) Rmpfr::asNumeric(x)
# skewness and excess kurtosis from raw moments m1..m4 (mpfr, to avoid cancellation)
from_raw <- function(m) {
  m <- lapply(m, M)
  v <- m[[2]] - m[[1]]^2
  mu3 <- m[[3]] - 3 * m[[1]] * m[[2]] + 2 * m[[1]]^3
  mu4 <- m[[4]] - 4 * m[[1]] * m[[3]] + 6 * m[[1]]^2 * m[[2]] - 3 * m[[1]]^4
  list(mean = N(m[[1]]), variance = N(v), skewness = N(mu3 / v^1.5), kurtosis = N(mu4 / v^2 - 3))
}
mpgamma <- function(x) gamma(M(x))
mpbeta <- function(a, b) gamma(M(a)) * gamma(M(b)) / gamma(M(a) + M(b))

D <- list()
reg <- function(name, d, q, support, discrete, f) D[[name]] <<- list(d = d, q = q, support = support,
                                                                   discrete = discrete, f = f)

reg("norm", function(x, p) dnorm(x, p$mean, p$sd), function(u, p) qnorm(u, p$mean, p$sd), c(-Inf, Inf), FALSE,
    function(p) list(mean = p$mean, variance = p$sd^2, mode = p$mean, skewness = 0, kurtosis = 0))
reg("lnorm", function(x, p) dlnorm(x, p$meanlog, p$sdlog), function(u, p) qlnorm(u, p$meanlog, p$sdlog),
    c(0, Inf), FALSE, function(p) {
      s2 <- M(p$sdlog)^2; mu <- M(p$meanlog)
      list(mean = N(exp(mu + s2 / 2)), variance = N((exp(s2) - 1) * exp(2 * mu + s2)), mode = N(exp(mu - s2)),
           skewness = N((exp(s2) + 2) * sqrt(exp(s2) - 1)),
           kurtosis = N(exp(4 * s2) + 2 * exp(3 * s2) + 3 * exp(2 * s2) - 6))
    })
reg("unif", function(x, p) dunif(x, p$min, p$max), function(u, p) qunif(u, p$min, p$max), NULL, FALSE,
    function(p) list(mean = (p$min + p$max) / 2, variance = (p$max - p$min)^2 / 12, mode = NaN, skewness = 0,
                     kurtosis = -6 / 5))
reg("exp", function(x, p) dexp(x, p$rate), function(u, p) qexp(u, p$rate), c(0, Inf), FALSE,
    function(p) list(mean = 1 / p$rate, variance = 1 / p$rate^2, mode = 0, skewness = 2, kurtosis = 6))
reg("gamma", function(x, p) dgamma(x, p$shape, p$rate), function(u, p) qgamma(u, p$shape, p$rate), c(0, Inf), FALSE,
    function(p) list(mean = p$shape / p$rate, variance = p$shape / p$rate^2,
                     mode = if (p$shape >= 1) (p$shape - 1) / p$rate else 0,
                     skewness = 2 / sqrt(p$shape), kurtosis = 6 / p$shape))
reg("chisq", function(x, p) dchisq(x, p$df), function(u, p) qchisq(u, p$df), c(0, Inf), FALSE,
    function(p) list(mean = p$df, variance = 2 * p$df, mode = max(p$df - 2, 0), skewness = sqrt(8 / p$df),
                     kurtosis = 12 / p$df))
reg("beta", function(x, p) dbeta(x, p$shape1, p$shape2), function(u, p) qbeta(u, p$shape1, p$shape2), c(0, 1), FALSE,
    function(p) {
      a <- p$shape1; b <- p$shape2
      mode <- if (a > 1 && b > 1) (a - 1) / (a + b - 2) else if (a <= 1 && b > 1) 0 else if (a > 1 && b <= 1) 1 else NaN
      list(mean = a / (a + b), variance = a * b / ((a + b)^2 * (a + b + 1)), mode = mode,
           skewness = 2 * (b - a) * sqrt(a + b + 1) / ((a + b + 2) * sqrt(a * b)),
           kurtosis = 6 * ((a - b)^2 * (a + b + 1) - a * b * (a + b + 2)) / (a * b * (a + b + 2) * (a + b + 3)))
    })
reg("t", function(x, p) dt(x, p$df), function(u, p) qt(u, p$df), c(-Inf, Inf), FALSE, function(p) {
  v <- p$df
  list(mean = if (v > 1) 0 else NaN, variance = if (v > 2) v / (v - 2) else if (v > 1) Inf else NaN, mode = 0,
       skewness = if (v > 3) 0 else NaN, kurtosis = if (v > 4) 6 / (v - 4) else if (v > 2) Inf else NaN)
})
reg("f", function(x, p) df(x, p$df1, p$df2), function(u, p) qf(u, p$df1, p$df2), c(0, Inf), FALSE, function(p) {
  a <- p$df1; b <- p$df2
  list(mean = if (b > 2) b / (b - 2) else NaN,
       variance = if (b > 4) 2 * b^2 * (a + b - 2) / (a * (b - 2)^2 * (b - 4)) else if (b > 2) Inf else NaN,
       mode = if (a > 2) (a - 2) / a * b / (b + 2) else 0,
       skewness = if (b > 6) (2 * a + b - 2) * sqrt(8 * (b - 4)) / ((b - 6) * sqrt(a * (a + b - 2))) else NaN,
       kurtosis = if (b > 8) 12 * (a * (5 * b - 22) * (a + b - 2) + (b - 4) * (b - 2)^2) /
                            (a * (b - 6) * (b - 8) * (a + b - 2)) else NaN)
})
reg("cauchy", function(x, p) dcauchy(x, p$location, p$scale), function(u, p) qcauchy(u, p$location, p$scale),
    c(-Inf, Inf), FALSE,
    function(p) list(mean = NaN, variance = NaN, mode = p$location, skewness = NaN, kurtosis = NaN))
reg("weibull", function(x, p) dweibull(x, p$shape, p$scale), function(u, p) qweibull(u, p$shape, p$scale),
    c(0, Inf), FALSE, function(p) {
      k <- p$shape; l <- p$scale
      r <- from_raw(lapply(1:4, function(i) M(l)^i * mpgamma(1 + i / k)))
      c(r, list(mode = if (k > 1) l * ((k - 1) / k)^(1 / k) else 0))
    })
reg("logis", function(x, p) dlogis(x, p$location, p$scale), function(u, p) qlogis(u, p$location, p$scale),
    c(-Inf, Inf), FALSE,
    function(p) list(mean = p$location, variance = p$scale^2 * pi^2 / 3, mode = p$location, skewness = 0,
                     kurtosis = 6 / 5))
reg("binom", function(x, p) dbinom(x, p$size, p$prob), function(u, p) qbinom(u, p$size, p$prob), NULL, TRUE,
    function(p) {
      n <- p$size; q <- p$prob; v <- n * q * (1 - q)
      list(mean = n * q, variance = v, mode = floor((n + 1) * q) - (if ((n + 1) * q == n + 1) 1 else 0),
           skewness = (1 - 2 * q) / sqrt(v), kurtosis = (1 - 6 * q * (1 - q)) / v)
    })
reg("pois", function(x, p) dpois(x, p$lambda), function(u, p) qpois(u, p$lambda), NULL, TRUE,
    function(p) list(mean = p$lambda, variance = p$lambda, mode = floor(p$lambda), skewness = 1 / sqrt(p$lambda),
                     kurtosis = 1 / p$lambda))
reg("geom", function(x, p) dgeom(x, p$prob), function(u, p) qgeom(u, p$prob), NULL, TRUE, function(p) {
  q <- p$prob
  list(mean = (1 - q) / q, variance = (1 - q) / q^2, mode = 0, skewness = (2 - q) / sqrt(1 - q),
       kurtosis = 6 + q^2 / (1 - q))
})
nb_prob <- function(p) if (!is.null(p$mu)) p$size / (p$size + p$mu) else p$prob
reg("nbinom", function(x, p) dnbinom(x, p$size, nb_prob(p)), function(u, p) qnbinom(u, p$size, nb_prob(p)), NULL, TRUE,
    function(p) {
      r <- p$size; q <- nb_prob(p)
      list(mean = r * (1 - q) / q, variance = r * (1 - q) / q^2,
           mode = if (r > 1) floor((r - 1) * (1 - q) / q) else 0,
           skewness = (2 - q) / sqrt(r * (1 - q)), kurtosis = 6 / r + q^2 / (r * (1 - q)))
    })
reg("hyper", function(x, p) dhyper(x, p$m, p$n, p$k), function(u, p) qhyper(u, p$m, p$n, p$k), NULL, TRUE,
    function(p) {
      K <- M(p$m); B <- M(p$n); n <- M(p$k); Nn <- K + B
      v <- n * K / Nn * B / Nn * (Nn - n) / (Nn - 1)
      sk <- (Nn - 2 * K) * sqrt(Nn - 1) * (Nn - 2 * n) / (sqrt(n * K * B * (Nn - n)) * (Nn - 2))
      ku <- ((Nn - 1) * Nn^2 * (Nn * (Nn + 1) - 6 * K * B - 6 * n * (Nn - n)) + 6 * n * K * B * (Nn - n) * (5 * Nn - 6)) /
        (n * K * B * (Nn - n) * (Nn - 2) * (Nn - 3))
      list(mean = N(n * K / Nn), variance = N(v), mode = floor((p$k + 1) * (p$m + 1) / (p$m + p$n + 2)),
           skewness = N(sk), kurtosis = N(ku))
    })
reg("invgamma", function(x, p) dinvgamma(x, p$alpha, p$beta), function(u, p) qinvgamma(u, p$alpha, p$beta), c(0, Inf),
    FALSE, function(p) {
      a <- p$alpha; b <- p$beta
      list(mean = if (a > 1) b / (a - 1) else Inf,
           variance = if (a > 2) b^2 / ((a - 1)^2 * (a - 2)) else if (a > 1) Inf else NaN, mode = b / (a + 1),
           skewness = if (a > 3) 4 * sqrt(a - 2) / (a - 3) else NaN,
           kurtosis = if (a > 4) (30 * a - 66) / ((a - 3) * (a - 4)) else NaN)
    })
reg("kumar", function(x, p) dkumar(x, p$a, p$b), function(u, p) qkumar(u, p$a, p$b), c(0, 1), FALSE, function(p) {
  a <- p$a; b <- p$b
  r <- from_raw(lapply(1:4, function(i) M(b) * mpbeta(1 + i / a, b)))
  mode <- if (a >= 1 && b >= 1 && !(a == 1 && b == 1)) ((a - 1) / (a * b - 1))^(1 / a) else
          if (a < 1 && b >= 1) 0 else if (a >= 1 && b < 1) 1 else NaN
  c(r, list(mode = mode))
})
reg("pareto", function(x, p) dpareto(x, p$a, p$b), function(u, p) qpareto(u, p$a, p$b), NULL, FALSE, function(p) {
  a <- p$a; b <- p$b
  list(mean = if (a > 1) a * b / (a - 1) else Inf,
       variance = if (a > 2) b^2 * a / ((a - 1)^2 * (a - 2)) else if (a > 1) Inf else NaN, mode = b,
       skewness = if (a > 3) 2 * (1 + a) / (a - 3) * sqrt((a - 2) / a) else NaN,
       kurtosis = if (a > 4) 6 * (a^3 + a^2 - 6 * a - 2) / (a * (a - 3) * (a - 4)) else NaN)
})
reg("triang", function(x, p) dtriang(x, p$a, p$b, p$c), function(u, p) qtriang(u, p$a, p$b, p$c), NULL, FALSE,
    function(p) {
      a <- p$a; b <- p$b; c <- p$c; s <- a^2 + b^2 + c^2 - a * b - a * c - b * c
      list(mean = (a + b + c) / 3, variance = s / 18, mode = c,
           skewness = sqrt(2) * (a + b - 2 * c) * (2 * a - b - c) * (a - 2 * b + c) / (5 * s^1.5), kurtosis = -3 / 5)
    })
reg("laplace", function(x, p) dlaplace(x, p$mu, p$sigma), function(u, p) qlaplace(u, p$mu, p$sigma), c(-Inf, Inf),
    FALSE, function(p) list(mean = p$mu, variance = 2 * p$sigma^2, mode = p$mu, skewness = 0, kurtosis = 3))
reg("arcsine", function(x, p) dbeta((x - p$a) / (p$b - p$a), 0.5, 0.5) / (p$b - p$a),
    function(u, p) p$a + (p$b - p$a) * qbeta(u, 0.5, 0.5), NULL, FALSE,
    function(p) list(mean = (p$a + p$b) / 2, variance = (p$b - p$a)^2 / 8, mode = NaN, skewness = 0, kurtosis = -3 / 2))

params <- list(
  norm = list(list(mean = 0, sd = 1), list(mean = -3, sd = 0.5), list(mean = 1e6, sd = 1e3)),
  lnorm = list(list(meanlog = 0, sdlog = 1), list(meanlog = 2, sdlog = 0.25), list(meanlog = -1, sdlog = 1.5)),
  unif = list(list(min = 0, max = 1), list(min = -2, max = 5)),
  exp = list(list(rate = 1), list(rate = 0.25), list(rate = 30)),
  gamma = list(list(shape = 1, rate = 1), list(shape = 2.5, rate = 2), list(shape = 0.4, rate = 1), list(shape = 50, rate = 0.1)),
  chisq = list(list(df = 1), list(df = 2), list(df = 7.5), list(df = 100)),
  beta = list(list(shape1 = 2, shape2 = 3), list(shape1 = 0.5, shape2 = 2), list(shape1 = 3, shape2 = 0.7),
              list(shape1 = 1, shape2 = 1), list(shape1 = 0.5, shape2 = 0.5), list(shape1 = 30, shape2 = 70)),
  t = list(list(df = 1), list(df = 1.5), list(df = 3), list(df = 4), list(df = 5), list(df = 30)),
  f = list(list(df1 = 1, df2 = 2), list(df1 = 2, df2 = 5), list(df1 = 5, df2 = 10), list(df1 = 10, df2 = 30)),
  cauchy = list(list(location = 0, scale = 1), list(location = 2, scale = 3)),
  weibull = list(list(shape = 1, scale = 1), list(shape = 2, scale = 3), list(shape = 0.5, scale = 2), list(shape = 20, scale = 1)),
  logis = list(list(location = 0, scale = 1), list(location = -1, scale = 2)),
  binom = list(list(size = 10, prob = 0.3), list(size = 9, prob = 0.5), list(size = 100, prob = 0.01), list(size = 5, prob = 1)),
  pois = list(list(lambda = 3.5), list(lambda = 4), list(lambda = 0.2), list(lambda = 250)),
  geom = list(list(prob = 0.3), list(prob = 0.9)),
  nbinom = list(list(size = 3, prob = 0.4), list(size = 0.5, prob = 0.2), list(size = 10, mu = 4)),
  hyper = list(list(m = 10, n = 7, k = 8), list(m = 50, n = 450, k = 30), list(m = 5, n = 5, k = 9)),
  invgamma = list(list(alpha = 6, beta = 2), list(alpha = 3.5, beta = 1), list(alpha = 2.5, beta = 1),
                  list(alpha = 1.5, beta = 1), list(alpha = 0.5, beta = 1)),
  kumar = list(list(a = 2, b = 3), list(a = 0.5, b = 2), list(a = 3, b = 0.5), list(a = 1, b = 1), list(a = 5, b = 50)),
  pareto = list(list(a = 5, b = 1), list(a = 3.5, b = 2), list(a = 2.5, b = 1), list(a = 1.5, b = 1), list(a = 0.8, b = 1)),
  triang = list(list(a = 0, b = 1, c = 0.5), list(a = -1, b = 3, c = 0), list(a = 0, b = 2, c = 2)),
  laplace = list(list(mu = 0, sigma = 1), list(mu = 3, sigma = 0.25)),
  arcsine = list(list(a = 0, b = 1), list(a = -2, b = 4))
)

# --- checks of the closed forms ---------------------------------------------------------------------------
rel <- function(a, b) if (a == b) 0 else abs(a - b) / max(abs(b), 1e-300)
support_of <- function(name, p) {
  s <- D[[name]]$support
  if (!is.null(s)) return(s)
  switch(name, unif = c(p$min, p$max), pareto = c(p$b, Inf), triang = c(p$a, p$b), arcsine = c(p$a, p$b))
}
# Numerical moments: the mean, then the central moments 2..4 about the closed-form mean (raw moments would cancel,
# e.g. for the normal distribution with mean 1e6). Returns list(mean, variance, skewness, kurtosis)
numeric_moments <- function(name, p, s) {
  d <- D[[name]]
  mu <- s$mean
  if (d$discrete) {
    # Sum over the support up to well beyond the bulk (mean + 60 sd + 100), or the whole finite support
    hi <- switch(name, binom = p$size, hyper = p$k, ceiling(s$mean + 60 * sqrt(s$variance) + 100))
    x <- M(0:hi); w <- M(d$d(0:hi, p))
    mom <- c(list(sum(x * w)), lapply(2:4, function(i) sum((x - mu)^i * w)))
  } else {
    # Split the range at quantiles so that integrate finds a narrow peak far from 0
    sp <- support_of(name, p)
    cut <- c(sp[1], d$q(c(1e-6, 0.5, 1 - 1e-6), p), sp[2])
    cut <- unique(pmin(pmax(cut, sp[1]), sp[2]))
    integ <- function(g) {
      parts <- vapply(seq_len(length(cut) - 1), function(j) {
        r <- tryCatch(integrate(function(x) g(x) * d$d(x, p), cut[j], cut[j + 1], rel.tol = 1e-12, subdivisions = 2000L),
                      error = function(e) NULL)
        if (is.null(r)) NA_real_ else r$value
      }, 0)
      sum(M(parts))
    }
    mom <- c(list(integ(function(x) x)), lapply(2:4, function(i) integ(function(x) (x - mu)^i)))
  }
  m <- vapply(mom, N, 0)
  list(mean = m[1], variance = m[2], skewness = m[3] / m[2]^1.5, kurtosis = m[4] / m[2]^2 - 3)
}
check <- function(name, p, s) {
  if (!is.finite(s$mean) || !is.finite(s$variance)) return(invisible())
  num <- numeric_moments(name, p, s)
  if (anyNA(unlist(num))) return(invisible())
  for (k in c("mean", "variance", "skewness", "kurtosis")) {
    v <- s[[k]]
    # 1e-5: integrate loses about 2e-6 where the density is unbounded at 0 (chisq with df = 1, beta(0.5, 2))
    if (is.finite(v) && is.finite(num[[k]]) && abs(v - num[[k]]) > 1e-5 * max(1, abs(v)))
      stop(sprintf("%s %s: %s closed form %.10g, numerical %.10g", name, deparse(p), k, v, num[[k]]))
  }
  # mode: the density at the mode is at least that at nearby points
  if (is.finite(s$mode)) {
    d <- D[[name]]
    dm <- d$d(s$mode, p)
    near <- if (d$discrete) s$mode + c(-1, 1) else s$mode + c(-1, 1) * 1e-4 * max(1, abs(s$mode))
    sp <- support_of(name, p)
    if (!d$discrete) near <- near[near >= sp[1] & near <= sp[2]]
    if (any(d$d(near, p) > dm * (1 + 1e-9))) stop(sprintf("%s %s: mode %g is not a maximum", name, deparse(p), s$mode))
  }
}

cases <- list()
for (name in names(params)) for (p in params[[name]]) cases[[length(cases) + 1]] <- c(list(distribution = name), p)
write_htest_fixture("distSummary", cases, function(a) {
  name <- a$distribution; p <- a[-1]
  s <- D[[name]]$f(p)
  s$median <- D[[name]]$q(0.5, p)
  s$sd <- sqrt(s$variance)
  check(name, p, s)
  lapply(s[c("mean", "variance", "sd", "median", "mode", "skewness", "kurtosis")], num2str)
})
