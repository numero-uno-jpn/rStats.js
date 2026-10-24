source("/oracle/_htest.R")

# ansari.test with conf.int = TRUE (fixture ansariTestConfInt): the confidence interval for the ratio of scales and
# its estimate, by the exact distribution (no ties, both samples smaller than 50) and by the normal approximation.
# The normal-approximation limits and estimate are roots found by uniroot, so they are only as accurate as uniroot's
# tolerance; the exact limits are taken from the exact distribution.

set.seed(20261101)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
draw <- function(n, kind) switch(kind,
  round(rnorm(n), 6),
  as.numeric(sample(0:6, n, replace = TRUE)),
  round(rexp(n) * 10^runif(1, -3, 3), 4))
for (i in 1:120) {
  kind <- sample(c(1, 1, 2, 3), 1)
  add(x = draw(sample(2:70, 1), kind), y = draw(sample(2:70, 1), kind) * runif(1, 0.3, 3),
      alternative = sample(alts, 1), confInt = TRUE, confLevel = sample(c(0.95, 0.95, 0.9, 0.99, 0.5), 1))
}
ramsay <- c(111, 107, 100, 99, 102, 106, 109, 108, 104, 99, 101, 96, 97, 102, 107, 113, 116, 113, 110, 98)
vanEden <- c(107, 108, 106, 98, 105, 103, 110, 105, 104, 100, 96, 108, 103, 104, 114, 114, 113, 108, 106, 99)
for (alt in alts) {
  add(x = ramsay, y = vanEden, alternative = alt, confInt = TRUE)
  add(x = c(1.1, 2.3, 0.4), y = c(5.2, -3.1, 7.7, 0.9), alternative = alt, confInt = TRUE)
  add(x = c(1.1, 2.3, 0.4), y = c(5.2, -3.1, 7.7, 0.9), alternative = alt, confInt = TRUE, exact = FALSE)
  add(x = rnorm(10), y = rnorm(11, 0, 3), alternative = alt, confInt = TRUE)
  add(x = rnorm(10), y = rnorm(11, 0, 3), alternative = alt, confInt = TRUE, exact = FALSE)
  add(x = rnorm(49), y = rnorm(49, 0, 0.5), alternative = alt, confInt = TRUE)
  add(x = rnorm(60), y = rnorm(70, 0, 2), alternative = alt, confInt = TRUE)
  add(x = rnorm(60), y = rnorm(70, 0, 2), alternative = alt, confInt = TRUE, exact = TRUE)
  add(x = c(-2, -1, 1, 2), y = c(-4, -3, 3, 4), alternative = alt, confInt = TRUE)
  add(x = rnorm(8), y = rnorm(9), alternative = alt, confInt = TRUE, confLevel = 0.8)
}
# Ties (exact switches to the normal approximation), zeros, a sample of size 1
add(x = c(1, 2, 2, 3, 4), y = c(0, 2, 5, 6, 6, 8), confInt = TRUE)
add(x = c(0, 1, 2, 3), y = c(0, -1, 4, 5), confInt = TRUE)
add(x = c(0, 1, 2, 3), y = c(0, -1, 4, 5), confInt = TRUE, exact = FALSE)
add(x = 1, y = c(2, 3, 4), confInt = TRUE)
add(x = c(1, 2), y = c(3, 4), confInt = TRUE)
add(x = c(1, 2, NA, 4, 7), y = c(3, 5, 6, -2), confInt = TRUE)
# Errors
add(x = c(1, 2, 3), y = c(4, 5, 6), confInt = TRUE, confLevel = 1)
add(x = c(1, 2, 3), y = c(4, 5, 6), confInt = TRUE, confLevel = 0)
add(x = c(1, 2, 3), y = c(4, 5, 6), confInt = TRUE, confLevel = NaN)

# R bug: with exact = NULL, both samples smaller than 50 and ties, ansari.test falls back to the normal approximation
# but then skips the interval and fails with "object 'cint' not found". Each such case is repeated with exact = FALSE,
# which gives the same p-value and the normal-approximation interval that R presumably intended.
for (a in cases) {
  x <- a$x[!is.na(a$x)]; y <- a$y[!is.na(a$y)]
  if (is.null(a$exact) && isTRUE(a$confInt) && length(x) < 50 && length(y) < 50 &&
      anyDuplicated(c(x, y))) {
    add(x = a$x, y = a$y, alternative = a$alternative, exact = FALSE, confInt = TRUE, confLevel = a$confLevel)
  }
}

ansari_fun <- function(a) htest_fields(call_with(ansari.test, list(x = a$x, y = a$y, alternative = a$alternative,
                                                                   exact = a$exact, conf.int = a$confInt,
                                                                   conf.level = a$confLevel)))
write_htest_fixture("ansariTestConfInt", cases, ansari_fun)
