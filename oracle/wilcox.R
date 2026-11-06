source("/oracle/_htest.R")

# wilcox.test (signed rank and rank sum, exact and normal approximation, interval and estimate)

set.seed(20261021)
# One-sample (and paired) data. Include ties, zeros (equal to mu), the n = 49 / 50 boundary, very small n,
# NA, Inf, heavy-tailed distributions and large scales
one <- list(
  c(1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30),
  rnorm(1, 1),
  rnorm(2, 0.5),
  rnorm(3),
  rnorm(5, 1),
  rnorm(10, 0.3),
  rnorm(20, -0.4),
  rnorm(49, 0.2),
  rnorm(50, 0.2),
  rnorm(80, 0.1),
  rnorm(300, 0.1),
  round(rnorm(15, 1), 0),
  round(rnorm(30, 0.5), 1),
  c(0, 0, 1.5, -2.5, 3, 4.25, -0.5),
  c(rnorm(8), NA, NaN, 2),
  c(rnorm(6), Inf),
  c(rnorm(6), -Inf, Inf),
  rcauchy(25),
  rnorm(12, 0, 1e-200),
  rnorm(12, 1e200, 1e200),
  c(5, 5, 5),
  c(0, 0, 1),
  c(0, 0),
  c(1, 3),
  c(1, 3, 3),
  c(1, 2, 3, 4),
  1:5
)
# Two-sample data
two <- list(
  list(x = c(0.80, 0.83, 1.89, 1.04, 1.45, 1.38, 1.91, 1.64, 0.73, 1.46), y = c(1.15, 0.88, 0.90, 0.74, 1.21)),
  list(x = rnorm(1), y = rnorm(2)),
  list(x = rnorm(2), y = rnorm(1)),
  list(x = rnorm(3), y = rnorm(4, 1)),
  list(x = rnorm(8), y = rnorm(11, 0.7)),
  list(x = rnorm(25), y = rnorm(20, 0.4)),
  list(x = rnorm(49), y = rnorm(49, 0.3)),
  list(x = rnorm(49), y = rnorm(50, 0.3)),
  list(x = rnorm(50), y = rnorm(10, 0.3)),
  list(x = rnorm(120), y = rnorm(90, 0.2)),
  list(x = round(rnorm(20, 2)), y = round(rnorm(15, 1.5))),
  list(x = c(1, 2, 2), y = c(3, 3)),
  list(x = c(1, 2, 3), y = c(4, 5, 6, 6)),
  list(x = c(1, 2, 3, 4), y = c(1.5, 2.5)),
  list(x = c(rnorm(6), NA, NaN), y = c(NA, rnorm(7, 1))),
  list(x = c(rnorm(5), Inf), y = rnorm(6)),
  list(x = c(-Inf, 1, 2, 5, 7), y = c(Inf, 3, 3.5, 4, 9)),
  list(x = rexp(30), y = rexp(25, 2)),
  list(x = rnorm(10, 0, 1e-200), y = rnorm(9, 1e-200, 1e-200))
)

cases <- list()
# NULL arguments (exact's default) are not written
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
alts <- c("two.sided", "less", "greater")
exacts <- list(NULL, TRUE, FALSE)
for (x in one) {
  for (alt in alts) {
    for (ex in exacts) {
      for (cr in c(TRUE, FALSE)) add(x = x, alternative = alt, exact = ex, correct = cr, confInt = TRUE)
    }
    add(x = x, alternative = alt, mu = 0.5, confInt = TRUE)
    add(x = x, alternative = alt, mu = 1, exact = FALSE, confInt = TRUE)
  }
  for (cl in c(1e-6, 0.5, 0.8, 0.9, 0.99, 0.999999)) {
    add(x = x, confLevel = cl, confInt = TRUE)
    add(x = x, confLevel = cl, confInt = TRUE, exact = FALSE, alternative = "less")
    add(x = x, confLevel = cl, confInt = TRUE, exact = FALSE, alternative = "greater", correct = FALSE)
  }
  add(x = x)
}
# Paired (x paired with the start of the data set following one)
for (i in seq_along(one)) {
  x <- one[[i]]
  y <- rep(one[[i %% length(one) + 1]], length.out = length(x))
  for (alt in alts) {
    add(x = x, y = y, paired = TRUE, alternative = alt, confInt = TRUE)
    add(x = x, y = y, paired = TRUE, alternative = alt, exact = FALSE, correct = FALSE, confInt = TRUE)
  }
  add(x = x, y = round(x, 1), paired = TRUE, mu = 0.01, confInt = TRUE)
}
for (s in two) {
  # exact = TRUE is not used for large samples (R's pwilcox keeps m n tables proportional to m n, which is heavy)
  big <- length(s$x) * length(s$y) > 2500
  for (alt in alts) {
    for (ex in if (big) exacts[-2] else exacts) {
      for (cr in c(TRUE, FALSE)) add(x = s$x, y = s$y, alternative = alt, exact = ex, correct = cr, confInt = TRUE)
    }
    add(x = s$x, y = s$y, alternative = alt, mu = 0.5, confInt = TRUE)
    add(x = s$x, y = s$y, alternative = alt, mu = -1, exact = FALSE, confInt = TRUE)
  }
  for (cl in c(1e-6, 0.5, 0.8, 0.9, 0.99, 0.999999)) {
    add(x = s$x, y = s$y, confLevel = cl, confInt = TRUE)
    add(x = s$x, y = s$y, confLevel = cl, confInt = TRUE, exact = FALSE, alternative = "less")
    add(x = s$x, y = s$y, confLevel = cl, confInt = TRUE, exact = FALSE, alternative = "greater", correct = FALSE)
  }
}
# Tolerance of the root search
for (tol in c(1e-8, 1e-2, 0.5)) {
  add(x = one[[6]], exact = FALSE, confInt = TRUE, tolRoot = tol)
  add(x = two[[5]]$x, y = two[[5]]$y, exact = FALSE, confInt = TRUE, tolRoot = tol)
}
# Heavy ties in the normal approximation: estimates and limits near the ends of the range of the differences
for (s in list(list(x = c(1, 1, 1, 1, 2), y = c(1, 1, 1, 1, 1, 0)), list(x = c(0, 0, 0, 1), y = c(0, 0, 0, 0)),
               list(x = c(5, 5, 5, 6), y = c(5, 5, 5, 5, 5, 5, 5, 4)), list(x = c(1, 1, 2), y = c(1, 1, 1)),
               list(x = c(rep(1, 9), 2), y = 1), list(x = 2, y = c(rep(1, 9), 2)), list(x = c(1, 1), y = c(1, 2)))) {
  for (alt in alts) for (cr in c(TRUE, FALSE)) add(x = s$x, y = s$y, alternative = alt, exact = FALSE, correct = cr, confInt = TRUE)
}
# R 4.6 (oracle/wilcox46-behaviour.md): correct = 0..3 (continuity correction plus k Edgeworth terms, only without
# ties and zeros), exact conditional inference with ties and zeros (Pratt's ranks for the signed rank test), the
# achieved confidence level of exact intervals, two-sided normal p-values of 2 min(F, 1 - F), upper tails near 0
ew1 <- c(0.8, 1.9, -0.4, 2.7, 1.1, -1.3, 0.5, 3.2, 1.6, -0.2, 2.1, 0.9)
ew2 <- c(-0.5, 0.3, 1.2, -1.1, 0.7, -0.9, 0.1, -1.6)
for (k in 0:3) {
  for (alt in alts) {
    add(x = ew1, alternative = alt, exact = FALSE, correct = k)
    add(x = ew1, y = ew2, alternative = alt, exact = FALSE, correct = k)
    add(x = one[[7]], alternative = alt, exact = FALSE, correct = k, confInt = TRUE)
    add(x = two[[5]]$x, y = two[[5]]$y, alternative = alt, exact = FALSE, correct = k, confInt = TRUE)
    # ties or zeros: the Edgeworth terms are dropped, the continuity correction stays
    add(x = c(ew1, 0.8), alternative = alt, exact = FALSE, correct = k)
    add(x = ew1, alternative = alt, mu = 0.5, exact = FALSE, correct = k)
    add(x = ew1, y = c(ew2, 1.9), alternative = alt, exact = FALSE, correct = k)
  }
  add(x = ew1, mu = 3, exact = FALSE, correct = k)
  add(x = ew1, y = ew2, mu = -3, exact = FALSE, correct = k)
  add(x = ew1, correct = k)
  add(x = ew1, y = ew2, correct = k, confInt = TRUE)
}
add(x = ew1, correct = 4)
add(x = ew1, y = ew2, exact = FALSE, correct = 1.5)
add(x = ew1, exact = FALSE, correct = -1)
# Two-sided normal p-values far in the upper tail (R's 1 - F(z) is 0) and in the lower tail
for (s in list(1:300, -(1:300))) for (alt in alts) add(x = s, alternative = alt, exact = FALSE)
add(x = 1:300 + 0.5, y = -(1:200), exact = FALSE)
add(x = -(1:300), y = 1:200, exact = FALSE)
# Ties and zeros, exact (conditional) tests and intervals
tz <- list(c(1.5, 2, 2, -3, 4, 0, 5, -1, 2), c(1, 2, 2, 3, 4, 5), c(0, 1, 2, 2, 3, 4, 5), c(1, 2, 2, 3), c(5, 5, 5),
           c(0, 0, 1.5, -2.5, 3, 4.25, -0.5), c(1:10, 3), c(0, 3), c(0, 0), 5)
for (x in tz) {
  for (alt in alts) {
    for (ex in exacts) add(x = x, alternative = alt, exact = ex, confInt = TRUE)
    add(x = x, alternative = alt, mu = 2, confInt = TRUE)
  }
  for (cl in c(1e-6, 0.5, 0.8, 0.99)) add(x = x, confLevel = cl, confInt = TRUE)
}
tz2 <- list(list(x = c(1, 2, 2, 4, 5, 7), y = c(3, 3, 4, 6, 8, 9, 9)), list(x = c(1, 2, 3), y = c(3, 4, 5)),
            list(x = c(1, 2, 2), y = c(3, 3)), list(x = c(1, 1), y = c(1, 1)), list(x = 1, y = 1),
            list(x = c(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), y = c(2.5, 4.5, 6.5)), list(x = c(2.5, 4.5), y = c(1, 2, 3, 4, 5, 6)))
for (s in tz2) {
  for (alt in alts) {
    for (ex in exacts) add(x = s$x, y = s$y, alternative = alt, exact = ex, confInt = TRUE)
    add(x = s$x, y = s$y, alternative = alt, mu = -1, confInt = TRUE)
  }
  for (cl in c(1e-6, 0.5, 0.8, 0.99)) add(x = s$x, y = s$y, confLevel = cl, confInt = TRUE)
}
for (alt in alts) {
  add(x = 4:2, y = 3:1, paired = TRUE, alternative = alt, confInt = TRUE)
  add(x = c(1.1, 2.3, 3.6), alternative = alt, mu = 2.3, confInt = TRUE)
}
# Exact upper tails near 0 (summed directly, not 1 - the lower tail)
tz3 <- c(5, 4, 3, 3, 2, 1, 6, 7, 8, 9, 10, 11, -1)
for (alt in alts) {
  add(x = c(tz3, tz3, tz3), alternative = alt)
  add(x = c(10, 11, 11, 12, 13, 14, 15, 16, 17, 18), y = c(1, 2, 2, 3, 4, 5, 6, 7, 8), alternative = alt)
}
# Infinite observations in the conditional interval (R: "missing value where TRUE/FALSE needed")
add(x = c(1, 2, Inf, Inf), confInt = TRUE)
add(x = c(-Inf, 1, 2, 2, 5), confInt = TRUE)
add(x = c(1, Inf, Inf), y = c(2, 3), confInt = TRUE)
add(x = c(1, 2, Inf), confInt = TRUE)
# The confidence level is not checked when no interval is computed
add(x = 1:4, confLevel = 0)
# Extreme values and inputs that raise errors
add(x = numeric(0))
add(x = c(NaN, NaN))
add(x = c(1, 2, 3), y = numeric(0))
add(x = numeric(0), y = c(1, 2))
add(x = c(1, NaN), y = c(NaN, 2), paired = TRUE)
add(x = c(1, 2, 3), y = c(1, 2), paired = TRUE)
add(x = c(1, 2, 3), mu = Inf)
add(x = c(1, 2, 3), mu = NaN)
add(x = c(1, 2, 3), confInt = TRUE, confLevel = 1)
add(x = c(1, 2, 3), confInt = TRUE, confLevel = 0)
add(x = c(1, 2, 3), confInt = TRUE, confLevel = 1.5)
add(x = c(1, 2, 3, 4), confInt = TRUE, exact = FALSE, tolRoot = -1)
add(x = c(1, 1), y = c(1, 1))
add(x = c(1, 1), y = c(1, 1), confInt = TRUE)
add(x = 1, y = 1, confInt = TRUE)
add(x = c(1, Inf), y = c(2, 3), confInt = TRUE)
add(x = c(1, Inf), y = c(2, 3), confInt = TRUE, exact = FALSE)
add(x = c(3, 3, 3, 3), mu = 3, confInt = TRUE)
add(x = c(3, 3, 3, 3), mu = 3, confInt = TRUE, alternative = "less")
add(x = c(Inf, 1, 2, 5, 7), y = c(Inf, 3, 3.5, 4, 9), paired = TRUE, confInt = TRUE)
add(x = c(1, 2, 3), y = c(4, 5, 7), paired = TRUE, confInt = TRUE, exact = FALSE)

write_htest_fixture("wilcoxTest", cases, function(a) {
  r <- wilcox.test(a$x, a$y,
                   alternative = if (is.null(a$alternative)) "two.sided" else a$alternative,
                   mu = if (is.null(a$mu)) 0 else a$mu,
                   paired = isTRUE(a$paired), exact = a$exact,
                   correct = if (is.null(a$correct)) TRUE else a$correct,
                   conf.int = isTRUE(a$confInt),
                   conf.level = if (is.null(a$confLevel)) 0.95 else a$confLevel,
                   tol.root = if (is.null(a$tolRoot)) 1e-4 else a$tolRoot)
  # When the estimate has no name (nothing remains after dropping zero differences), htest_fields cannot build the name field, so
  # pass it without the estimate and add only the value (the name field is not written)
  if (!is.null(r$estimate) && is.null(names(r$estimate))) {
    est <- r$estimate
    r$estimate <- NULL
    return(c(htest_fields(r), list(estimate = num2str(est))))
  }
  htest_fields(r)
}, warnings = TRUE)
