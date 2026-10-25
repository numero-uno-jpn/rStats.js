# oracle-memory: 3584m
# (the gmp references need more than 3 GB, nearly all of the 4 GB Docker VM: run it only when nothing else runs)
source("/oracle/_htest.R")

# fisher.test (2×2: p-value, conditional MLE of the odds ratio, confidence interval; r×c: exact p-value).
# hybrid and simulate.p.value are out of scope

set.seed(20261022)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

# ---- 2×2 ----
m2 <- function(a, b, c, d) matrix(c(a, c, b, d), 2)  # rows are a b / c d
tabs2 <- list(
  m2(3, 1, 1, 3),                 # Fisher's tea tasting
  m2(2, 15, 10, 3),               # convictions of twins
  m2(1, 2, 3, 4),
  m2(10, 3, 2, 15),
  m2(0, 5, 3, 4),                 # zero cell (estimate 0)
  m2(5, 0, 3, 4),                 # estimate Inf
  m2(0, 3, 4, 0),
  m2(0, 0, 3, 4),                 # zero row
  m2(0, 3, 0, 4),                 # zero column
  m2(0, 0, 0, 0),
  m2(0, 0, 0, 1),
  m2(1, 0, 0, 0),
  m2(1, 1, 1, 1),
  m2(7, 7, 7, 7),
  m2(20, 25, 30, 35),
  m2(50, 20, 10, 60),
  m2(100, 1, 1, 100),             # deep-tail p-value
  m2(500, 300, 300, 500),
  m2(1000, 2000, 3000, 4000),
  m2(5000, 4900, 4900, 5000),
  m2(1, 50, 60, 2),
  m2(0, 200, 150, 1),
  m2(1e5, 3e5, 2e5, 4e5)          # p-value underflows to 0
)
for (i in 1:6) tabs2[[length(tabs2) + 1]] <- matrix(rpois(4, c(2, 5, 20, 80)[i %% 4 + 1]), 2)
alts <- c("two.sided", "less", "greater")
for (x in tabs2) {
  for (alt in alts) {
    add(x = x, alternative = alt)
    add(x = x, alternative = alt, or = 2.5)
    add(x = x, alternative = alt, or = 0.3, confLevel = 0.99)
  }
  for (cl in c(0.5, 0.9, 0.999999)) add(x = x, confLevel = cl)
  add(x = x, confInt = FALSE)
  add(x = x, or = 0)
  add(x = x, or = Inf)
  add(x = x, or = 0, alternative = "less")
  add(x = x, or = Inf, alternative = "greater")
}
# Threshold at which tables count as "equally probable" for the two-sided p-value (1 + 1e-7 times the observed probability).
# or is chosen so that P(x + 1) = (1 + delta) P(x) (x = 3, column sums 7 and 11, first row sum 8)
x <- m2(3, 5, 4, 6)
r0 <- (7 - 3) * (8 - 3) / ((3 + 1) * (11 - 8 + 3 + 1))
for (delta in c(-1e-6, 0.99e-7, 1.01e-7, 1e-6)) add(x = x, or = (1 + delta) / r0)
# Non-integer counts (R warns and rounds half to even)
add(x = m2(3.4, 1, 1, 3))
add(x = m2(3.5, 1, 1, 3))
add(x = m2(2.5, 1, 1, 3))
add(x = m2(3 + 1e-9, 1, 1, 3))
# Inputs that raise errors
add(x = m2(-1, 1, 1, 3))
add(x = m2(NaN, 1, 1, 3))
add(x = m2(NA, 1, 1, 3))
add(x = m2(Inf, 1, 1, 3))
add(x = m2(3, 1, 1, 3), or = -1)
add(x = m2(3, 1, 1, 3), or = NaN)
add(x = m2(3, 1, 1, 3), confLevel = 0)
add(x = m2(3, 1, 1, 3), confLevel = 1)
add(x = m2(3, 1, 1, 3), confLevel = 1.1)
add(x = m2(3, 1, 1, 3), confLevel = 2, confInt = FALSE)
add(x = m2(3, 1, 1, 3), alternative = "foo")
add(x = m2(3, 1, 1, 3), alternative = "g")
add(x = matrix(c(1, 2, 3), 1))
add(x = matrix(c(1, 2, 3), 3))

# ---- r×c ----
tabs <- list(
  matrix(c(1, 2, 5, 3, 4, 6), 2, byrow = TRUE),
  matrix(c(3, 5, 2, 6, 4, 1, 7, 3, 2, 8, 3, 1, 6, 2, 4, 5), 4, byrow = TRUE),
  matrix(c(5, 8, 3, 9, 7, 2, 4, 6, 8, 3, 5, 7, 2, 9, 4), 3, byrow = TRUE),
  matrix(c(25, 30, 22, 28, 35, 40), 2, byrow = TRUE),
  matrix(c(2, 3, 1, 4, 2, 5, 3, 1, 2, 4, 3, 2, 1, 5, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4), 4, byrow = TRUE),
  matrix(c(1, 2, 3, 2, 1, 3, 3, 3, 1), 3),          # many equally probable tables (symmetric)
  matrix(c(2, 2, 2, 2, 2, 2, 2, 2, 2), 3),
  matrix(c(10, 0, 0, 0, 10, 0, 0, 0, 10), 3),       # deep-tail p-value
  matrix(c(20, 0, 0, 0, 20, 0, 0, 0, 20), 3),
  matrix(c(40, 1, 0, 2, 35, 1, 0, 3, 30), 3),
  matrix(c(0, 0, 5, 7, 0, 3), 2),
  matrix(c(1, 2, 0, 3, 4, 0), 2, byrow = TRUE),     # zero column → 2×2 but treated as r×c
  matrix(c(1, 2, 3, 0, 0, 0), 2, byrow = TRUE),     # zero row → 1 row
  matrix(c(1, 2, 3, 0, 0, 0), 3),
  matrix(c(1, 0, 0, 4, 0, 0), 3),
  matrix(c(0, 0, 0, 0, 0, 1), 2),
  matrix(c(1, 2, 3, 4, 5, 6), 3),                   # 3×2 (transposed orientation)
  matrix(c(100, 120, 90, 110, 95, 130), 2),
  matrix(c(60, 1, 2, 3, 70, 4), 2, byrow = TRUE),
  matrix(c(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1), 2)  # 2×6
)
for (i in 1:12) {
  nr <- c(2, 2, 3, 3, 4, 2)[(i - 1) %% 6 + 1]
  nc <- c(3, 5, 3, 4, 4, 8)[(i - 1) %% 6 + 1]
  lam <- c(3, 8, 2, 5, 1.5, 4)[(i - 1) %% 6 + 1]
  tabs[[length(tabs) + 1]] <- matrix(rpois(nr * nc, lam), nr)
}
for (x in tabs) add(x = x)
add(x = tabs[[1]], alternative = "less")
add(x = tabs[[1]], alternative = "g")
add(x = tabs[[1]], or = -1, confLevel = 2)
add(x = matrix(c(1.4, 2, 5, 3, 4.5, 6), 2))
add(x = matrix(c(1, -2, 5, 3, 4, 6), 2))
add(x = matrix(c(1, NaN, 5, 3, 4, 6), 2))
add(x = matrix(c(1, Inf, 5, 3, 4, 6), 2))
add(x = matrix(0, 3, 2))

# Reference (p-value of r×c tables with 2 rows or 2 columns): enumerate all tables with the given margins and sum exactly with
# gmp big integers (R's FEXACT p-value has rounding error around 1e-11 and changes with workspace).
# A table's probability is Π r! Π c! / (n! Π x!), so keeping D = Π x! as an integer allows the exact comparison
# "probability at most 1 + 1e-7 times that of the observed table" as D_obs <= (1 + 1e-7) D.
# Tables with 3 or more rows and columns are skipped because the enumeration is too slow in R
compositions <- function(total, bounds) {
  if (length(bounds) == 1) return(if (total <= bounds) matrix(total, 1) else matrix(0, 0, 1))
  out <- list()
  for (v in max(0, total - sum(bounds[-1])):min(bounds[1], total)) {
    rest <- compositions(total - v, bounds[-1])
    if (nrow(rest) > 0) out[[length(out) + 1]] <- cbind(v, rest)
  }
  do.call(rbind, out)
}
fisher_rxc_ref <- function(a) {
  x <- round(a$x)
  if (nrow(x) == 2 && ncol(x) == 2) return(NULL)
  x <- x[rowSums(x) > 0, colSums(x) > 0, drop = FALSE]
  if (nrow(x) < 2 || ncol(x) < 2) return(NULL)
  if (ncol(x) == 2) x <- t(x)
  if (nrow(x) != 2) return(NULL)
  cs <- colSums(x); r1 <- sum(x[1, ]); n <- sum(x)
  top <- compositions(r1, cs)               # combinations for the first row (one table per row)
  fz <- gmp::factorialZ
  # D = Π (x_1j! x_2j!)
  D <- gmp::as.bigz(rep(1, nrow(top)))
  for (j in seq_along(cs)) D <- D * fz(top[, j]) * fz(cs[j] - top[, j])
  d_obs <- gmp::as.bigz(1)
  for (v in as.vector(x)) d_obs <- d_obs * fz(v)
  keep <- d_obs * 10000000 <= D * 10000001
  s <- sum(gmp::as.bigq(1, D[keep]))
  p <- s * fz(r1) * fz(n - r1)
  for (cj in cs) p <- p * fz(cj)
  p <- p / fz(n)
  list(pValue = num2str(Rmpfr::asNumeric(Rmpfr::mpfr(p, 200))))
}

write_htest_fixture("fisherTest", cases, function(a) {
  r <- call_with(fisher.test, list(x = a$x, alternative = a$alternative, or = a$or,
                                   conf.int = a$confInt, conf.level = a$confLevel))
  f <- htest_fields(r)
  # fisher.test does not return a statistic
  f$statistic <- NULL
  f$statisticName <- NULL
  f
}, fisher_rxc_ref)
