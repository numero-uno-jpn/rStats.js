source("/oracle/_htest.R")

# chisq.test (goodness of fit and independence in contingency tables). simulate.p.value is out of scope

set.seed(20261021)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

# ---- Goodness of fit (x is a vector) ----
gof <- list(
  c(20, 15, 25),
  c(89, 37, 30, 28, 2),
  c(1, 2),
  c(0, 5, 3),
  c(0, 0, 7, 1),
  c(1, 2.5, 3),
  c(0.1, 0.2, 0.7),
  rpois(6, 10),
  rpois(12, 3),
  rpois(30, 50),
  rpois(4, 1e4),
  c(1000, 1500),
  c(1e5, 1.02e5, 0.99e5),
  c(1e6, 1.1e6),
  c(1e7, 2e7, 3e7),
  c(1e-300, 1, 1, 1),
  c(3, 3, 3, 3)
)
for (x in gof) {
  add(x = x)
  k <- length(x)
  p <- runif(k); p <- p / sum(p)
  add(x = x, p = p)
  add(x = x, p = round(p * 100), rescaleP = TRUE)
  add(x = x, p = c(rep(0.5 / (k - 1), k - 1), 0.5))
}
# Probabilities containing 0 (statistic is Inf or NaN)
add(x = c(1, 2, 3), p = c(0, 0.5, 0.5))
add(x = c(0, 2, 3), p = c(0, 0.5, 0.5))
# Threshold for the sum of probabilities (used without rescaling if |sum(p) - 1| <= sqrt(eps))
for (d in c(1e-9, 1.4901161e-8, -1.4901161e-8, 1.4901162e-8, -1.4901162e-8, 1e-7)) {
  add(x = c(1, 2, 3), p = c(0.2, 0.3, 0.5 + d))
}
add(x = c(1, 2, 3), p = c(2, 3, 5), rescaleP = TRUE)
add(x = c(1, 2, 3), p = c(2, 3, 5), rescaleP = FALSE)
add(x = c(1, 2, 3), p = c(1e-300, 2e-300, 3e-300), rescaleP = TRUE)
# Inputs that raise errors, and special values
add(x = c(1, -2, 3))
add(x = c(1, NaN, 3))
add(x = c(1, NA, 3))
add(x = c(1, Inf, 3))
add(x = c(0, 0, 0))
add(x = 5)
add(x = c(1, 2, 3), p = c(0.5, 0.5))
add(x = c(1, 2, 3), p = c(-0.2, 0.7, 0.5))
add(x = c(1, 2, 3), p = c(NaN, 0.5, 0.5))
add(x = c(1, 2, 3), p = c(0, 0, 0), rescaleP = TRUE)
add(x = c(1, 2, 3), p = c(Inf, 1, 1), rescaleP = TRUE)
add(x = c(1, 2, 3), p = c(Inf, 1, 1))
add(x = c(1, Inf, 3), p = c(0, 0.5, 0.5))
add(x = c(10, Inf, 30), p = c(0, 0.5, 0.5))
add(x = c(1, 2, 3), p = c(Inf, Inf, 1), rescaleP = TRUE)

# ---- Contingency tables (x is a matrix) ----
tabs <- list(
  matrix(c(12, 5, 7, 7), 2),
  matrix(c(762, 484, 327, 239, 468, 477), 2),
  matrix(c(3, 2, 2, 3), 2),                 # |O - E| = 0.5 exactly
  matrix(c(10, 10, 10, 10), 2),             # O = E (correction amount 0)
  matrix(c(10, 10, 10, 10.2), 2),           # |O - E| < 0.5
  matrix(c(1, 2, 3, 4), 2),
  matrix(c(0, 5, 3, 4), 2),
  matrix(c(12, 5, 0, 0), 2),                # zero column (expected count 0 → NaN)
  matrix(c(1, 0, 3, 0, 5, 0), 2),           # zero row
  matrix(c(12, 5, 7.5, 7), 2),
  matrix(c(1e-300, 1, 1, 1), 2),
  matrix(c(1000, 1500, 1500, 1000), 2),
  matrix(c(1e5, 2e5, 3e5, 4e5), 2),
  matrix(c(1e6, 1.001e6, 1.002e6, 1e6), 2),
  matrix(rpois(6, 8), 2),
  matrix(rpois(9, 4), 3),
  matrix(rpois(12, 20), 3),
  matrix(rpois(20, 2), 4),
  matrix(rpois(30, 100), 5),
  matrix(rpois(16, 1e4), 4),
  matrix(c(30, 10, 5, 10, 30, 5, 5, 5, 30), 3),
  matrix(c(1, 2, 3), 1),                    # 1 row → goodness of fit
  matrix(c(4, 6, 9), 3),                    # 1 column → goodness of fit
  matrix(c(1, 2), 1)
)
for (x in tabs) {
  add(x = x)
  add(x = x, correct = FALSE)
}
add(x = matrix(c(1, 3, 2), 1), p = c(0.2, 0.3, 0.5))
add(x = matrix(c(1, 2, 3, 4), 2), p = c(0.1, 0.2, 0.3, 0.4))
# Inputs that raise errors, and special values
add(x = matrix(c(1, -2, 3, 4), 2))
add(x = matrix(c(1, NaN, 3, 4), 2))
add(x = matrix(c(1, NA, 3, 4), 2))
add(x = matrix(c(1, Inf, 3, 4), 2))
add(x = matrix(c(0, 0, 0, 0), 2))
add(x = matrix(c(1, Inf, 2), 1))
add(x = matrix(c(1, NaN, 2), 1))
add(x = matrix(c(0, 0, 0), 1))
add(x = matrix(5, 1))

write_htest_fixture("chisqTest", cases, function(a) {
  r <- call_with(chisq.test, list(x = a$x, p = a$p, rescale.p = a$rescaleP, correct = a$correct))
  f <- htest_fields(r)
  f$alternative <- NULL  # chisq.test results have no alternative
  c(f, list(observed = num_or_vec(unclass(r$observed)), expected = num_or_vec(r$expected),
                          residuals = num_or_vec(r$residuals), stdres = num_or_vec(r$stdres)))
})
