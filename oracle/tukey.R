source("/oracle/_common.R")

# Studentized range distribution ptukey / qtukey.
# R's ptukey just applies a 16-point Gauss-Legendre rule to fixed intervals, so it is accurate to about 8 digits
# (?ptukey), and the upper tail is 1 - (lower), so all digits are lost below 1e-10. qtukey is accurate to about 4 digits.

tk <- rbind(
  grid_of(nmeans = c(2, 3, 5, 10, 20), df = c(2, 5, 10, 30, 1000, Inf), nranges = 1),
  data.frame(nmeans = c(2.5, 50, 100, 1000, 3, 3, 3, 3, 5),
             df = c(10, 10, 10, 10, 2.5, 100, 1e5, 10, 30),
             nranges = c(1, 1, 1, 1, 1, 1, 1, 2, 1.5)))
tq <- c(0.5, 2, 3.5, 5, 8, 20)
pgrid <- merge(tk, data.frame(q = tq), by = NULL)
# Deep tails, boundaries and invalid arguments
pgrid <- rbind(pgrid,
  merge(data.frame(nmeans = c(3, 10), df = c(10, 10), nranges = 1),
        data.frame(q = c(1e-3, 0.1, 50, 100)), by = NULL),
  data.frame(q = c(0, -1, Inf, NaN, 3, 3, 3, 3, 3, 3, 3),
             nmeans = c(3, 3, 3, 3, 1, 1.9, 3, 3, 3, NaN, 3),
             df = c(10, 10, 10, 10, 10, 10, 1, 1.9, 10, 10, NaN),
             nranges = c(1, 1, 1, 1, 1, 1, 1, 1, 0.5, 1, 1)))
pgrid <- pgrid[, c("q", "nmeans", "df", "nranges")]

# ---- High-precision reference ----
# The double integral P[Q <= q] = ∫ f(u) G(q sqrt(e^u / a)) du (t = df s^2 / 2 ~ Gamma(a = df/2), u = log t),
#   G(w) = W(w)^r,  W(w) = k ∫ φ(z) {Φ(z) - Φ(z - w)}^(k-1) dz
# is computed with the trapezoidal rule on the real line for both the inner and outer integrals, in Rmpfr (TK_BITS bits). The integrands are analytic
# and decay fast, so the trapezoidal rule converges exponentially in the step h (halving the step roughly squares the error).
# The h/2 value is returned when the results for h and h/2 agree within relative 1e-18 (otherwise the step is refined).
# For large nmeans the integrand grows fast in the complex plane and convergence slows (halving h no longer squares the error).
# The upper tail 1 - W(w) = k ∫ φ(z) Φ(z)^(k-1) {1 - (1 - Φ(z - w)/Φ(z))^(k-1)} dz is computed directly
# (no subtraction). Node centre and width come from locating the integrand's peak in double precision (this changes only the convergence speed, not the value).
TK_BITS <- 160
tk_mp <- function(x) Rmpfr::mpfr(x, TK_BITS)

# Trapezoidal rule. lf is the double-precision log integrand (an approximation); step outward from the peak c with step width s,
# stopping where it is 60 below the peak (relative < 1e-26)
trap_integrate <- function(f, c, s, lf) {
  # If it does not converge, refine the step and retry
  for (div in c(1.5, 3, 6, 12, 24)) {
    v <- trap_once(f, c, s / div, lf)
    if (!is.null(v)) return(v)
  }
  NULL
}
trap_once <- function(f, c, h, lf) {
  lmax <- lf(c)
  ext <- function(dir) {
    j <- 0
    repeat {
      j <- j + 1
      v <- suppressWarnings(tryCatch(lf(c + dir * j * h), error = function(e) -Inf))
      if (is.na(v) || v < lmax - 60 || j > 4000) return(j)
    }
  }
  jl <- ext(-1); jr <- ext(1)
  # Nodes for step h/2 (the even-numbered ones are the nodes for step h)
  idx <- seq(-2 * jl, 2 * jr)
  x <- tk_mp(c) + tk_mp(h / 2) * idx
  v <- f(x)
  fine <- sum(v) * (h / 2)
  coarse <- sum(v[idx %% 2 == 0]) * h
  if (asNumeric(fine) == 0) return(fine)
  if (!isTRUE(asNumeric(abs(fine - coarse)) <= 1e-18 * abs(asNumeric(fine)))) return(NULL)
  fine
}
# Find the peak (centre) of the log integrand and a width from its curvature, in double precision
find_peak <- function(lf, lo, hi) {
  g <- seq(lo, hi, length.out = 400)
  v <- vapply(g, lf, numeric(1))
  i <- which.max(v)
  if (!is.finite(v[i])) return(NULL)
  o <- optimize(lf, c(g[max(1, i - 1)], g[min(400, i + 1)]), maximum = TRUE, tol = 1e-10)
  c <- o$maximum
  d <- 1e-3 * max(1, abs(c))
  curv <- (lf(c + d) - 2 * lf(c) + lf(c - d)) / d^2
  s <- if (is.finite(curv) && curv < 0) 1 / sqrt(-curv) else 1
  c(c, s)
}
lpd <- function(x) pnorm(x, log.p = TRUE)
# Inner integral: W(w) and 1 - W(w) (mpfr)
tk_inner <- function(w, k, upper) {
  wd <- asNumeric(w)
  if (!upper) {
    lf <- function(z) dnorm(z, log = TRUE) + (k - 1) * if (wd * max(1, abs(z)) < 1e-3)
      log(wd) + dnorm(z - wd / 2, log = TRUE) else log(max(pnorm(z) - pnorm(z - wd), 1e-320))
    pk <- find_peak(lf, -12, 12)
    f <- function(z) dnorm(z) * (pnorm(z) - pnorm(z - w))^(k - 1)
  } else {
    lf <- function(z) {
      lz <- lpd(z); la <- lpd(z - wd)
      dnorm(z, log = TRUE) + (k - 1) * lz + log(-expm1((k - 1) * log1p(-exp(la - lz))))
    }
    pk <- find_peak(lf, -12, wd + 12)
    f <- function(z) {
      P <- pnorm(z)
      dnorm(z) * P^(k - 1) * (-expm1((k - 1) * log1p(-pnorm(z - w) / P)))
    }
  }
  if (is.null(pk)) return(NULL)
  v <- trap_integrate(f, pk[1], pk[2], lf)
  if (is.null(v)) NULL else k * v
}
tk_G <- function(w, k, r, upper) {
  if (!upper) {
    W <- tk_inner(w, k, FALSE)
    return(if (is.null(W)) NULL else W^r)
  }
  Wc <- tk_inner(w, k, TRUE)
  if (is.null(Wc)) return(NULL)
  if (r == 1) Wc else -expm1(r * log1p(-Wc))
}
# Approximation of log G for locating the outer peak and integration range in double precision. W and 1 - W are computed coarsely
# in logs with the trapezoidal rule (step 0.05) (R's ptukey(df = Inf) is not used because it sets small W to 0 for large nmeans)
TK_Z <- seq(-14, 14, by = 0.05)
lse <- function(l) { m <- max(l); if (!is.finite(m)) return(-Inf); m + log(sum(exp(l - m))) }
approx_logW <- function(w, k, upper) {
  z <- if (upper) seq(-14, w + 14, by = 0.05) else TK_Z
  lz <- pnorm(z, log.p = TRUE)
  la <- pnorm(z - w, log.p = TRUE)
  if (!upper) {
    # log D = log Φ(z) + log(1 - Φ(z - w)/Φ(z))
    lD <- lz + log(-expm1(pmin(la - lz, -1e-300)))
    l <- dnorm(z, log = TRUE) + (k - 1) * lD
  } else {
    l <- dnorm(z, log = TRUE) + (k - 1) * lz + log(-expm1((k - 1) * log1p(-exp(la - lz))))
  }
  log(k) + log(0.05) + lse(l[is.finite(l)])
}
approx_logG <- function(w, k, r, upper) {
  if (!upper) return(r * approx_logW(w, k, FALSE))
  lc <- approx_logW(w, k, TRUE)
  if (r == 1) return(lc)
  log(-expm1(r * log1p(-exp(min(lc, -1e-300)))))
}
# The 4 tail combinations (lowerTail × logP) use the same "smaller tail" integral, so the result is memoised
.tk_cache <- new.env()
tk_ref <- function(q, k, df, r, lower, log) {
  if (!all(is.finite(c(q, k, r))) || q <= 0 || k < 2 || r < 1 || is.na(df) || df < 2) return(NA)
  key <- paste(format(c(q, k, df, r), digits = 17), collapse = "_")
  hit <- .tk_cache[[key]]
  if (is.null(hit)) {
    hit <- tk_small_tail(q, k, df, r)
    assign(key, hit, envir = .tk_cache)
  }
  v <- hit$v
  if (is.null(v)) return(NA)
  if (lower != hit$upper) return(if (log) log(v) else v)
  if (log) log1p(-v) else 1 - v
}
tk_small_tail <- function(q, k, df, r) {
  # Compute the smaller tail directly
  approx <- if (df == Inf) ptukey(q, k, Inf) else ptukey(q, k, df)
  upper_small <- approx > 0.5
  if (df == Inf) {
    v <- tk_G(tk_mp(q), k, r, upper_small)
  } else {
    a <- df / 2
    la <- lgamma(tk_mp(a))
    lf <- function(u) a * u - exp(u) - lgamma(a) + approx_logG(q * sqrt(exp(u) / a), k, r, upper_small)
    pk <- find_peak(lf, log(a) - 60 / a - 10, log(a) + 10)
    if (is.null(pk)) return(list(v = NULL, upper = upper_small))
    f <- function(u) {
      out <- tk_mp(rep(0, length(u)))
      for (i in seq_along(u)) {
        dens <- exp(a * u[i] - exp(u[i]) - la)
        g <- tk_G(tk_mp(q) * sqrt(exp(u[i]) / a), k, r, upper_small)
        if (is.null(g)) stop("inner integral did not converge")
        out[i] <- dens * g
      }
      out
    }
    v <- tryCatch(trap_integrate(f, pk[1], pk[2], lf), error = function(e) NULL)
  }
  list(v = v, upper = upper_small)
}

write_fixture("ptukey", with_tails(pgrid), function(r)
  ptukey(r$q, r$nmeans, r$df, r$nranges, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) tk_ref(r$q, r$nmeans, r$df, r$nranges, r$lowerTail, r$logP))

# Quantiles (R's qtukey is accurate to about 4 digits; the tests judge by the backward error obtained by inverting with the distribution function)
qk <- rbind(
  data.frame(nmeans = c(2, 3, 10, 20, 3, 3, 3, 2.5, 3, 5), df = c(10, 10, 10, 10, 2, 30, Inf, 10, 10, 30),
             nranges = c(1, 1, 1, 1, 1, 1, 1, 1, 2, 1.5)),
  data.frame(nmeans = c(1, 3, NaN), df = c(10, 1, 10), nranges = 1))
qp <- c(0, 1e-10, 0.01, 0.5, 0.95, 0.99, 0.999, 1, -0.1, NaN)
qlp <- c(-Inf, -20, -1, -0.05, 0)
qgrid <- rbind(
  merge(merge(qk, data.frame(p = qp), by = NULL), data.frame(lowerTail = c(TRUE, FALSE), logP = FALSE), by = NULL),
  merge(merge(qk, data.frame(p = qlp), by = NULL), data.frame(lowerTail = c(TRUE, FALSE), logP = TRUE), by = NULL))
qgrid <- qgrid[, c("p", "nmeans", "df", "nranges", "lowerTail", "logP")]
write_fixture("qtukey", qgrid, function(r)
  qtukey(r$p, r$nmeans, r$df, r$nranges, lower.tail = r$lowerTail, log.p = r$logP))
