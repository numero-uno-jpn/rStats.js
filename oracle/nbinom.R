source("/oracle/_common.R")

# Geometric and negative binomial distributions (size and prob, size and mu)

nmp <- function(x) Rmpfr::mpfr(x, MPFR_BITS)
nfin <- function(...) all(is.finite(c(...)))
isint <- function(x) is.finite(x) && x >= 0 && x == round(x)

# ---- Geometric distribution ----
gx <- c(0:30, 50, 100, 300, 1000, 1e4, 1e5, 1e6, 1e7, 1e10, 2.5, 1 + 1e-9, 1 + 5e-10, -1, Inf, NaN)
gprob <- c(1e-10, 1e-5, 0.001, 0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 1 - 1e-10, 1, 0, -0.1, 1.1, NaN)
gg <- grid_of(x = gx, prob = gprob)
write_fixture("dgeom", with_log(gg), function(r) dgeom(r$x, r$prob, log = r$log),
  function(r) {
    if (!(isint(r$x) && nfin(r$prob) && r$prob > 0 && r$prob < 1)) return(NA)
    ld <- log(nmp(r$prob)) + r$x * log1p(-nmp(r$prob))
    if (r$log) ld else exp(ld)
  })
names(gg)[1] <- "q"
# P[X > x] = (1 - p)^(x + 1). The log of the side close to 1 comes from the other side via log1p
write_fixture("pgeom", with_tails(gg), function(r)
  pgeom(r$q, r$prob, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(nfin(r$q, r$prob) && r$q >= 0 && r$prob > 0 && r$prob < 1)) return(NA)
    x <- floor(r$q + 1e-7)
    lu <- (x + 1) * log1p(-nmp(r$prob))
    up <- exp(lu)
    if (!r$lowerTail) return(if (r$logP) lu else up)
    if (r$logP) log1p(-up) else -expm1(lu)
  })
write_fixture("qgeom", quantile_grid(data.frame(prob = gprob)), function(r)
  qgeom(r$p, r$prob, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Negative binomial distribution ----
nx <- c(0:12, 20, 30, 50, 100, 300, 1000, 1e4, 1e5, 1e6, 1e8, 2.5, -1, Inf, NaN)
nsize <- c(0, 1e-10, 0.01, 0.5, 1, 2.5, 3, 10, 50, 1000, 1e5, 1e7, Inf, -1, NaN)
nprob <- c(1e-10, 0.001, 0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 1 - 1e-10, 1, 0, 1.1, NaN)
nmu <- c(0, 1e-10, 0.01, 0.5, 1, 2, 3, 10, 100, 1e4, 1e6, Inf, -1, NaN)

# Log probability lgamma(x + n) - lgamma(n) - lgamma(x + 1) + n log p + x log q (p, q are mpfr)
ref_dnb <- function(x, n, P, Q, log) {
  ld <- lgamma(x + nmp(n)) - lgamma(nmp(n)) - lgamma(nmp(x) + 1) + n * log(P) + x * log(Q)
  if (log) ld else exp(ld)
}
# P[X <= x] = I_p(n, x + 1). If the incomplete beta series cannot be used, sum the probabilities directly
ref_pnb <- function(q, n, P, Q, lower, log) {
  x <- floor(q + 1e-7)
  # For integer size, upper P[X > x] = P[Bin(x + n, p) < n] = Σ_{j<n} C(x+n, j) p^j q^(x+n-j) (sum of n positive terms)
  if (n == round(n) && n <= 1e4) {
    j <- 0:(n - 1)
    up <- sum(exp(lgamma(nmp(x + n) + 1) - lgamma(nmp(j) + 1) - lgamma(nmp(x + n - j) + 1) +
                    j * log(P) + (x + n - j) * log(Q)))
    if (asNumeric(up) < 0.5) {
      if (!lower) return(if (log) log(up) else up)
      return(if (log) log1p(-up) else 1 - up)
    }
  }
  v <- ref_pnb_sum(x, n, P, Q, lower, log)
  if (!is.na(asNumeric(v))) return(v)
  v <- ref_betainc(n, x + 1, P, lower, log, xc = Q)
  # Discard values that fell out of range due to cancellation in 1 - (other side)
  vn <- asNumeric(v)
  if (is.na(vn) || (log && vn > 0) || (!log && (vn < 0 || vn > 1))) return(NA)
  v
}
# Smaller tail as a sum of probabilities (below the mean from x down to 0, above it from x + 1 upward; terms decrease monotonically).
# Terms are cumulative products of the ratios P[k+1]/P[k] = (k + n) q / (k + 1) (kept in mpfr, so rounding is negligible)
ref_pnb_sum <- function(x, n, P, Q, lower, log) {
  N <- nmp(n)
  pmf1 <- function(k) exp(lgamma(k + N) - lgamma(N) - lgamma(nmp(k) + 1) + N * log(P) + k * log(Q))
  mean <- asNumeric(N * Q / P)
  B <- 5000
  s <- nmp(0)
  if (x < mean) {
    if (x > 2e6) return(NA)
    # Downward from x: P[k-1]/P[k] = k / ((k - 1 + n) q)
    t <- pmf1(x); k <- x
    repeat {
      ks <- k:max(0, k - B + 1)
      r <- c(nmp(1), ks[-length(ks)] / ((ks[-length(ks)] - 1 + N) * Q))
      terms <- t * cumprod(r)
      s <- s + sum(terms)
      k <- ks[length(ks)] - 1
      if (k < 0 || asNumeric(log2(terms[length(terms)] / s)) < -300) break
      t <- terms[length(terms)] * (k + 1) / ((k + N) * Q)
    }
    small_is_lower <- TRUE
  } else {
    t <- pmf1(x + 1); k <- x + 1
    repeat {
      ks <- k:(k + B - 1)
      r <- c(nmp(1), (ks[-B] + N) * Q / (ks[-B] + 1))
      terms <- t * cumprod(r)
      s <- s + sum(terms)
      if (asNumeric(log2(terms[B] / s)) < -300) break
      k <- k + B
      if (k > x + 3e6) return(NA)
      t <- terms[B] * (ks[B] + N) * Q / (ks[B] + 1)
    }
    small_is_lower <- FALSE
  }
  if (lower == small_is_lower) return(if (log) log(s) else s)
  if (log) log1p(-s) else 1 - s
}

prob_pq <- function(prob) list(P = nmp(prob), Q = 1 - nmp(prob))
mu_pq <- function(n, mu) { N <- nmp(n); list(P = N / (N + mu), Q = mu / (N + mu)) }

ng <- grid_of(x = nx, size = nsize, prob = nprob)
write_fixture("dnbinom", with_log(ng), function(r) dnbinom(r$x, r$size, r$prob, log = r$log),
  function(r) {
    if (!(isint(r$x) && nfin(r$size, r$prob) && r$size > 0 && r$prob > 0 && r$prob < 1)) return(NA)
    pq <- prob_pq(r$prob)
    ref_dnb(r$x, r$size, pq$P, pq$Q, r$log)
  })
mg <- grid_of(x = nx, size = nsize, mu = nmu)
write_fixture("dnbinom_mu", with_log(mg), function(r) dnbinom(r$x, r$size, mu = r$mu, log = r$log),
  function(r) {
    if (!(isint(r$x) && nfin(r$size, r$mu) && r$size > 0 && r$mu > 0)) return(NA)
    pq <- mu_pq(r$size, r$mu)
    ref_dnb(r$x, r$size, pq$P, pq$Q, r$log)
  })
names(ng)[1] <- "q"
names(mg)[1] <- "q"
write_fixture("pnbinom", with_tails(ng), function(r)
  pnbinom(r$q, r$size, r$prob, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (!(nfin(r$q, r$size, r$prob) && r$q >= 0 && r$size > 0 && r$prob > 0 && r$prob < 1)) return(NA)
    pq <- prob_pq(r$prob)
    ref_pnb(r$q, r$size, pq$P, pq$Q, r$lowerTail, r$logP)
  })
write_fixture("pnbinom_mu", with_tails(mg), function(r)
  pnbinom(r$q, r$size, mu = r$mu, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) {
    if (is.finite(r$q) && r$q >= 0 && r$size == Inf && is.finite(r$mu) && r$mu > 0)
      return(ref_gammainc(floor(r$q + 1e-7) + 1, r$mu, !r$lowerTail, r$logP))
    if (!(nfin(r$q, r$size, r$mu) && r$q >= 0 && r$size > 0 && r$mu > 0)) return(NA)
    pq <- mu_pq(r$size, r$mu)
    ref_pnb(r$q, r$size, pq$P, pq$Q, r$lowerTail, r$logP)
  })
# R's qnbinom never finishes its search for some inputs (e.g. qnbinom(-1, 0.5, 1e-10, log.p = TRUE)).
# Each case is evaluated with a 2-second limit, and rows that do not finish are dropped from the fixture
drop_hanging <- function(grid, f) {
  keep <- vapply(seq_len(nrow(grid)), function(i) {
    r <- as.list(grid[i, , drop = FALSE])
    setTimeLimit(elapsed = 2, transient = TRUE)
    ok <- tryCatch({ suppressWarnings(f(r)); TRUE }, error = function(e) FALSE)
    setTimeLimit(elapsed = Inf)
    if (!ok) cat(sprintf("excluded because R does not finish: %s\n", paste(names(r), unlist(r), sep = "=", collapse = " ")))
    ok
  }, logical(1))
  grid[keep, , drop = FALSE]
}
qnb <- function(r) qnbinom(r$p, r$size, r$prob, lower.tail = r$lowerTail, log.p = r$logP)
write_fixture("qnbinom", drop_hanging(quantile_grid(grid_of(size = nsize, prob = nprob)), qnb), qnb)
qnbm <- function(r) qnbinom(r$p, r$size, mu = r$mu, lower.tail = r$lowerTail, log.p = r$logP)
write_fixture("qnbinom_mu", drop_hanging(quantile_grid(grid_of(size = nsize, mu = nmu)), qnbm), qnbm)
