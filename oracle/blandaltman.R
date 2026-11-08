# oracle-memory: 1g
source("/oracle/_htest.R")

# Bland-Altman analysis: BlandAltmanLeh::bland.altman.stats(group1, group2, two = 1.96, mode = 1, conf.int = 0.95)
# (fixture blandAltman). See oracle/methodcomparison-behaviour.md, section 1. Field names are the package's.
#
# Arguments: x (group1), y (group2), and where given two, mode, confInt (R's conf.int). Missing values in x or y are
# written as "NA" (the pair is dropped by the package).
# Expected: basedOn, means, diffs, lines (lower.limit, mean.diffs, upper.limit), CI.lines (lower.limit.ci.lower,
# lower.limit.ci.upper, mean.diff.ci.lower, mean.diff.ci.upper, upper.limit.ci.lower, upper.limit.ci.upper),
# critical.diff, two; warnings. Errors as {"error": message}.
#
# Reference (refKind):
#   "scaled"  the data were multiplied by a power of 2 at which R's sd() over- or underflows (or loses digits in the
#             subnormal range); reference = the results of the unscaled data times the same power of 2 (exact, since
#             every formula is homogeneous of degree 1 in the data).
# Every case also has "exact": the exact confidence limits of the two limits of agreement (Carkeet 2015, noncentral
# t; the alternative discussed in the behaviour file), computed for the case's two and conf.int, with names
# lower.limit.ci.lower, lower.limit.ci.upper, upper.limit.ci.lower, upper.limit.ci.upper. Not BlandAltmanLeh output.

suppressPackageStartupMessages(library(BlandAltmanLeh))

set.seed(20261109)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

# Bland and Altman (1986) peak expiratory flow data shipped with the package (17 subjects, first readings)
pefr <- BlandAltmanLeh::bland.altman.PEFR
w1 <- pefr$bigger.first; m1 <- pefr$smaller.first
x10 <- c(10.1, 12.3, 9.8, 15.2, 11.1, 13.4, 14.8, 9.9, 12.0, 16.3)
y10 <- c(10.6, 12.0, 10.4, 15.9, 11.0, 14.1, 15.3, 10.3, 12.9, 16.8)

add(x = w1, y = m1)
add(x = x10, y = y10)
for (two in c(1, 2, 2.576, 3)) add(x = x10, y = y10, two = two)
add(x = x10, y = y10, mode = 2)
for (ci in c(0, 0.5, 0.8, 0.9, 0.99, 0.999999, 1)) add(x = x10, y = y10, confInt = ci)
add(x = w1, y = m1, two = 2, mode = 2, confInt = 0.9)
# random data of several sizes
for (n in c(2, 3, 4, 5, 8, 30, 200)) {
  a <- round(rnorm(n, 50, 10), 2)
  add(x = a, y = round(a + rnorm(n, 1, 2), 2))
}
# boundaries: identical methods (sd 0), constant difference, two pairs, missing values, one pair
add(x = x10, y = x10)
add(x = x10, y = x10 + 0.5)
add(x = c(1, 2), y = c(1.5, 2.2))
add(x = c(x10, NA), y = c(y10, 3))
add(x = c(x10, 3), y = c(y10, NA))
add(x = c(NA, x10), y = c(NA, y10))
add(x = I(1), y = I(2))
add(x = c(1, NA), y = c(2, 3))
# argument checks
add(x = x10, y = y10[-1])
add(x = x10, y = y10, two = 0)
add(x = x10, y = y10, two = -1.96)
add(x = x10, y = y10, mode = 3)
add(x = x10, y = y10, confInt = 1.5)
add(x = x10, y = y10, confInt = -0.5)
# scaling by powers of two (R's sd over/underflows; refKind "scaled")
for (e in c(-1060, -540, -500, 500, 520, 1000, 1020)) add(x = x10 * 2^e, y = y10 * 2^e, scale = e)
add(x = w1 * 2^1015, y = m1 * 2^1015, scale = 1015)

call_ba <- function(a) {
  args <- list(group1 = a$x, group2 = a$y, two = a$two, mode = a$mode, conf.int = a$confInt)
  call_with(bland.altman.stats, args)
}

fields <- function(r) list(
  basedOn = num2str(r$based.on), means = I(num2str(r$means)), diffs = I(num2str(r$diffs)),
  lines = as.list(setNames(num2str(r$lines), names(r$lines))),
  CI.lines = as.list(setNames(num2str(r$CI.lines), names(r$CI.lines))),
  critical.diff = num2str(r$critical.diff), two = num2str(r$two))

# Exact limits for d + z s (one-sided tolerance factors, noncentral t; Carkeet 2015): the lower and upper
# confidence limits of the upper limit of agreement are dbar + s qt(p, n - 1, ncp = z sqrt(n)) / sqrt(n) with
# p = (1 - c)/2 and (1 + c)/2; those of the lower limit are the mirror images
exact_loa <- function(a) {
  two <- if (is.null(a$two)) 1.96 else a$two
  cl <- if (is.null(a$confInt)) 0.95 else a$confInt
  mode <- if (is.null(a$mode)) 1 else a$mode
  ok <- !(is.na(a$x) | is.na(a$y))
  if (sum(ok) < 2 || !(cl > 0 && cl < 1) || !(two > 0)) return(NULL)
  d <- if (mode == 1) a$x[ok] - a$y[ok] else a$y[ok] - a$x[ok]
  n <- length(d); m <- mean(d); s <- sd(d)
  if (!is.finite(s)) return(NULL)
  ql <- qt((1 - cl) / 2, n - 1, ncp = two * sqrt(n)) / sqrt(n)
  qu <- qt((1 + cl) / 2, n - 1, ncp = two * sqrt(n)) / sqrt(n)
  list(lower.limit.ci.lower = num2str(m - s * qu), lower.limit.ci.upper = num2str(m - s * ql),
       upper.limit.ci.lower = num2str(m + s * ql), upper.limit.ci.upper = num2str(m + s * qu))
}

write_htest_fixture("blandAltman", cases, function(a) {
  r <- call_ba(a)
  out <- fields(r)
  ex <- exact_loa(if (is.null(a$scale)) a else modifyList(a, list(x = a$x / 2^a$scale, y = a$y / 2^a$scale)))
  if (!is.null(ex)) {
    if (!is.null(a$scale)) ex <- lapply(ex, function(v) num2str(as.numeric(v) * 2^a$scale))
    out$exact <- ex
  }
  out
}, ref = function(a) {
  if (is.null(a$scale)) return(NULL)
  k <- 2^a$scale
  r <- call_ba(modifyList(a, list(x = a$x / k, y = a$y / k)))
  sc <- function(v) num2str(v * k)
  list(refKind = "scaled", means = I(sc(r$means)), diffs = I(sc(r$diffs)),
       lines = as.list(setNames(sc(r$lines), names(r$lines))),
       CI.lines = as.list(setNames(sc(r$CI.lines), names(r$CI.lines))), critical.diff = sc(r$critical.diff))
}, warnings = TRUE)
