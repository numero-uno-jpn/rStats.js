# Shared code for writing fixtures.
#
# Run by scripts/oracle.sh in a throwaway container (image rstats-oracle).
# Output goes to /out (= test/fixtures on the host).
#
# All numbers are written as strings: JSON numbers cannot represent Inf / NaN / NA,
# and the writer's rounding could drop digits. Finite values use %.17g, which
# guarantees enough digits to round-trip a double. R's NA and NaN both become NaN in JS.

num2str <- function(x) {
  vapply(x, function(v) {
    if (is.na(v) && !is.nan(v)) return("NA")
    if (is.nan(v)) return("NaN")
    if (is.infinite(v)) return(if (v > 0) "Inf" else "-Inf")
    sprintf("%.17g", v)
  }, character(1), USE.NAMES = FALSE)
}

# grid: data.frame with one case per row. Column names become the keys of the fixture's args
#       (use the JS argument names, e.g. lowerTail). Logical columns are written as booleans.
# fun:  function taking one row of grid (a named list) and returning one R value
# ref:  (optional) function returning a high-precision reference value for the same row (computed with Rmpfr).
#       Used to judge cases where R itself is inaccurate. Computing it for every case is far too slow, so it is
#       only registered here; oracle/_reference.R computes it only for the cases where the tests disagree with R.
REFS <- list()
write_fixture <- function(name, grid, fun, ref = NULL) {
  if (!is.null(ref)) REFS[[name]] <<- ref
  if (exists("ORACLE_REF_MODE") && isTRUE(ORACLE_REF_MODE)) return(invisible(NULL))
  cases <- lapply(seq_len(nrow(grid)), function(i) {
    row <- as.list(grid[i, , drop = FALSE])
    expected <- suppressWarnings(fun(row))
    args <- lapply(row, function(v) if (is.logical(v)) v else num2str(v))
    list(args = args, expected = num2str(expected))
  })
  out <- list(
    "function" = name,
    r_version = R.version.string,
    generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
    cases = cases
  )
  # One case per line, so that diffs after regeneration are readable line by line
  tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA)
  lines <- c(
    "{",
    sprintf('  "function": %s,', tj(name)),
    sprintf('  "r_version": %s,', tj(R.version.string)),
    sprintf('  "generated": %s,', tj(out$generated)),
    '  "cases": [',
    paste0("    ", vapply(cases, tj, character(1)),
           c(rep(",", length(cases) - 1), "")),
    "  ]",
    "}"
  )
  path <- file.path("/out", paste0(name, ".json"))
  writeLines(lines, path)
  cat(sprintf("%s: %d cases -> %s (%s)\n", name, length(cases), path, R.version.string))
}

# Cartesian product of parameter sets × first argument × lowerTail × logP
expand_cases <- function(x_name, x, params) {
  grids <- lapply(seq_len(nrow(params)), function(j) {
    g <- expand.grid(x = x, lowerTail = c(TRUE, FALSE), logP = c(FALSE, TRUE),
                     KEEP.OUT.ATTRS = FALSE, stringsAsFactors = FALSE)
    for (col in names(params)) g[[col]] <- params[[col]][j]
    g
  })
  g <- do.call(rbind, grids)
  names(g)[names(g) == "x"] <- x_name
  g
}

# Cross each row of a data.frame with the 4 combinations of lowerTail × logP
with_tails <- function(grid) {
  t <- expand.grid(lowerTail = c(TRUE, FALSE), logP = c(FALSE, TRUE),
                   KEEP.OUT.ATTRS = FALSE)
  g <- grid[rep(seq_len(nrow(grid)), each = nrow(t)), , drop = FALSE]
  cbind(g, t[rep(seq_len(nrow(t)), times = nrow(grid)), , drop = FALSE])
}

# Cross each row of a data.frame with log = FALSE / TRUE
with_log <- function(grid) {
  g <- grid[rep(seq_len(nrow(grid)), each = 2), , drop = FALSE]
  g$log <- rep(c(FALSE, TRUE), times = nrow(grid))
  g
}

# Cartesian product of named vectors (expand.grid without conversion to strings)
grid_of <- function(...) {
  g <- expand.grid(..., KEEP.OUT.ATTRS = FALSE, stringsAsFactors = FALSE)
  rownames(g) <- NULL
  g
}

# Inputs p for quantile functions (for logP = FALSE and TRUE)
P_GRID <- c(0, 1e-320, 1e-300, 1e-200, 1e-100, 1e-50, 1e-20, 1e-16, 1e-10, 1e-5,
            0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
            0.8, 0.9, 0.95, 0.975, 0.99, 0.999, 1 - 1e-10, 1 - 1e-15, 1,
            -0.1, 1.1, NaN)
LOGP_GRID <- c(-Inf, -1e10, -1e5, -3000, -1000, -745, -700, -100, -32, -10, -2,
               -1, -0.5, -0.1, -1e-5, -1e-10, -1e-300, 0, 0.5, NaN)

# For quantile functions: cross a parameter data.frame with the p grid and the tails
quantile_grid <- function(params) {
  lin <- merge(params, data.frame(p = P_GRID), by = NULL)
  lin <- merge(lin, data.frame(lowerTail = c(TRUE, FALSE)), by = NULL)
  lin$logP <- FALSE
  lg <- merge(params, data.frame(p = LOGP_GRID), by = NULL)
  lg <- merge(lg, data.frame(lowerTail = c(TRUE, FALSE)), by = NULL)
  lg$logP <- TRUE
  rbind(lin, lg)
}

# Rmpfr precision (bits)
MPFR_BITS <- 300
mp <- function(x) Rmpfr::mpfr(x, MPFR_BITS)

# High-precision regularized incomplete gamma function (lower P and upper Q).
# Q comes from mpfr's gamma_inc; P = 1 - Q is computed with 2000 bits to survive cancellation.
# The same (a, x) is reused for all 4 tail combinations, so results are memoised.
.igam_cache <- new.env()
ref_gammainc <- function(a, x, lower, log) {
  if (!(is.finite(a) && a > 0 && is.finite(x) && x > 0)) return(NA)
  # For x ≫ a mpfr's gamma_inc is extremely slow, so use the asymptotic series
  #   Q(a, x) = x^(a-1) e^-x / Gamma(a) Σ_k (a-1)(a-2)...(a-k) / x^k
  # instead (for x >= 10 a + 100 the terms shrink rapidly)
  if (is.finite(x) && x > 10 * a + 100) {
    bits <- 512
    A <- Rmpfr::mpfr(a, bits); X <- Rmpfr::mpfr(x, bits)
    term <- Rmpfr::mpfr(1, bits); s <- term
    for (k in 1:2000) {
      nxt <- term * (A - k) / X
      # The series is asymptotic, so stop once the terms start growing (the smallest term is small enough for x ≫ a)
      if (abs(asNumeric(nxt)) >= abs(asNumeric(term))) break
      term <- nxt
      s <- s + term
      if (abs(asNumeric(term)) < 2^-400 || asNumeric(term) == 0) break
    }
    q <- exp((A - 1) * log(X) - X - lgamma(A)) * s
    v <- if (lower) 1 - q else q
    if (!log) return(v)
    return(if (lower) log1p(-q) else log(q))
  }
  # mpfr's gamma_inc takes tens of seconds per case when a and x are large, so no reference value there
  if (a > 2e6 || x > 2e6) return(NA)
  key <- sprintf("%.17g_%.17g", a, x)
  pq <- .igam_cache[[key]]
  if (is.null(pq)) {
    A <- Rmpfr::mpfr(a, 2000)
    q <- Rmpfr::igamma(A, Rmpfr::mpfr(x, 2000)) / gamma(A)
    pq <- list(p = 1 - q, q = q)
    assign(key, pq, envir = .igam_cache)
  }
  v <- if (lower) pq$p else pq$q
  if (!log) return(v)
  # The log of the side close to 1 is built from the other side with log1p
  other <- if (lower) pq$q else pq$p
  if (asNumeric(other) < 0.5) log1p(-other) else log(v)
}

# High-precision regularized incomplete beta function.
# The smaller tail is computed directly by the positive-term series in its own frame (lower: (a, b, x), upper: (b, a, 1 - x))
#   I_z(p, q) = z^p (1-z)^q / (p B(p, q)) * Σ_n (p+q)_n / (p+1)_n z^n
# (all terms are positive, so no cancellation). The larger tail is 1 - (smaller tail).
# No reference value when too many terms are needed (large parameters near the mean).
.ibeta_cache <- new.env()
ibeta_series <- function(p, q, z, zc, bits) {
  P <- Rmpfr::mpfr(p, bits); Q <- Rmpfr::mpfr(q, bits)
  if (!isTRUE(as.logical(z < 1))) return(NULL)
  # Add the terms t_n = Π (p+q+k)/(p+1+k) z block by block until the last term is below 2^-bits times the sum
  s <- Rmpfr::mpfr(0, bits); last <- Rmpfr::mpfr(1, bits); n0 <- 0; B <- 5000
  repeat {
    n <- Rmpfr::mpfr(n0:(n0 + B - 1), bits)
    r <- z * (P + Q + n) / (P + 1 + n)
    terms <- last * cumprod(c(Rmpfr::mpfr(1, bits), r[-B]))
    s <- s + sum(terms)
    last <- terms[B] * r[B]
    n0 <- n0 + B
    # 2^-bits is 0 in double precision, so compare the ratio in log2
    if (asNumeric(r[B]) < 1 && asNumeric(log2(last / s)) < -bits) break
    if (n0 >= 5e4) return(NULL)
  }
  lpref <- P * log(z) + Q * log(zc) - (lgamma(P) + lgamma(Q) - lgamma(P + Q)) - log(P)
  exp(lpref) * s
}
ref_betainc <- function(a, b, x, lower, log, xc = NULL) {
  if (!(is.finite(a) && is.finite(b) && a > 0 && b > 0)) return(NA)
  bits <- 256
  X <- if (inherits(x, "mpfr")) x else Rmpfr::mpfr(x, bits)
  XC <- if (is.null(xc)) 1 - X else xc
  # Compare in mpfr (converting to double turns values like 1e-600 into 0)
  if (!isTRUE(as.logical(X > 0)) || !isTRUE(as.logical(XC > 0))) return(NA)
  key <- paste(format(c(a, b), digits = 17), format(X, digits = 30), collapse = "_")
  pq <- .ibeta_cache[[key]]
  if (is.null(pq)) {
    # Compute each tail directly in its own frame (positive-term series, so no cancellation even beyond the mean)
    lo <- ibeta_series(a, b, X, XC, bits)
    up <- ibeta_series(b, a, XC, X, bits)
    pq <- list(p = lo, q = up)
    assign(key, pq, envir = .ibeta_cache)
  }
  own <- if (lower) pq$p else pq$q
  other <- if (lower) pq$q else pq$p
  if (!is.null(own)) {
    if (!log) return(own)
    # The log of the side close to 1 is built from the other side with log1p
    if (!is.null(other) && asNumeric(other) < 0.5) return(log1p(-other))
    # No other side, and this side is close to 1: recompute with more precision so that log(1 - tiny) can be taken
    if (asNumeric(own) > 0.5) {
      own_hi <- if (lower) ibeta_series(a, b, X, XC, 6000) else ibeta_series(b, a, XC, X, 6000)
      if (!is.null(own_hi)) return(log(own_hi))
    }
    return(log(own))
  }
  # A side that could not be computed directly is 1 - (other side). Recompute with 1300 bits so small values keep their digits
  if (is.null(other)) return(NA)
  # 1 - other can be below 2^-1300, so choose the precision from the distance of other from 1
  hi_bits <- 1300
  probe <- if (lower) ibeta_series(b, a, XC, X, 1300) else ibeta_series(a, b, X, XC, 1300)
  if (!is.null(probe)) {
    d <- 1 - probe
    if (!isTRUE(as.logical(d > 0)) || asNumeric(log2(d)) < -1200) hi_bits <- 6000
  }
  # Pass x and 1 - x as mpfr (keeping their precision if it is higher)
  other <- if (lower) ibeta_series(b, a, XC, X, hi_bits) else ibeta_series(a, b, X, XC, hi_bits)
  if (is.null(other)) return(NA)
  if (log) log1p(-other) else 1 - other
}
