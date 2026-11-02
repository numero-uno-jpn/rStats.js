# Reference values of the noncentral t for t > 0, delta > 0 (issue #66, review_fix_log_issue66.md), by a log-sum-exp
# integral over z = Z in 320-bit Rmpfr (formula B):
#   P[T <= t] = Phi(-delta) + int phi(z) Q(a, a ((delta + z)/t)^2) dz,
#   f(t) = 2/(t Gamma(a)) int phi(z) x^a e^(-x) dz,  x = a ((delta + z)/t)^2,  a = df/2.
# Suited to t >> sqrt(df), where the peak over w (ntref.R) is too narrow. log Q comes from its asymptotic series
# beyond x = 1e6 (a + 1) and from igamma otherwise. As in ntref.R, the second output column must be far below 0.
#
# usage: node scripts/nt-reference/mkcases.mjs cases.txt < cases.json
#        Rscript scripts/nt-reference/ntrefz.R cases.txt out.txt
suppressMessages(library(Rmpfr))
prec <- 320
args <- commandArgs(trailingOnly = TRUE)
lines <- readLines(args[1])
two <- mpfr(2, prec)
num <- function(m, e) mpfr(m, prec) * two^as.integer(e)
lsq2pi <- log(sqrt(2 * Const("pi", prec)))
logPhiNeg <- function(z) { # z < -30
  z2 <- z * z; s <- mpfr(1, prec); term <- s
  for (k in 1:40) { term <- -term * (2 * k - 1) / z2; s <- s + term }
  -z2 / 2 - log(-z) - lsq2pi + log(s)
}
logQ <- function(a, x) {
  out <- x
  big <- as.numeric(x) > 1e6 * (as.numeric(a) + 1)
  if (any(big)) {
    xb <- x[big]; s <- mpfr(rep(1, length(xb)), prec); term <- s
    for (k in 1:30) { term <- term * (a - k) / xb; s <- s + term }
    out[big] <- -xb + (a - 1) * log(xb) - lgamma(a) + log(s)
  }
  if (any(!big)) out[!big] <- log(igamma(a, x[!big]) / gamma(a))
  out
}
res <- character(0)
for (ln in lines) {
  f <- strsplit(trimws(ln), " +")[[1]]
  kind <- f[1]
  t <- num(f[2], f[3]); df <- num(f[4], f[5]); d <- num(f[6], f[7])
  a <- df / 2
  lg <- function(z) {
    z <- mpfr(z, prec)
    x <- a * ((d + z) / t)^2
    g <- if (kind == "p") logQ(a, x) else a * log(x) - x
    -z * z / 2 - lsq2pi + g
  }
  c0 <- as.numeric(2 * a * d / t^2)
  lo <- -min(as.numeric(d) * 0.999, abs(c0) * 2 + 60); hi <- 60
  for (it in 1:300) {
    if (hi - lo < 1e-12) break
    m1 <- lo + (hi - lo) / 3; m2 <- hi - (hi - lo) / 3
    if (lg(m1) < lg(m2)) lo <- m1 else hi <- m2
  }
  z0 <- (lo + hi) / 2
  step <- 0.01
  zs <- z0 + seq(-40, 40, by = step)
  lv <- lg(zs)
  m <- max(lv)
  logI <- m + log(sum(exp(lv - m)) * step)
  edge <- as.numeric(max(lv[1], lv[length(lv)]) - m)
  if (kind == "p") {
    lp <- logPhiNeg(-d)
    tot <- if (lp > logI) lp + log1p(exp(logI - lp)) else logI + log1p(exp(lp - logI))
  } else tot <- logI + log(two) - lgamma(a) - log(t)
  res <- c(res, paste(format(tot, digits = 25), sprintf("%.3g", edge), sprintf("%.6g", as.numeric(z0)), "1"))
}
writeLines(res, args[2])
