# Shared pieces for noncentral reference values (Rmpfr). Sourced by oracle/nchisq.R, nbeta.R and nt.R.

# ---- Noncentral χ² ----
# Reference: sum the Poisson mixture with Rmpfr. With y = x/2, a = df/2, mu = ncp/2,
#   P[X <= x] = Σ_k d_k W_k,  P[X > x] = Q(a, y) + Σ_k d_k (1 - W_k)
#   d_k = y^(a+k) e^-y / Gamma(a+k+1),  W_k = Σ_{j<=k} Pois(j; mu)
# (obtained by substituting P(a+j, y) = Σ_{k>=j} d_k into Σ_j w_j P(a+j, y) and swapping the order of summation.
#  Both tails are sums of positive terms, so there is no cancellation).
# The summation range is found by estimating term sizes in double-precision logs, keeping terms within e^-230 of the largest.

NC_BITS <- 256
NC_MARGIN <- 230
# Widen the exponent range so that mpfr's exp does not underflow in deep tails (e^-1e10 etc.)
if (requireNamespace("Rmpfr", quietly = TRUE)) {
  Rmpfr::.mpfr_erange_set("Emin", -4e18)
  Rmpfr::.mpfr_erange_set("Emax", 4e18)
}

# Integer range within margin of the maximum for a unimodal log term f(k) (k can be evaluated as continuous).
# Even when the peak of the terms is far away (large x), only the terms near the peak need to be summed
nc_range <- function(f, kmax, margin = NC_MARGIN) {
  opt <- optimize(f, c(0, kmax), maximum = TRUE, tol = 1e-3)
  km <- opt$maximum; fm <- max(opt$objective, f(0), f(floor(km)), f(ceiling(km)))
  th <- fm - margin - 5
  lo <- if (f(0) >= th) 0 else floor(uniroot(function(k) f(k) - th, c(0, km))$root)
  hi <- if (f(kmax) >= th) kmax else ceiling(uniroot(function(k) f(k) - th, c(km, kmax))$root)
  c(lo, hi)
}

# Range (min and max index) of the log terms l within margin of the maximum
nc_window <- function(l, margin = NC_MARGIN) {
  fin <- is.finite(l)
  if (!any(fin)) return(NULL)
  ok <- which(fin & l >= max(l[fin]) - margin)
  c(min(ok), max(ok))
}

# mpfr vector of Pois(j; mu) (j is a double-precision integer vector)
nc_pois <- function(j, mu, bits = NC_BITS) {
  J <- Rmpfr::mpfr(j, bits); MU <- Rmpfr::mpfr(mu, bits)
  exp(J * log(MU) - MU - lgamma(J + 1))
}

# d_k = y^(a+k) e^-y / Gamma(a+k+1)
nc_dk <- function(k, a, y, bits = NC_BITS) {
  S <- Rmpfr::mpfr(a, bits) + k; Y <- Rmpfr::mpfr(y, bits)
  exp(S * log(Y) - Y - lgamma(S + 1))
}

# One tail (P[X <= x] if lower) as mpfr. NULL if it cannot be computed
nc_chisq_tail <- function(a, y, mu, lower) {
  big <- max(y, mu)
  K <- ceiling(big + 60 * sqrt(big + 1) + 3000)
  if (K > 1e15) return(NULL)
  # Log of the terms (k continuous): d_k and W_k (= ppois(k, mu), extended continuously via pgamma)
  f <- function(k) (a + k) * log(y) - y - lgamma(a + k + 1) +
    pgamma(mu, k + 1, lower.tail = !lower, log.p = TRUE)
  r <- nc_range(f, K)
  if (r[2] - r[1] > 2e6) return(NULL)
  ks <- r[1]:r[2]
  d <- nc_dk(ks, a, y)
  k1 <- min(ks); k2 <- max(ks)
  if (lower) {
    # W_k = Σ_{j<=k} w_j. Weights below k1 are summed from where they become negligible
    jA <- max(0, floor(min(k1, mu) - 40 * sqrt(mu) - 400))
    w <- nc_pois(jA:k2, mu)
    W <- cumsum(w)[(ks - jA) + 1]
    return(sum(d * W))
  }
  # 1 - W_k = Σ_{j>k} w_j. Weights above k2 are also summed up to where they become negligible
  jB <- ceiling(max(k2, mu) + 40 * sqrt(mu) + 400)
  w <- nc_pois((k1 + 1):jB, mu)
  S <- rev(cumsum(rev(w)))[(ks - k1) + 1]
  q0 <- if (a == 0) Rmpfr::mpfr(0, NC_BITS) else ref_gammainc(a, y, FALSE, FALSE)
  if (!inherits(q0, "mpfr") && is.na(q0)) return(NULL)
  q0 + sum(d * S)
}

ref_pnchisq <- function(q, df, ncp, lower, log) {
  if (!(is.finite(q) && q > 0 && is.finite(df) && df >= 0 && is.finite(ncp) && ncp >= 0)) return(NA)
  if (ncp == 0 && df > 0 && q > 1e6 * (df + 1)) {
    # Far right tail of the central χ²: Q(a, y) = y^(a-1) e^-y / Gamma(a) Σ_k (a-1)...(a-k) / y^k, kept in logs
    A <- Rmpfr::mpfr(df / 2, NC_BITS); Y <- Rmpfr::mpfr(q / 2, NC_BITS)
    term <- Rmpfr::mpfr(1, NC_BITS); sm <- term
    for (k in 1:30) { term <- term * (A - k) / Y; sm <- sm + term }
    lq <- (A - 1) * log(Y) - Y - lgamma(A) + log(sm)
    if (!lower) return(if (log) lq else exp(lq))
    return(if (log) log1p(-exp(lq)) else 1 - exp(lq))
  }
  if (ncp == 0) return(if (df > 0) ref_gammainc(df / 2, q / 2, lower, log) else NA)
  a <- df / 2; y <- q / 2; mu <- ncp / 2
  if (q * ncp > 1e30) {
    # Far right tail: P[X > x] = f(x) / s(x) (1 + O(x^-3/2)), s = -(log f)' = 1/2 - sqrt(λ/x)/2 - (k-3)/(4x)
    X <- Rmpfr::mpfr(q, NC_BITS)
    lq <- ref_dnchisq(q, df, ncp, TRUE) - log(0.5 - sqrt(Rmpfr::mpfr(ncp, NC_BITS) / X) / 2 - (df - 3) / (4 * X))
    if (!inherits(lq, "mpfr")) return(NA)
    if (!lower) return(if (log) lq else exp(lq))
    return(if (log) log1p(-exp(lq)) else 1 - exp(lq))
  }
  own <- nc_chisq_tail(a, y, mu, lower)
  if (is.null(own)) return(NA)
  if (!log) return(own)
  # The log of the side close to 1 is built from the other side with log1p
  if (asNumeric(own) > 0.5) {
    other <- nc_chisq_tail(a, y, mu, !lower)
    if (!is.null(other)) return(log1p(-other))
  }
  log(own)
}

ref_dnchisq <- function(x, df, ncp, log) {
  # At x = 0 with df = 2 the density is exp(-ncp/2) / 2
  if (identical(x, 0) && identical(df, 2) && is.finite(ncp) && ncp > 0) {
    v <- -Rmpfr::mpfr(ncp, NC_BITS) / 2 - log(Rmpfr::mpfr(2, NC_BITS))
    return(if (log) v else exp(v))
  }
  if (!(is.finite(x) && x > 0 && is.finite(df) && df >= 0 && is.finite(ncp) && ncp >= 0)) return(NA)
  a <- df / 2; y <- x / 2; mu <- ncp / 2
  if (ncp == 0) {
    if (a == 0) return(NA)
    A <- Rmpfr::mpfr(a, NC_BITS); Y <- Rmpfr::mpfr(y, NC_BITS)
    lv <- (A - 1) * log(Y) - Y - lgamma(A) - log(Rmpfr::mpfr(2, NC_BITS))
    return(if (log) lv else exp(lv))
  }
  # Very large x ncp: f(x) = exp(-(x+λ)/2) (x/λ)^(ν/2) I_ν(sqrt(λ x)) / 2 (ν = df/2 - 1), combined with
  # the large-z asymptotic expansion I_ν(z) ~ e^z / sqrt(2 pi z) Σ (-1)^k a_k(ν) / z^k (z > 1e15, so a few terms suffice)
  if (x * ncp > 1e30) {
    X <- Rmpfr::mpfr(x, NC_BITS); L <- Rmpfr::mpfr(ncp, NC_BITS); NU <- Rmpfr::mpfr(df, NC_BITS) / 2 - 1
    Z <- sqrt(L * X)
    term <- Rmpfr::mpfr(1, NC_BITS); sm <- term
    for (k in 1:40) {
      term <- -term * (4 * NU^2 - (2 * k - 1)^2) / (8 * k * Z)
      sm <- sm + term
    }
    lv <- -log(Rmpfr::mpfr(2, NC_BITS)) - (sqrt(X) - sqrt(L))^2 / 2 + NU / 2 * log(X / L) -
      log(2 * Const("pi", NC_BITS) * Z) / 2 + log(sm)
    return(if (log) lv else exp(lv))
  }
  big <- max(y, mu)
  J <- ceiling(big + 60 * sqrt(big + 1) + 3000)
  if (J > 1e15) return(NA)
  f <- function(j) -mu + j * log(mu) - lgamma(j + 1) + (a + j - 1) * log(y) - y - lgamma(a + j)
  r <- nc_range(f, J)
  if (r[2] - r[1] > 2e6) return(NA)
  js <- r[1]:r[2]
  js <- js[a + js > 0]
  S <- Rmpfr::mpfr(a, NC_BITS) + js; Y <- Rmpfr::mpfr(y, NC_BITS)
  v <- sum(nc_pois(js, mu) * exp((S - 1) * log(Y) - Y - lgamma(S))) / 2
  if (log) log(v) else v
}


# ---- Noncentral beta ----
# Substituting I_x(a+j, b) = Σ_{k>=j} e_k,  e_k = Gamma(a+b+k) / (Gamma(a+k+1) Gamma(b)) x^(a+k) (1-x)^b
# and swapping the order of summation gives
#   P[X <= x] = Σ_k e_k W_k,  P[X > x] = (1 - I_x(a, b)) + Σ_k e_k (1 - W_k)
# When x is close to 1, e_k decays slowly and the lower sum needs too many terms, so 1 - (upper) is used instead.
# lx, lxc are log x and log(1 - x) (mpfr); X, XC are x and 1 - x (mpfr, for the central-distribution reference).

nc_ek <- function(k, a, b, lx, lxc, bits = NC_BITS) {
  A <- Rmpfr::mpfr(a, bits); B <- Rmpfr::mpfr(b, bits)
  exp(lgamma(A + B + k) - lgamma(A + k + 1) - lgamma(B) + (A + k) * lx + B * lxc)
}

# One tail. NULL if it cannot be computed
nc_beta_tail <- function(a, b, mu, lx, lxc, X, XC, lower) {
  dlx <- asNumeric(lx); dlxc <- asNumeric(lxc)
  K <- mu + 60 * sqrt(mu + 1) + 3000
  if (lower) {
    # Peak of e_k (where the ratio x (a+b+k-1)/(a+k) is 1) and the number of terms until it decays by e^-300
    x <- exp(dlx)
    kpk <- max(0, ((b - 1) * x - a * (1 - x)) / max(-expm1(dlx), 1e-300))
    K <- K + kpk + 300 / max(-dlx, 1e-300)
    if (K > 1e7) return(NULL)
  }
  # For large b, the peak of the upper terms e_k (1 - W_k) moves out to k ≈ sqrt(mu b x)
  K <- ceiling(K + 2 * sqrt(mu * (a + b)) + 60 * (mu * (a + b))^0.25)
  f <- function(k) lgamma(a + b + k) - lgamma(a + k + 1) - lgamma(b) + (a + k) * dlx + b * dlxc +
    pgamma(mu, k + 1, lower.tail = !lower, log.p = TRUE)
  r <- nc_range(f, K)
  if (r[2] - r[1] > 2e6) return(NULL)
  ks <- r[1]:r[2]
  e <- nc_ek(ks, a, b, lx, lxc)
  k1 <- min(ks); k2 <- max(ks)
  if (lower) {
    jA <- max(0, floor(min(k1, mu) - 40 * sqrt(mu) - 400))
    W <- cumsum(nc_pois(jA:k2, mu))[(ks - jA) + 1]
    return(sum(e * W))
  }
  jB <- ceiling(max(k2, mu) + 40 * sqrt(mu) + 400)
  S <- rev(cumsum(rev(nc_pois((k1 + 1):jB, mu))))[(ks - k1) + 1]
  # 1 - I_x(a, b) = I_{1-x}(b, a). Try the series directly first, otherwise fall back to ref_betainc
  j0 <- ibeta_series(b, a, XC, X, NC_BITS)
  if (is.null(j0)) j0 <- ref_betainc(a, b, X, FALSE, FALSE, xc = XC)
  if (!inherits(j0, "mpfr")) return(NULL)
  j0 + sum(e * S)
}

ref_pnbeta_core <- function(a, b, ncp, X, XC, lower, log) {
  if (!(is.finite(a) && a > 0 && is.finite(b) && b > 0 && is.finite(ncp) && ncp >= 0)) return(NA)
  if (ncp == 0) return(ref_betainc(a, b, X, lower, log, xc = XC))
  mu <- ncp / 2
  lx <- Rmpfr::roundMpfr(log(X), 320); lxc <- Rmpfr::roundMpfr(log(XC), 320)
  tail <- function(lw) {
    v <- nc_beta_tail(a, b, mu, lx, lxc, X, XC, lw)
    if (is.null(v) && lw) {
      # The lower tail cannot be summed directly: 1 - (upper)
      up <- nc_beta_tail(a, b, mu, lx, lxc, X, XC, FALSE)
      if (is.null(up)) return(NULL)
      v <- 1 - up
      if (asNumeric(v) < 1e-60) return(NULL)
    }
    v
  }
  own <- tail(lower)
  if (is.null(own)) return(NA)
  if (!log) return(own)
  if (asNumeric(own) > 0.5) {
    other <- tail(!lower)
    if (!is.null(other)) return(log1p(-other))
  }
  log(own)
}

ref_pnbeta <- function(q, a, b, ncp, lower, log) {
  if (!(is.finite(q) && q > 0 && q < 1)) return(NA)
  X <- Rmpfr::mpfr(q, 320)
  ref_pnbeta_core(a, b, ncp, X, 1 - X, lower, log)
}

# Density of the mixture Σ_j w_j Beta(a + j, b) (at x)
ref_dnbeta_core <- function(a, b, ncp, lx, lxc) {
  mu <- ncp / 2
  if (ncp == 0) {
    A <- Rmpfr::mpfr(a, NC_BITS); B <- Rmpfr::mpfr(b, NC_BITS)
    return(exp(lgamma(A + B) - lgamma(A) - lgamma(B) + (A - 1) * lx + (B - 1) * lxc))
  }
  dlx <- asNumeric(lx); dlxc <- asNumeric(lxc)
  # The peak of the terms moves out to about j ≈ sqrt(mu (a + b) x) (when b is large)
  J <- ceiling(mu + 60 * sqrt(mu + 1) + 3000 + 2 * sqrt(mu * (a + b)) + 60 * (mu * (a + b))^0.25)
  f <- function(j) -mu + j * log(mu) - lgamma(j + 1) + lgamma(a + b + j) - lgamma(a + j) - lgamma(b) +
    (a + j - 1) * dlx + (b - 1) * dlxc
  r <- nc_range(f, J)
  if (r[2] - r[1] > 2e6) return(NULL)
  js <- r[1]:r[2]
  A <- Rmpfr::mpfr(a, NC_BITS); B <- Rmpfr::mpfr(b, NC_BITS)
  sum(nc_pois(js, mu) * exp(lgamma(A + B + js) - lgamma(A + js) - lgamma(B) + (A + js - 1) * lx + (B - 1) * lxc))
}

ref_dnbeta <- function(x, a, b, ncp, log) {
  # Finite values at the end points: x = 1, b = 1 gives a + ncp/2; x = 0, a = 1 gives b exp(-ncp/2)
  if (is.finite(ncp) && ncp >= 0 && is.finite(a) && is.finite(b)) {
    v <- NULL
    if (identical(x, 1) && b == 1) v <- Rmpfr::mpfr(a, NC_BITS) + Rmpfr::mpfr(ncp, NC_BITS) / 2
    if (identical(x, 0) && a == 1) v <- Rmpfr::mpfr(b, NC_BITS) * exp(-Rmpfr::mpfr(ncp, NC_BITS) / 2)
    if (!is.null(v)) return(if (log) log(v) else v)
  }
  if (!(is.finite(x) && x > 0 && x < 1 && is.finite(a) && a > 0 && is.finite(b) && b > 0 &&
        is.finite(ncp) && ncp >= 0)) return(NA)
  X <- Rmpfr::mpfr(x, 320)
  v <- ref_dnbeta_core(a, b, ncp, Rmpfr::roundMpfr(log(X), 320), Rmpfr::roundMpfr(log(1 - X), 320))
  if (is.null(v)) return(NA)
  if (log) log(v) else v
}

# ---- Noncentral F: x = m q / (n + m q) is noncentral beta (m/2, n/2) ----
nc_fpair <- function(q, m, n) {
  M <- Rmpfr::mpfr(m, 320); N <- Rmpfr::mpfr(n, 320); Q <- Rmpfr::mpfr(q, 320)
  list(X = M * Q / (N + M * Q), XC = N / (N + M * Q))
}

ref_pnf <- function(q, m, n, ncp, lower, log) {
  if (!(is.finite(q) && q > 0 && is.finite(m) && m > 0 && n > 0 && is.finite(ncp) && ncp >= 0)) return(NA)
  # df2 = Inf: F = χ²_m(ncp) / m (x m is a double-precision product, rounded as in the implementation)
  if (n == Inf) return(ref_pnchisq(q * m, m, ncp, lower, log))
  pr <- nc_fpair(q, m, n)
  ref_pnbeta_core(m / 2, n / 2, ncp, pr$X, pr$XC, lower, log)
}

ref_dnf <- function(x, m, n, ncp, log) {
  # x = 0 with df1 = 2 gives exp(-ncp/2)
  if (identical(x, 0) && identical(m, 2) && n > 0 && is.finite(ncp) && ncp >= 0) {
    v <- -Rmpfr::mpfr(ncp, NC_BITS) / 2
    return(if (log) v else exp(v))
  }
  if (!(is.finite(x) && x > 0 && is.finite(m) && m > 0 && n > 0 && is.finite(ncp) && ncp >= 0)) return(NA)
  if (n == Inf) {
    lv <- ref_dnchisq(x * m, m, ncp, TRUE)
    if (!inherits(lv, "mpfr")) return(NA)
    lv <- lv + log(Rmpfr::mpfr(m, NC_BITS))
    return(if (log) lv else exp(lv))
  }
  pr <- nc_fpair(x, m, n)
  lx <- Rmpfr::roundMpfr(log(pr$X), 320); lxc <- Rmpfr::roundMpfr(log(pr$XC), 320)
  s <- ref_dnbeta_core(m / 2, n / 2, ncp, lx, lxc)
  if (is.null(s)) return(NA)
  # f_F(q) = f_beta(x) x (1 - x) / q
  v <- s * exp(lx + lxc) / Rmpfr::mpfr(x, NC_BITS)
  if (log) log(v) else v
}

# ---- Noncentral t ----
# Lenth (1989) series (x = t^2/(ν + t^2), b = ν/2, μ = δ^2/2, t >= 0)
#   P[T <= t] = Φ(-δ) + (1/2) Σ_j [p_j I_x(j + 1/2, b) + q_j I_x(j + 1, b)]
#   p_j = e^-μ μ^j / j!,  q_j = δ e^-μ μ^j / (sqrt(2) Gamma(j + 3/2))
# computed as the upper tail P[T > t] = (1/2) Σ_j [p_j (1 - I_x(j+1/2, b)) + q_j (1 - I_x(j+1, b))].
# 1 - I_x(c + j, b) = (1 - I_x(c, b)) + Σ_{k<j} e_k (e_k = Gamma(c+b+k)/(Gamma(c+k+1) Gamma(b)) x^(c+k) (1-x)^b)
# Substituting this bounds the terms by the weight tails Σ_{j>k}, so the number of terms does not depend on x.
# For δ < 0, q_j < 0 and the terms cancel, so the precision (bits) is raised to match the size of the answer and the sum recomputed.
# t < 0 is mapped to the upper tail via P[T <= t; δ] = P[T > -t; -δ]. The lower tail is 1 - (upper) (with enough precision).

nc_t_upper <- function(tp, dp, nu, bits) {
  T2 <- Rmpfr::mpfr(tp, bits)^2; NU <- Rmpfr::mpfr(nu, bits)
  X <- T2 / (NU + T2); XC <- NU / (NU + T2)
  B <- NU / 2; D <- Rmpfr::mpfr(dp, bits); MU <- D * D / 2
  mu <- dp * dp / 2
  J <- ceiling(mu + 60 * sqrt(mu) + 600 + bits / 4)
  j <- 1:J
  p <- cumprod(c(exp(-MU), MU / Rmpfr::mpfr(j, bits)))
  q <- cumprod(c(D * exp(-MU) * sqrt(2 / Const("pi", bits)), MU / (Rmpfr::mpfr(j, bits) + 0.5)))
  # Tail sums Σ_{j>k} (k = 0..J)
  tail_of <- function(v) { r <- rev(cumsum(rev(v))); c(r[-1], Rmpfr::mpfr(0, bits)) }
  Tp <- tail_of(p); Tq <- tail_of(q)
  ek <- function(cc) {
    C <- Rmpfr::mpfr(cc, bits)
    e0 <- exp(lgamma(C + B) - lgamma(C + 1) - lgamma(B) + C * log(X) + B * log(XC))
    cumprod(c(e0, X * (C + B + j - 1) / (C + j)))
  }
  # 1 - I_x(1/2, b) = I_{1-x}(b, 1/2), 1 - I_x(1, b) = (1 - x)^b
  J0 <- ibeta_series(nu / 2, 0.5, XC, X, bits)
  if (is.null(J0)) return(NULL)
  J1 <- XC^B
  terms <- c(J0 * sum(p), sum(ek(0.5) * Tp), J1 * sum(q), sum(ek(1) * Tq))
  v <- sum(terms) / 2
  list(v = v, scale = max(abs(asNumeric(terms))))
}

# One tail (precision raised to cover cancellation). P[T <= t] if lower
# The series is reused for the 4 combinations (tail × log) of the same (t, δ, ν), so the upper value is memoised
.nct_cache <- new.env()
nc_t_tail <- function(t, delta, nu, lower) {
  # Bring into the form P[T > t'; δ'] (t' >= 0)
  up <- (t >= 0) != lower # can be computed as an upper tail
  tp <- abs(t); dp <- if (t >= 0) delta else -delta
  key <- sprintf("%.17g_%.17g_%.17g", tp, dp, nu)
  hit <- .nct_cache[[key]]
  bits <- if (is.null(hit)) 320 else hit$bits
  for (iter in 1:7) {
    r <- if (!is.null(hit) && hit$bits == bits) hit$r else nc_t_upper(tp, dp, nu, bits)
    if (is.null(r)) return(NULL)
    assign(key, list(bits = bits, r = r), envir = .nct_cache)
    hit <- .nct_cache[[key]]
    v <- if (up) r$v else 1 - r$v
    # Estimate the bits lost to cancellation and retry with more precision if not enough remain
    lv <- asNumeric(log2(abs(v)))
    loss <- log2(max(r$scale, 1)) - lv
    if (is.finite(lv) && loss < bits - 200) return(v)
    # If the answer is buried at the precision floor, loss looks like about bits, so at least double it
    if (bits >= 20000) return(NULL)
    bits <- ceiling(min(20000, max(2 * bits, (if (is.finite(loss)) loss else 4000) + 400)))
  }
  NULL
}

ref_pnt <- function(t, nu, delta, lower, log) {
  if (!(is.finite(t) && is.finite(nu) && nu > 0 && is.finite(delta))) return(NA)
  if (t == 0) {
    v <- Rmpfr::pnorm(Rmpfr::mpfr(-delta, NC_BITS), lower.tail = lower)
    return(if (log) log(v) else v)
  }
  own <- nc_t_tail(t, delta, nu, lower)
  if (is.null(own)) {
    # The series cannot be computed because of cancellation: use the integral representation (smaller tail directly)
    lv <- tryCatch(if (lower) nc_t_integral(t, nu, delta, "cdf") else nc_t_integral(-t, nu, -delta, "cdf"),
                   error = function(e) NULL)
    if (is.null(lv)) return(NA)
    if (asNumeric(lv) > log(0.5)) return(NA)
    return(if (log) lv else exp(lv))
  }
  if (is.null(own)) return(NA)
  if (!log) return(own)
  if (asNumeric(own) > 0.5) {
    other <- nc_t_tail(t, delta, nu, !lower)
    if (!is.null(other)) return(log1p(-other))
  }
  log(own)
}

# Density: f(t) = E[S φ(t S - δ)] (S = sqrt(χ²_ν/ν)) as the series obtained by expanding e^(B s) (B = t δ) and integrating term by term
#   f(t) = C e^(-δ²/2) Σ_k B^k / k! (1/2) (2/A)^((ν+k+1)/2) Gamma((ν+k+1)/2)
#   A = t² + ν,  C = 2 (ν/2)^(ν/2) / (Gamma(ν/2) sqrt(2 pi))
# For B < 0 (t and δ of opposite sign) the terms alternate in sign, so the sum is recomputed with more precision.
ref_dnt <- function(x, nu, delta, log) {
  if (!(is.finite(x) && is.finite(nu) && nu > 0 && is.finite(delta))) return(NA)
  bits <- 320
  # Terms are of size about (|B| sqrt(2/A))^k / Gamma(k/2 + 1), peaking at k ≈ 2 B²/A
  y <- 2 * (x * delta)^2 / (x * x + nu)
  K <- ceiling(y + 60 * sqrt(y) + 600)
  for (iter in 1:6) {
    X <- Rmpfr::mpfr(x, bits); NU <- Rmpfr::mpfr(nu, bits); D <- Rmpfr::mpfr(delta, bits)
    A <- X * X + NU; B <- X * D
    k <- 0:K
    K2 <- Rmpfr::mpfr(k, bits)
    # log |term| (only the k = 0 term if B = 0)
    lt <- lgamma((NU + K2 + 1) / 2) + (NU + K2 + 1) / 2 * log(2 / A) - lgamma(K2 + 1) - log(Rmpfr::mpfr(2, bits))
    if (asNumeric(B) != 0) lt <- lt + K2 * log(abs(B)) else lt <- lt[1]
    sg <- if (asNumeric(B) < 0) (-1)^k[seq_along(lt)] else rep(1, length(lt))
    m <- max(asNumeric(lt))
    terms <- sg * exp(lt - m)
    s <- sum(terms)
    loss <- -asNumeric(log2(abs(s)))
    if (is.finite(loss) && loss < bits - 200) {
      lc <- log(Rmpfr::mpfr(2, bits)) + NU / 2 * log(NU / 2) - lgamma(NU / 2) - log(2 * Const("pi", bits)) / 2 - D * D / 2
      lv <- lc + m + log(s)
      return(if (log) lv else exp(lv))
    }
    if (bits >= 20000) return(NA)
    bits <- ceiling(min(20000, max(2 * bits, (if (is.finite(loss)) loss else 4000) + 400)))
  }
  NA
}

# Noncentral t reference via the integral representation (fallback when cancellation in the series is too severe).
#   P[T <= t] = E[Φ(t S - δ)],  f(t) = E[S φ(t S - δ)],  S = sqrt(χ²_ν/ν)
# The integrand is positive, so there is no cancellation. Romberg integration around the peak (within 60 of the maximum in log).
nc_t_integral <- function(t, nu, delta, kind, bits = 120) {
  a <- nu / 2
  lfS <- function(s) log(2) + a * log(a) + (2 * a - 1) * log(s) - a * s * s - lgamma(a)
  lg <- function(s) lfS(s) + if (kind == "cdf") pnorm(t * s - delta, log.p = TRUE) else
    log(s) + dnorm(t * s - delta, log = TRUE)
  hi0 <- 10 + 10 * sqrt(1 / a) + abs(delta / t) * 4 + 50
  opt <- optimize(lg, c(1e-300, hi0), maximum = TRUE, tol = 1e-12)
  sp <- opt$maximum; m <- opt$objective
  th <- m - 60
  lo <- if (lg(1e-300) > th) 0 else uniroot(function(s) lg(s) - th, c(1e-300, sp))$root
  hi <- uniroot(function(s) lg(s) - th, c(sp, hi0 * 10), extendInt = "downX")$root
  M <- Rmpfr::mpfr(m, bits)
  A <- Rmpfr::mpfr(a, bits); TT <- Rmpfr::mpfr(t, bits); D <- Rmpfr::mpfr(delta, bits)
  lc <- log(Rmpfr::mpfr(2, bits)) + A * log(A) - lgamma(A)
  g <- function(s) {
    S <- Rmpfr::mpfr(s, bits)
    z <- TT * S - D
    l <- lc + (2 * A - 1) * log(S) - A * S * S - M
    if (kind == "cdf") exp(l) * pnorm(z) else exp(l + log(S) - z * z / 2) / sqrt(2 * Const("pi", bits))
  }
  I <- Rmpfr::integrateR(g, lo, hi, rel.tol = 1e-18, max.ord = 18, verbose = FALSE)$value
  M + log(I)
}
