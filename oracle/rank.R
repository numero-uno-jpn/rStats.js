source("/oracle/_common.R")

# Distributions of rank statistics: Wilcoxon signed rank (signrank) and rank sum (wilcox).
# R cannot allocate memory for n = Inf or large m, n and crashes (several GB at m = n = 500), so these are not in the grid.

# ---- Signed rank statistic ----
sr_n <- c(1, 2, 3, 4, 5, 6, 10, 12, 20, 30, 49, 50, 51, 100, 200, 500, 1000, 1100,
          5.5, 4.5, 0.6, 0.5, 0, -1, NaN)
sr_x <- function(n) {
  if (!is.finite(n) || round(n) <= 0) return(c(0, 1, 3))
  n <- round(n)
  tot <- n * (n + 1) / 2
  mu <- tot / 2
  sd <- sqrt(n * (n + 1) * (2 * n + 1) / 24)
  x <- c(0:5, tot - 0:5, round(mu + sd * c(-10, -5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 10)), -1, tot + 1)
  x <- unique(x[x >= -1 & x <= tot + 1])
  c(x, 2.5, 3 + 1e-8, 3 + 1e-10, NaN, Inf, -Inf)
}
sgrid <- do.call(rbind, lapply(sr_n, function(n) data.frame(x = sr_x(n), n = n)))

# High-precision reference: count c_n(s) exactly with big integers (gmp), memoised per n
.sr_cache <- new.env()
sr_counts <- function(n) {
  key <- as.character(n)
  w <- .sr_cache[[key]]
  if (is.null(w)) {
    half <- floor(n * (n + 1) / 4)
    w <- gmp::as.bigz(c(1, rep(0, half)))
    for (k in seq_len(min(n, half))) {
      idx <- (k + 1):(half + 1)
      w[idx] <- w[idx] + w[idx - k]
    }
    assign(key, w, envir = .sr_cache)
  }
  w
}
sr_ok <- function(n) is.finite(n) && n == round(n) && n > 0
# P[V = s] (s folded into the lower half)
ref_dsignrank_mp <- function(s, n) {
  tot <- n * (n + 1) / 2
  s <- min(s, tot - s)
  Rmpfr::mpfr(sr_counts(n)[s + 1], 4000) / Rmpfr::mpfr(2, 4000)^n
}
# P[V <= s] (s <= end of the lower half)
ref_csignrank_mp <- function(s, n) {
  Rmpfr::mpfr(sum(sr_counts(n)[1:(s + 1)]), 4000) / Rmpfr::mpfr(2, 4000)^n
}
# x treated as an integer (R treats x as an integer if |x - round(x)| <= 1e-9 max(1, |x|))
as_int <- function(x) if (is.finite(x) && abs(x - round(x)) <= 1e-9 * max(1, abs(x))) round(x) else x
ref_dsignrank <- function(x, n, log) {
  x <- as_int(x)
  if (!(sr_ok(n) && is.finite(x) && x == round(x) && x >= 0 && x <= n * (n + 1) / 2)) return(NA)
  d <- ref_dsignrank_mp(x, n)
  if (log) log(d) else d
}
write_fixture("dsignrank", with_log(sgrid), function(r) dsignrank(r$x, r$n, log = r$log),
              function(r) ref_dsignrank(r$x, r$n, r$log))

# Distribution function. R rounds q + 1e-7 to the nearest integer
sq <- sgrid
names(sq)[1] <- "q"
sq <- rbind(sq, data.frame(q = c(3.4, 3.6, 3.5 - 1e-7, 2.5 - 1e-7, -0.4, -0.6), n = 5))
ref_psignrank <- function(q, n, lower, log) {
  if (!(sr_ok(n) && is.finite(q))) return(NA)
  tot <- n * (n + 1) / 2
  x <- round(q + 1e-7)
  if (x < 0 || x >= tot) return(NA)
  # Smaller tail: P[V <= x] or P[V > x] = P[V <= tot - x - 1]
  lo_small <- x <= tot - x - 1
  small <- if (lo_small) ref_csignrank_mp(x, n) else ref_csignrank_mp(tot - x - 1, n)
  if (lower == lo_small) return(if (log) log(small) else small)
  if (log) log1p(-small) else 1 - small
}
write_fixture("psignrank", with_tails(sq), function(r)
  psignrank(r$q, r$n, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_psignrank(r$q, r$n, r$lowerTail, r$logP))

# At n = 1100 R's counts overflow (Inf) and the quantile search never finishes, so it is excluded
write_fixture("qsignrank", quantile_grid(data.frame(n = setdiff(sr_n, 1100))), function(r)
  qsignrank(r$p, r$n, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Rank sum statistic ----
wp <- data.frame(
  m = c(1, 1, 5, 4, 5, 10, 3, 20, 30, 49, 50, 2, 10, 100, 200, 4.5, 3.5, 4, 0.6, 0, -1, NaN, 4),
  n = c(1, 5, 4, 5, 6, 10, 20, 3, 40, 49, 50, 5000, 1000, 100, 200, 5, 5, 5.5, 1, 5, 5, 5, NaN))
w_x <- function(m, n) {
  if (!is.finite(m) || !is.finite(n) || round(m) <= 0 || round(n) <= 0) return(c(0, 1, 3))
  m <- round(m); n <- round(n)
  tot <- m * n
  mu <- tot / 2
  sd <- sqrt(m * n * (m + n + 1) / 12)
  x <- c(0:5, tot - 0:5, round(mu + sd * c(-10, -5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 10)), -1, tot + 1)
  x <- unique(x[x >= -1 & x <= tot + 1])
  c(x, 2.5, 3 + 1e-8, NaN, Inf, -Inf)
}
wgrid <- do.call(rbind, lapply(seq_len(nrow(wp)), function(i)
  data.frame(x = w_x(wp$m[i], wp$n[i]), m = wp$m[i], n = wp$n[i])))

# High-precision reference: compute the coefficients of the q-binomial Π (1 - q^{n+i}) / (1 - q^i) exactly with gmp
# (for s <= floor(mn/2); division by (1 - q^i) is a cumulative sum over residue classes mod i)
.w_cache <- new.env()
w_counts <- function(m, n) {
  if (m > n) { t <- m; m <- n; n <- t }
  key <- paste(m, n)
  P <- .w_cache[[key]]
  if (is.null(P)) {
    L <- floor(m * n / 2)
    P <- gmp::as.bigz(c(1, rep(0, L)))
    for (i in seq_len(m)) {
      sh <- n + i
      if (sh <= L) {
        idx <- (sh + 1):(L + 1)
        P[idx] <- P[idx] - P[idx - sh]
      }
      for (r in seq_len(min(i, L + 1)) - 1) {
        idx <- seq(r + 1, L + 1, by = i)
        if (length(idx) > 1) P[idx] <- cumsum(P[idx])
      }
    }
    assign(key, P, envir = .w_cache)
  }
  P
}
w_ok <- function(m, n) is.finite(m) && is.finite(n) && m == round(m) && n == round(n) && m > 0 && n > 0
w_total <- function(m, n) Rmpfr::mpfr(gmp::chooseZ(m + n, m), 4000)
ref_dwilcox <- function(x, m, n, log) {
  x <- as_int(x)
  if (!(w_ok(m, n) && is.finite(x) && x == round(x) && x >= 0 && x <= m * n)) return(NA)
  s <- min(x, m * n - x)
  d <- Rmpfr::mpfr(w_counts(m, n)[s + 1], 4000) / w_total(m, n)
  if (log) log(d) else d
}
write_fixture("dwilcox", with_log(wgrid), function(r) dwilcox(r$x, r$m, r$n, log = r$log),
              function(r) ref_dwilcox(r$x, r$m, r$n, r$log))

wq <- wgrid
names(wq)[1] <- "q"
ref_pwilcox <- function(q, m, n, lower, log) {
  if (!(w_ok(m, n) && is.finite(q))) return(NA)
  tot <- m * n
  x <- floor(q + 1e-7)
  if (x < 0 || x >= tot) return(NA)
  lo_small <- x <= tot - x - 1
  s <- if (lo_small) x else tot - x - 1
  small <- Rmpfr::mpfr(sum(w_counts(m, n)[1:(s + 1)]), 4000) / w_total(m, n)
  if (lower == lo_small) return(if (log) log(small) else small)
  if (log) log1p(-small) else 1 - small
}
write_fixture("pwilcox", with_tails(wq), function(r)
  pwilcox(r$q, r$m, r$n, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pwilcox(r$q, r$m, r$n, r$lowerTail, r$logP))

write_fixture("qwilcox", quantile_grid(wp), function(r)
  qwilcox(r$p, r$m, r$n, lower.tail = r$lowerTail, log.p = r$logP))
