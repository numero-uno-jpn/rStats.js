# The incomplete beta function with one large and one small parameter (fixtures pbetaLargeA, ptLargeDf, pfLargeDf,
# pbinomLargeN): pbeta with a = 50 to 1e10 and b = 0.1 to 30 (and the mirror image), pt with large degrees of
# freedom, pf with one large degree of freedom and pbinom with x near 0 or n. These regions go through the series
# and the continued fraction in rStats.js; the uniform asymptotic expansion for both parameters large does not
# apply (ab/(a + b) < 25, except for a few cases at b = 30 placed at the switch).
#
# The points x are placed by the limiting distribution: for a large, y = (a + b)(1 - x) is approximately
# Gamma(b, 1), so 1 - x = qgamma(p, b) / (a + b) for p from 1e-300 to 1/2 in both tails, from the centre into the
# far tails. Cases whose x rounds to 0 or 1 are dropped.
#
# Every case has a reference value (<name>.ref.json, written here, not by scripts/refresh-references.sh), so that
# a change can be judged against the true value without R and Rmpfr at hand. The reference is the positive-term
# series of oracle/_common.R in the frame of the small parameter, where it converges in a few hundred terms
# whatever the large parameter (ref_small_b below); the other tail is 1 - (that one) with enough bits. A sample of
# the cases is checked against ref_betainc (both frames; slow for large a) when the oracle runs.
# In the far tails of the smaller parameters (df = 50 with |t| >= 50, results that underflow) that series does not
# converge; those cases take the general ref_betainc (both frames, as in oracle/beta.R), which is also registered for
# scripts/refresh-references.sh.
source("/oracle/_common.R")
suppressMessages(library(Rmpfr))

# ---- Reference values ----

# I_x(a, b) (lower) or 1 - I_x(a, b) (upper) for small b, from the series for 1 - I_x(a, b) = I_(1-x)(b, a).
# X and XC (= 1 - x) are mpfr numbers.
.small_b_cache <- new.env()
ref_small_b <- function(a, b, X, XC, lower, log) {
  key <- paste(c(format(c(a, b), digits = 17), format(X, digits = 60)), collapse = "_")
  e <- .small_b_cache[[key]]
  if (is.null(e)) {
    e <- list(up = ibeta_series(b, a, XC, X, 256))
    assign(key, e, envir = .small_b_cache)
  }
  if (!is.null(e$up) && !lower && (!log || asNumeric(e$up) < 0.5)) return(if (log) log(e$up) else e$up)
  # The lower tail 1 - up is wanted (or the log of the upper tail near 1)
  if (is.null(e$d)) {
    # (no series when it did not converge at 256 bits)
    d <- if (is.null(e$up)) NULL else 1 - ibeta_series(b, a, XC, X, 1300)
    if (!is.null(d) && isTRUE(as.logical(d > 0)) && asNumeric(log2(d)) >= -1200) {
      e$d <- d
      e$ld <- log(d)
    } else {
      # Below 2^-1200 the subtraction would need ever more bits (pt(-100, 1e12) is about e^-5000), and far from the
      # bulk the series does not converge at all: x is then below the mean, where the continued fraction for the
      # lower tail converges
      if (!isTRUE(as.logical(X < Rmpfr::mpfr(a, 400) / (Rmpfr::mpfr(a, 400) + b)))) return(NA)
      e$ld <- cf_log_lower(a, b, Rmpfr::roundMpfr(X, 400), Rmpfr::roundMpfr(XC, 400), 400)
      e$d <- exp(e$ld)
    }
    assign(key, e, envir = .small_b_cache)
  }
  if (lower) return(if (log) e$ld else e$d)
  if (log) log1p(-e$d) else 1 - e$d
}

# I_x(a, b) with x given as a double: the small parameter decides the frame
ref_pbeta_ab <- function(x, a, b, lower, log) {
  X <- Rmpfr::mpfr(x, 6500); XC <- 1 - X
  if (b <= a) ref_small_b(a, b, X, XC, lower, log) else ref_small_b(b, a, XC, X, !lower, log)
}

# pt as in oracle/beta.R: the smaller tail is I_(n/(n+t^2))(n/2, 1/2) / 2, with x and 1 - x formed at 6500 bits
ref_pt_large <- function(t, n, lower, log) {
  T2 <- Rmpfr::mpfr(t, 6500)^2; N <- Rmpfr::mpfr(n, 6500)
  half <- ref_small_b(n / 2, 0.5, N / (N + T2), T2 / (N + T2), TRUE, FALSE)
  small <- half / 2
  if ((t < 0) == lower) return(if (log) log(small) else small)
  if (log) log1p(-small) else 1 - small
}

# pf: I_z(m/2, n/2) with z = m x / (n + m x)
ref_pf_large <- function(x, m, n, lower, log) {
  M <- Rmpfr::mpfr(m, 6500); N <- Rmpfr::mpfr(n, 6500); X <- Rmpfr::mpfr(x, 6500)
  Z <- M * X / (N + M * X); ZC <- N / (N + M * X)
  if (n <= m) ref_small_b(m / 2, n / 2, Z, ZC, lower, log) else ref_small_b(n / 2, m / 2, ZC, Z, !lower, log)
}

# pbinom(x, n, p) = 1 - I_p(x + 1, n - x)
ref_pbinom_large <- function(x, n, p, lower, log) {
  if (x >= n) return(if (lower) (if (log) 0 else 1) else (if (log) -Inf else 0))
  P <- Rmpfr::mpfr(p, 6500); PC <- 1 - P
  a <- x + 1; b <- n - x
  if (b <= a) ref_small_b(a, b, P, PC, !lower, log) else ref_small_b(b, a, PC, P, lower, log)
}

# General references (both frames, as in oracle/beta.R), registered for scripts/refresh-references.sh
gen_pt <- function(t, n, lower, log) {
  T2 <- Rmpfr::mpfr(t, 6500)^2; N <- Rmpfr::mpfr(n, 6500)
  half <- ref_betainc(n / 2, 0.5, N / (N + T2), TRUE, FALSE, xc = T2 / (N + T2))
  if (is.na(half)) return(NA)
  small <- half / 2
  if ((t < 0) == lower) return(if (log) log(small) else small)
  if (log) log1p(-small) else 1 - small
}
gen_pf <- function(x, m, n, lower, log) {
  M <- Rmpfr::mpfr(m, 6500); N <- Rmpfr::mpfr(n, 6500); X <- Rmpfr::mpfr(x, 6500)
  r <- ref_betainc(m / 2, n / 2, M * X / (N + M * X), lower, log, xc = N / (N + M * X))
  if (!is.na(r) || !lower || !log) return(r)
  # Deep lower tail with m huge (pf(1e-5, 1e10, 10, log.p = TRUE) is about -5e5; R underflows to -Inf there): neither
  # series converges, but z is below the mean, where the continued fraction does. Agrees at 400 and 800 bits
  M <- Rmpfr::mpfr(m, 800); N <- Rmpfr::mpfr(n, 800); X <- Rmpfr::mpfr(x, 800)
  cf_log_lower(m / 2, n / 2, M * X / (N + M * X), N / (N + M * X), 800)
}

# log I_z(a, b) by the continued fraction DLMF 8.17.22 (modified Lentz), for z below the mean a / (a + b)
cf_log_lower <- function(a, b, z, zc, bits) {
  a <- Rmpfr::mpfr(a, bits); b <- Rmpfr::mpfr(b, bits)
  tiny <- Rmpfr::mpfr(2, bits)^(-3 * bits); eps <- Rmpfr::mpfr(2, bits)^(10 - bits)
  f <- Rmpfr::mpfr(1, bits); C <- f; D <- Rmpfr::mpfr(0, bits); j <- 0
  for (i in 1:100000) {
    if (i %% 2 == 1) {
      d <- -(a + j) * (a + b + j) * z / ((a + 2 * j) * (a + 2 * j + 1))
    } else {
      j <- j + 1
      d <- j * (b - j) * z / ((a + 2 * j - 1) * (a + 2 * j))
    }
    D <- 1 + d * D
    if (D == 0) D <- tiny
    C <- 1 + d / C
    if (C == 0) C <- tiny
    D <- 1 / D
    delta <- C * D
    f <- f * delta
    if (abs(delta - 1) < eps) break
  }
  a * log(z) + b * log(zc) - log(a) - (lgamma(a) + lgamma(b) - lgamma(a + b)) - log(f)
}

# The reference v, or the general one when v could not be computed
or_else <- function(v, general) if (length(v) == 1 && is.na(v)) general() else v

# Writes <name>.ref.json with a reference value for every finite case (format of oracle/_reference.R).
# Skipped when oracle/_reference.R sources this file
write_references <- function(name, grid, ref) {
  if (exists("ORACLE_REF_MODE") && isTRUE(ORACLE_REF_MODE)) return(invisible(NULL))
  res <- list()
  for (i in seq_len(nrow(grid))) {
    row <- as.list(grid[i, , drop = FALSE])
    r <- asNumeric(ref(row))
    if (length(r) == 1 && !is.na(r)) {
      args <- lapply(row, function(v) if (is.logical(v)) v else num2str(v))
      res[[length(res) + 1]] <- list(args = args, reference = num2str(r))
    }
  }
  tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA)
  lines <- c("[", if (length(res)) paste0("  ", vapply(res, tj, character(1)),
                                            c(rep(",", length(res) - 1), "")), "]")
  writeLines(lines, file.path("/out", paste0(name, ".ref.json")))
  cat(sprintf("%s: reference values for %d / %d cases\n", name, length(res), nrow(grid)))
}

# ---- pbeta ----

large <- c(50, 200, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10)
small <- c(0.1, 0.5, 1, 1.5, 2.5, 5, 10, 20, 30)
probs <- c(1e-300, 1e-50, 1e-10, 0.01, 0.3, 0.5)
bgrid <- do.call(rbind, lapply(large, function(a) do.call(rbind, lapply(small, function(b) {
  y <- unique(c(qgamma(probs, b), qgamma(probs, b, lower.tail = FALSE)))
  xc <- y / (a + b)
  x <- 1 - xc
  # Both orientations: pbeta(x, a, b) with x near 1, and pbeta(1 - x, b, a) with the small x itself
  rbind(data.frame(q = x, shape1 = a, shape2 = b), data.frame(q = xc, shape1 = b, shape2 = a))
}))))
bgrid <- unique(bgrid[bgrid$q > 0 & bgrid$q < 1, ])
rownames(bgrid) <- NULL
bgrid <- with_tails(bgrid)
write_fixture("pbetaLargeA", bgrid, function(r)
  pbeta(r$q, r$shape1, r$shape2, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_betainc(r$shape1, r$shape2, r$q, r$lowerTail, r$logP))
write_references("pbetaLargeA", bgrid, function(r) or_else(ref_pbeta_ab(r$q, r$shape1, r$shape2, r$lowerTail, r$logP),
  function() ref_betainc(r$shape1, r$shape2, r$q, r$lowerTail, r$logP)))

# ---- pt ----

tdf <- c(50, 200, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e12, 1e15)
tq <- c(1e-8, 0.01, 0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 15, 20, 30, 38, 50, 100, 1000)
tgrid <- with_tails(grid_of(q = c(-rev(tq), tq), df = tdf))
write_fixture("ptLargeDf", tgrid, function(r)
  pt(r$q, r$df, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) gen_pt(r$q, r$df, r$lowerTail, r$logP))
write_references("ptLargeDf", tgrid, function(r) or_else(ref_pt_large(r$q, r$df, r$lowerTail, r$logP),
  function() gen_pt(r$q, r$df, r$lowerTail, r$logP)))

# ---- pf ----

fsmall <- c(0.5, 1, 3, 10, 30)
flarge <- c(1e3, 1e5, 1e7, 1e10)
fx <- c(1e-5, 0.01, 0.1, 0.3, 0.7, 1, 1.5, 2, 3, 5, 10, 30, 100)
fgrid <- with_tails(rbind(grid_of(q = fx, df1 = fsmall, df2 = flarge), grid_of(q = fx, df1 = flarge, df2 = fsmall)))
write_fixture("pfLargeDf", fgrid, function(r)
  pf(r$q, r$df1, r$df2, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) gen_pf(r$q, r$df1, r$df2, r$lowerTail, r$logP))
write_references("pfLargeDf", fgrid, function(r) or_else(ref_pf_large(r$q, r$df1, r$df2, r$lowerTail, r$logP),
  function() gen_pf(r$q, r$df1, r$df2, r$lowerTail, r$logP)))

# ---- pbinom ----

# n large and a mean of lambda successes (prob = lambda / n, x near 0) or failures (prob = 1 - lambda / n, x near n)
ngrid <- do.call(rbind, lapply(c(1e3, 1e5, 1e7, 1e9), function(n) do.call(rbind, lapply(c(0.5, 3, 20), function(lambda) {
  k <- c(0, 1, 2, 5, 10, 20, 50, 100)
  rbind(data.frame(q = k, size = n, prob = lambda / n), data.frame(q = n - k, size = n, prob = 1 - lambda / n))
}))))
ngrid <- with_tails(ngrid)
write_fixture("pbinomLargeN", ngrid, function(r)
  pbinom(r$q, r$size, r$prob, lower.tail = r$lowerTail, log.p = r$logP))
write_references("pbinomLargeN", ngrid, function(r) ref_pbinom_large(r$q, r$size, r$prob, r$lowerTail, r$logP))

# ---- Check of ref_small_b against ref_betainc (both frames) on a sample with a <= 1e4 ----

if (!(exists("ORACLE_REF_MODE") && isTRUE(ORACLE_REF_MODE))) {
  set.seed(1)
  chk <- bgrid[pmax(bgrid$shape1, bgrid$shape2) <= 1e4, ]
  chk <- chk[sample(nrow(chk), min(60, nrow(chk))), ]
  worst <- 0
  for (i in seq_len(nrow(chk))) {
    r <- chk[i, ]
    u <- ref_pbeta_ab(r$q, r$shape1, r$shape2, r$lowerTail, r$logP)
    v <- ref_betainc(r$shape1, r$shape2, r$q, r$lowerTail, r$logP)
    if (!is.na(v)) worst <- max(worst, asNumeric(abs((u - v) / v)))
  }
  cat(sprintf("check against ref_betainc: %d cases, max relative difference %.3g\n", nrow(chk), worst))
}
