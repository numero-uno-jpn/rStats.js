source("/oracle/_common.R")

# ---- Hypergeometric distribution (m white balls, n black balls, k drawn) ----
hp <- data.frame(
  m = c(5, 10, 1, 0, 5, 5, 5, 20, 100, 50, 51, 1000, 1e4, 1e6, 2^31, 1e9, 1e15, 3, 1e7,
        # invalid and boundary parameters (phyper rounds; dhyper gives NaN for non-integers)
        5.5, 4.5, 5 + 1e-10, 5 + 1e-8, -1, 5, 5, NaN, Inf, 5),
  n = c(5, 7, 1, 5, 0, 5, 5, 30, 200, 50, 50, 1000, 1e5, 1e6, 2^31, 1e9, 1e15, 1e6, 3,
        5, 5, 5, 5, 5, 5, 5, 5, 5, Inf),
  k = c(4, 8, 1, 3, 3, 0, 10, 25, 100, 50, 50, 1000, 5e3, 1e3, 10, 1e9, 1e9, 2, 5e6,
        4, 4, 4, 4, 4, 11, 4.5, 4, 4, 4))
hx <- function(m, n, k) {
  if (!all(is.finite(c(m, n, k))) || m < 0 || n < 0 || k < 0 || k > m + n)
    return(c(0, 1, 2, 3))
  m <- round(m); n <- round(n); k <- round(k)
  lo <- max(0, k - n); hi <- min(k, m)
  N <- m + n
  mu <- k * m / N
  sd <- sqrt(k * (m / N) * (n / N) * (N - k) / max(N - 1, 1))
  x <- c(lo + 0:3, hi - 0:3, round(mu + sd * c(-40, -10, -5, -3, -1, -0.5, 0, 0.5, 1, 3, 5, 10, 40)),
         lo - 1, hi + 1)
  x <- unique(x[x >= lo - 1 & x <= hi + 1])
  c(x, lo + 0.5, lo + 1e-8, NaN, Inf, -Inf)
}
hgrid <- do.call(rbind, lapply(seq_len(nrow(hp)), function(i) {
  p <- hp[i, ]
  data.frame(x = hx(p$m, p$n, p$k), m = p$m, n = p$n, k = p$k)
}))

# High-precision reference: choose(m, x) choose(n, k - x) / choose(m + n, k)
lch <- function(a, b) lgamma(mp(a) + 1) - lgamma(mp(b) + 1) - lgamma(mp(a) - b + 1)
ref_dhyper_mp <- function(x, m, n, k) exp(lch(m, x) + lch(n, k - x) - lch(m + n, k))
hyper_ok <- function(x, m, n, k)
  all(is.finite(c(x, m, n, k))) && all(c(m, n, k) == round(c(m, n, k))) && x == round(x) &&
    x >= max(0, k - n) && x <= min(k, m) && k <= m + n && min(m, n, k) >= 0
ref_dhyper <- function(x, m, n, k, log) {
  if (!hyper_ok(x, m, n, k)) return(NA)
  d <- ref_dhyper_mp(x, m, n, k)
  if (log) log(d) else d
}
write_fixture("dhyper", with_log(hgrid), function(r)
  dhyper(r$x, r$m, r$n, r$k, log = r$log),
  function(r) ref_dhyper(r$x, r$m, r$n, r$k, r$log))

# Distribution function: sum the tail far from the mean as p(x) × Σ (products of ratios) (5000 terms at a time, positive terms)
ref_phyper <- function(q, m, n, k, lower, log) {
  if (!all(is.finite(c(q, m, n, k)))) return(NA)
  m <- round(m); n <- round(n); k <- round(k)
  x <- floor(q + 1e-7)
  lo <- max(0, k - n); hi <- min(k, m)
  if (!(x >= lo && x < hi)) return(NA)
  N <- m + n
  down <- x * N < k * m
  y0 <- if (down) x else x + 1
  s <- mp(0); last <- mp(1); y <- y0; B <- 5000
  repeat {
    if ((down && y <= lo) || (!down && y >= hi)) { s <- s + last; break }
    ys <- if (down) seq(y, max(lo + 1, y - B + 1), by = -1) else seq(y, min(hi - 1, y + B - 1))
    Y <- mp(ys)
    r <- if (down) Y * (n - k + Y) / ((m - Y + 1) * (k - Y + 1)) else (m - Y) * (k - Y) / ((Y + 1) * (n - k + Y + 1))
    terms <- last * cumprod(c(mp(1), r[-length(r)]))
    s <- s + sum(terms)
    last <- terms[length(terms)] * r[length(r)]
    y <- if (down) ys[length(ys)] - 1 else ys[length(ys)] + 1
    if (asNumeric(log2(last / s)) < -MPFR_BITS) { s <- s + last; break }
    if ((down && y <= lo) || (!down && y >= hi)) { s <- s + last; break }
  }
  small <- ref_dhyper_mp(y0, m, n, k) * s
  if (lower == down) return(if (log) log(small) else small)
  if (log) log1p(-small) else 1 - small
}
names(hgrid)[1] <- "q"
write_fixture("phyper", with_tails(hgrid), function(r)
  phyper(r$q, r$m, r$n, r$k, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_phyper(r$q, r$m, r$n, r$k, r$lowerTail, r$logP))

# Quantiles (R's qhyper adds one term at a time from the bottom of the support, so it never finishes for large parameters; up to about N <= 1e7)
qp <- hp[!(hp$m %in% c(1e9, 1e15, 2^31, 1e7)) & !(hp$n %in% c(1e6) & hp$m == 3), ]
write_fixture("qhyper", quantile_grid(qp), function(r)
  qhyper(r$p, r$m, r$n, r$k, lower.tail = r$lowerTail, log.p = r$logP))
