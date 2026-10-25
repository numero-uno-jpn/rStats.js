suppressPackageStartupMessages(library(Rmpfr))

# Reference values for the power fixtures (oracle/power.R, oracle/pwr.R). R's noncentral t and F are accurate to
# only about 1e-12 and 1e-9, so the power is recomputed accurately (acc_pnt, acc_pnf, acc_pnchisq below); the central
# quantiles, pnorm and qnorm are R's (accurate). A solved quantity's reference is the result
# of R's own procedure (uniroot with R's interval, tolerance and extendInt) applied to the accurate power, which is
# what an implementation with accurate distribution functions gets. Where the noncentrality is beyond 200 or a
# degree of freedom beyond 1e5 (only near the ends of the intervals) R's value is used.

# Accurate noncentral distributions as Poisson mixtures of R's central ones (dpois, pbeta, pchisq and pnorm are
# accurate to a few units in the last place; the terms are positive, so their sum, taken in Rmpfr, is accurate too):
#   F:      P(F <= q) = sum_j Pois(j; ncp/2) I_x(m/2 + j, n/2),  x = m q / (m q + n)   (upper: the I's upper tails)
#   chisq:  P(X <= q) = sum_j Pois(j; ncp/2) P(chisq_{df + 2j} <= q)
#   t (q >= 0; q < 0 by symmetry): Lenth's series (for delta < 0 the R_j are negative; the sum is exact in Rmpfr, so
#           only the rounding of the terms, about 1e-16 absolute, remains)
#           P(T <= q) = Phi(-delta) + 1/2 sum_j [Pois(j; delta^2/2) I_x(j + 1/2, nu/2) + R_j I_x(j + 1, nu/2)],
#           x = q^2 / (q^2 + nu), R_j = delta/sqrt(2) exp(-delta^2/2) (delta^2/2)^j / Gamma(j + 3/2)
# The upper tail of t is 1 minus that, accurate in absolute terms (only used where it is not tiny).
msum <- function(v) Rmpfr::asNumeric(sum(Rmpfr::mpfr(v[is.finite(v)], 128)))
pois_range <- function(lambda) { s <- sqrt(lambda); max(0, floor(lambda - 40 * s - 40)):ceiling(lambda + 40 * s + 200) }
acc_pnf <- function(q, m, n, ncp, lower) {
  j <- pois_range(ncp / 2); x <- m * q / (m * q + n); xc <- n / (m * q + n)
  w <- stats::dpois(j, ncp / 2)
  msum(w * (if (lower) stats::pbeta(x, m / 2 + j, n / 2) else stats::pbeta(xc, n / 2, m / 2 + j)))
}
acc_pnchisq <- function(q, df, ncp, lower) {
  j <- pois_range(ncp / 2); msum(stats::dpois(j, ncp / 2) * stats::pchisq(q, df + 2 * j, lower.tail = lower))
}
acc_pnt <- function(q, nu, delta, lower) {
  if (q < 0) return(acc_pnt(-q, nu, -delta, !lower))
  x <- q^2 / (q^2 + nu); l <- delta^2 / 2; j <- pois_range(l)
  rj <- if (delta == 0) 0 * j else sign(delta) * exp(log(abs(delta) / sqrt(2)) - l + j * log(l) - lgamma(j + 1.5))
  lo <- msum(c(2 * stats::pnorm(-delta), stats::dpois(j, l) * stats::pbeta(x, j + 0.5, nu / 2), rj * stats::pbeta(x, j + 1, nu / 2))) / 2
  if (lower) lo else 1 - lo
}

# Extreme points (only reached at the ends of R's intervals, where the power is 0 or 1 to double precision and R is
# accurate) use R's value: the Rmpfr sums would need too many terms
extreme <- function(ncp, ...) abs(ncp) > 200 || any(c(...) > 1e5)
# Accurate value unless R's is within 1e-8 of 0 or 1 (deep tails, which need many bits and move the root by nothing
# that matters)
hp <- function(r, f) {
  if (!(r > 1e-8 && r < 1 - 1e-8)) return(r)
  v <- tryCatch(f(), error = function(e) NULL)
  if (is.numeric(v) && length(v) == 1 && is.finite(v)) v else r
}
hp_t_upper <- function(q, nu, ncp) {
  r <- pt(q, nu, ncp, lower.tail = FALSE)
  if (extreme(ncp, nu)) r else hp(r, function() acc_pnt(q, nu, ncp, FALSE))
}
hp_t_lower <- function(q, nu, ncp) {
  r <- pt(q, nu, ncp)
  if (extreme(ncp, nu)) r else hp(r, function() acc_pnt(q, nu, ncp, TRUE))
}
hp_f_upper <- function(q, m, n, ncp) {
  r <- pf(q, m, n, ncp, lower.tail = FALSE)
  if (extreme(ncp, m, n) || ncp == 0) r else hp(r, function() acc_pnf(q, m, n, ncp, FALSE))
}
hp_chisq_upper <- function(q, df, ncp) {
  r <- pchisq(q, df, ncp, lower.tail = FALSE)
  if (extreme(ncp, df) || ncp == 0) r else hp(r, function() acc_pnchisq(q, df, ncp, FALSE))
}

# Accurate power for the arguments a (all given, power absent); fn as in the fixtures
hp_power <- function(fn, a) {
  sl <- if (is.null(a$sig.level)) 0.05 else a$sig.level
  alt <- a$alternative
  ts <- function(type) switch(if (is.null(type)) "two.sample" else type, two.sample = 2, one.sample = 1, paired = 1)
  switch(fn,
    power.t.test = {
      tsample <- ts(a$type); tside <- if (identical(alt, "one.sided")) 1 else 2
      sd <- if (is.null(a$sd)) 1 else a$sd; delta <- if (tside == 2) abs(a$delta) else a$delta
      nu <- max(1e-7, a$n - 1) * tsample; q <- qt(sl / tside, nu, lower.tail = FALSE); ncp <- sqrt(a$n / tsample) * delta / sd
      p <- hp_t_upper(q, nu, ncp)
      if (isTRUE(a$strict) && tside == 2) p <- p + hp_t_lower(-q, nu, ncp)
      p
    },
    power.anova.test = {
      g <- a$groups; lambda <- (g - 1) * a$n * (a$between.var / a$within.var)
      hp_f_upper(qf(sl, g - 1, (a$n - 1) * g, lower.tail = FALSE), g - 1, (a$n - 1) * g, lambda)
    },
    pwr.t.test = , pwr.t2n.test = {
      if (fn == "pwr.t.test") { tsample <- ts(a$type); nu <- (a$n - 1) * tsample; ncp <- sqrt(a$n / tsample) }
      else { nu <- a$n1 + a$n2 - 2; ncp <- 1 / sqrt(1 / a$n1 + 1 / a$n2) }
      alt <- if (is.null(alt)) "two.sided" else alt
      d <- if (alt == "two.sided") abs(a$d) else a$d; ncp <- ncp * d
      if (alt == "less") hp_t_lower(qt(sl, nu), nu, ncp)
      else if (alt == "greater") hp_t_upper(qt(sl, nu, lower.tail = FALSE), nu, ncp)
      else { q <- qt(sl / 2, nu, lower.tail = FALSE); hp_t_upper(q, nu, ncp) + hp_t_lower(-q, nu, ncp) }
    },
    pwr.chisq.test = hp_chisq_upper(qchisq(sl, a$df, lower.tail = FALSE), a$df, a$N * a$w^2),
    pwr.anova.test = {
      k <- a$k; hp_f_upper(qf(sl, k - 1, (a$n - 1) * k, lower.tail = FALSE), k - 1, (a$n - 1) * k, k * a$n * a$f^2)
    },
    pwr.f2.test = hp_f_upper(qf(sl, a$u, a$v, lower.tail = FALSE), a$u, a$v, a$f2 * (a$u + a$v + 1)),
    NULL)
}

# R's interval, tolerance and extendInt for solving `x` in fn (as the functions call uniroot)
solve_spec <- function(fn, x, a) {
  alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
  e4 <- .Machine$double.eps^0.25
  dint <- switch(alt, two.sided = c(1e-7, 10), less = c(-10, 5), greater = c(-5, 10))
  sig <- list(int = c(1e-10, 1 - 1e-10), ext = "no", tol = e4)
  switch(fn,
    power.t.test = switch(x, n = list(int = c(2, 1e7), ext = "upX", tol = e4),
                          sd = list(int = a$delta * c(1e-7, 1e7), ext = "downX", tol = e4),
                          delta = list(int = (if (is.null(a$sd)) 1 else a$sd) * c(1e-7, 1e7), ext = "upX", tol = e4),
                          sig.level = list(int = c(1e-10, 1 - 1e-10), ext = "yes", tol = e4)),
    power.anova.test = switch(x, groups = list(int = c(2, 100), ext = "no", tol = e4),
                              n = list(int = c(2, 1e5), ext = "no", tol = e4),
                              within.var = list(int = a$between.var * c(1e-7, 1e7), ext = "no", tol = e4),
                              between.var = list(int = a$within.var * c(1e-7, 1e7), ext = "no", tol = e4),
                              sig.level = sig),
    pwr.t.test = switch(x, n = list(int = c(2 + 1e-10, 1e9), ext = "no", tol = e4), d = list(int = dint, ext = "no", tol = e4), sig.level = sig),
    pwr.t2n.test = switch(x, n1 = , n2 = list(int = c(2 + 1e-10, 1e9), ext = "no", tol = e4), d = list(int = dint, ext = "no", tol = e4), sig.level = sig),
    pwr.chisq.test = switch(x, w = list(int = c(1e-10, 1e9), ext = "no", tol = e4), N = list(int = c(1 + 1e-10, 1e9), ext = "no", tol = e4), sig.level = sig),
    pwr.anova.test = switch(x, k = list(int = c(2 + 1e-10, 100), ext = "no", tol = e4), n = list(int = c(2 + 1e-10, 1e9), ext = "no", tol = e4),
                            f = list(int = c(1e-7, 1e7), ext = "no", tol = e4), sig.level = sig),
    pwr.f2.test = switch(x, u = list(int = c(1 + 1e-10, 100), ext = "no", tol = e4), v = list(int = c(1 + 1e-10, 1e9), ext = "no", tol = e4),
                         f2 = list(int = c(1e-7, 1e7), ext = "no", tol = e4), sig.level = sig),
    NULL)
}

# Reference for a case: the accurate power, or the solved quantity by R's procedure on the accurate power
power_ref <- function(fn, args, nul = "NULL") {
  solved <- names(args)[vapply(args, function(v) identical(v, nul), NA)]
  if (length(solved) != 1) return(NULL)
  a <- lapply(args, function(v) if (identical(v, nul)) NULL else v)
  if (solved == "power") {
    p <- tryCatch(hp_power(fn, a), error = function(e) NULL)
    return(if (is.null(p)) NULL else list(power = num2str(p)))
  }
  sp <- solve_spec(fn, solved, a)
  if (is.null(sp) || is.null(hp_power(fn, modifyList(a, setNames(list(mean(sp$int)), solved))))) return(NULL)
  target <- a$power
  g <- function(x) { b <- a; b[[solved]] <- x; b$power <- NULL; hp_power(fn, b) - target }
  r <- tryCatch(uniroot(g, sp$int, tol = sp$tol, extendInt = sp$ext)$root, error = function(e) NULL)
  if (is.null(r)) return(NULL)
  setNames(list(num2str(r)), solved)
}
