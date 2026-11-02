# Reference values of the noncentral t (issue #66, review_fix_log_issue66.md): log P[T <= t] (kind p) or log f(t)
# (kind d) by a log-sum-exp integral over w = log(chi^2_df / df) in 320-bit Rmpfr:
#   P = E[Phi(t S - delta)],  f = E[S phi(t S - delta)],  S = e^(w/2).
# The peak is found by ternary search over w in [-1500, 1450]. Blind spots: where the peak is narrower than the
# resolution of w (t >> sqrt(df) with a huge delta; use ntrefz.R) or stuck at an end of the search range. The second
# column of the output (the integrand at the ends of the window relative to the peak) must be far below 0, about
# -50 or less; otherwise the value is not valid.
#
# usage: node scripts/nt-reference/mkcases.mjs cases.txt < cases.json
#        Rscript scripts/nt-reference/ntref.R cases.txt out.txt
# Output lines: log value, end of the window relative to the peak, w at the peak, width. About 10 s per case.
# Validated against pt(1, 10, ncp 5), dt(1, 10, ncp 5) and pt(-2, 3, ncp 4) of rStats.js (all digits).
suppressMessages(library(Rmpfr))
prec <- 320
args <- commandArgs(trailingOnly = TRUE)
lines <- readLines(args[1])
two <- mpfr(2, prec)
num <- function(m, e) mpfr(m, prec) * two^as.integer(e)
lsq2pi <- log(sqrt(2 * Const("pi", prec)))
logPhi <- function(z) {
  out <- log(erfc(-z / sqrt(two)) / 2)
  idx <- which(as.numeric(z) < -30)
  if (length(idx)) {
    zi <- z[idx]; z2 <- zi * zi
    s <- mpfr(rep(1, length(idx)), prec); term <- s
    for (k in 1:40) { term <- -term * (2 * k - 1) / z2; s <- s + term }
    out[idx] <- -z2 / 2 - log(-zi) - lsq2pi + log(s)
  }
  out
}
res <- character(0)
for (ln in lines) {
  f <- strsplit(trimws(ln), " +")[[1]]
  kind <- f[1]
  t <- num(f[2], f[3]); df <- num(f[4], f[5]); delta <- num(f[6], f[7])
  a <- df / 2
  lg <- function(w) {
    w <- mpfr(w, prec)
    x <- df * exp(w)
    base <- a * log(x / 2) - x / 2 - lgamma(a)
    u <- t * exp(w / 2) - delta
    if (kind == "p") base + logPhi(u) else base + w / 2 - u * u / 2 - lsq2pi
  }
  # ternary search for the peak (unimodal), in mpfr
  lo <- -1500; hi <- 1450
  for (it in 1:200) {
    if (hi - lo < 1e-13 * max(1, abs(lo))) break
    m1 <- lo + (hi - lo) / 3; m2 <- hi - (hi - lo) / 3
    if (lg(m1) < lg(m2)) lo <- m1 else hi <- m2
  }
  w0 <- (lo + hi) / 2
  # width from the second difference (relative to the peak value, in mpfr)
  h <- 1e-6
  L0 <- lg(w0)
  repeat {
    d2 <- as.numeric((lg(w0 + h) - 2 * L0 + lg(w0 - h)) / h^2)
    if (is.finite(d2) && d2 < 0) break
    h <- h * 10
    if (h > 1) { d2 <- -1; break }
  }
  sig <- min(1 / sqrt(-d2), 5)
  step <- 0.02
  zs <- seq(-60, 60, by = step)
  lv <- lg(w0 + zs * sig)
  m <- max(lv)
  tot <- m + log(sum(exp(lv - m)) * step * sig)
  edge <- as.numeric(max(lv[1], lv[length(lv)]) - m)
  res <- c(res, paste(format(tot, digits = 25), sprintf("%.3g", edge), sprintf("%.6g", w0), sprintf("%.3g", sig)))
}
writeLines(res, args[2])
