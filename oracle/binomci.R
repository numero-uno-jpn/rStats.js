source("/oracle/_htest.R")

# Confidence intervals for one proportion: DescTools::BinomCI (fixture binomCI), the methods wilson, wilsoncc,
# clopper-pearson, wald, agresti-coull, jeffreys and midp, with all three `sides`.
# See oracle/contingency-behaviour.md. Field names are DescTools' (est, lwr.ci, upr.ci).
#
# Reference: DescTools finds the mid-p limits with uniroot()'s default tolerance (eps^0.25, absolute, on p), so they
# are off by up to about 1e-4 (and are 0 or far too wide when the limits are below 1e-4). The reference solves the same
# equations on the log scale of p to a relative 1e-13.

suppressPackageStartupMessages(library(DescTools))

set.seed(20261106)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
methods <- c("wilson", "wilsoncc", "clopper-pearson", "wald", "agresti-coull", "jeffreys", "midp")

xn <- list(c(0, 1), c(1, 1), c(0, 2), c(1, 2), c(2, 2), c(0, 5), c(1, 5), c(4, 5), c(0, 10), c(1, 10), c(3, 10),
           c(5, 10), c(9, 10), c(10, 10), c(2, 20), c(15, 30), c(37, 100), c(1, 100), c(99, 100), c(500, 1000),
           c(0, 1000), c(1, 1000), c(5, 1e5), c(49999, 1e5), c(5, 1e7), c(1e6, 1e7), c(1e7 - 3, 1e7))
for (i in 1:15) {
  n <- floor(10^runif(1, 0, 4))
  xn[[length(xn) + 1]] <- c(sample(0:n, 1), n)
}
for (m in methods) for (v in xn) add(x = v[1], n = v[2], method = m)
# conf.level and sides
for (m in methods) {
  for (v in list(c(0, 10), c(3, 10), c(10, 10), c(37, 100), c(1, 1000))) {
    for (s in c("left", "right")) add(x = v[1], n = v[2], method = m, sides = s)
    for (cl in c(0.5, 0.8, 0.9, 0.99, 0.999999, 1)) add(x = v[1], n = v[2], method = m, confLevel = cl)
    add(x = v[1], n = v[2], method = m, confLevel = 0.9, sides = "left")
    add(x = v[1], n = v[2], method = m, confLevel = 0.5, sides = "right")
    add(x = v[1], n = v[2], method = m, confLevel = 0.75, sides = "left")
  }
}
# Defaults (method wilson, sides two.sided, conf.level 0.95), abbreviations and inputs without a defined result
add(x = 3, n = 10)
add(x = 3, n = 10, method = "clopper")
add(x = 3, n = 10, method = "wil")                 # ambiguous: wilson, wilsoncc
add(x = 3, n = 10, method = "foo")
add(x = 3, n = 10, sides = "l")
add(x = 3, n = 10, sides = "two")
add(x = 3, n = 10, confLevel = 0.4)
add(x = 3, n = 10, confLevel = 1.1)
add(x = 3, n = 10, confLevel = NaN)
for (m in methods) {
  add(x = 11, n = 10, method = m)
  add(x = -1, n = 10, method = m)
  add(x = 2.5, n = 10, method = m)
  add(x = 0, n = 0, method = m)
  add(x = NaN, n = 10, method = m)
  add(x = 3, n = Inf, method = m)
}

# Mid-p limits solved to a relative 1e-13 (log scale of p)
midp_root <- function(f, lo, hi) {
  if (!(is.finite(lo) && is.finite(hi) && lo < hi)) return(NA_real_)
  fl <- f(lo); fh <- f(hi)
  if (!isTRUE(fl * fh < 0)) return(NA_real_)
  exp(uniroot(function(l) f(exp(l)), c(log(lo), log(hi)), tol = 1e-15, maxiter = 2000)$root)
}
binomci_ref <- function(a) {
  if (!identical(a$method, "midp")) return(NULL)
  x <- a$x; n <- a$n
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  sides <- if (is.null(a$sides)) "two.sided" else a$sides
  if (!(is.finite(x) && is.finite(n) && x >= 0 && x <= n && n > 0 && x == round(x))) return(NULL)
  if (sides != "two.sided") cl <- 1 - 2 * (1 - cl)
  alpha <- 1 - cl
  if (!(alpha > 0)) return(NULL)
  lower <- 0; upper <- 1
  # Both tail functions are monotone in p, so the whole of (0, 1) brackets the root; at x = 0 and x = n the
  # equations have closed forms
  if (x > 0) lower <- if (x == n) alpha^(1 / n) else
    midp_root(function(p) 0.5 * dbinom(x, n, p) + pbinom(x, n, p, lower.tail = FALSE) - alpha / 2, 1e-300, 1 - 1e-16)
  if (x < n) upper <- if (x == 0) -expm1(log(alpha) / n) else
    midp_root(function(p) 0.5 * dbinom(x, n, p) + pbinom(x - 1, n, p) - alpha / 2, 1e-300, 1 - 1e-16)
  if (sides == "left") upper <- 1
  if (sides == "right") lower <- 0
  list(lwr.ci = num2str(lower), upr.ci = num2str(upper))
}

write_htest_fixture("binomCI", cases, function(a) {
  args <- list(x = a$x, n = a$n, conf.level = a$confLevel, sides = a$sides, method = a$method)
  r <- call_with(BinomCI, args)
  list(est = num2str(r[1, "est"]), lwr.ci = num2str(r[1, "lwr.ci"]), upr.ci = num2str(r[1, "upr.ci"]))
}, binomci_ref, warnings = TRUE)
