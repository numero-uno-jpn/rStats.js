source("/oracle/_htest.R")

# binom.test and poisson.test (fixtures binomTest and poissonTest)

set.seed(20261023)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:120) {
  n <- floor(10^runif(1, 0, 3.5))
  p <- sample(c(0.5, runif(1), 10^runif(1, -4, 0)), 1)
  x <- if (runif(1) < 0.8) qbinom(runif(1, 0.001, 0.999), n, p) else sample(0:n, 1)
  add(x = x, n = n, p = p, alternative = sample(alts, 1), confLevel = sample(c(0.95, 0.9, 0.99, runif(1, 0.5, 0.999)), 1))
}
# x as c(successes, failures), boundaries, p at 0 and 1, outcomes of equal probability
for (alt in alts) {
  add(x = c(682, 243), p = 3/4, alternative = alt)
  add(x = 0, n = 10, alternative = alt)
  add(x = 10, n = 10, alternative = alt)
  add(x = 0, n = 10, p = 0, alternative = alt)
  add(x = 3, n = 10, p = 0, alternative = alt)
  add(x = 10, n = 10, p = 1, alternative = alt)
  add(x = 5, n = 10, alternative = alt)
  add(x = 2, n = 6, p = 1/3, alternative = alt)
  add(x = 1, n = 1, alternative = alt)
  add(x = 3, n = 1e6, p = 1e-6, alternative = alt)
  add(x = 5e5, n = 1e6, p = 0.4999, alternative = alt)
}
for (cl in c(0, 0.5, 0.999999, 1)) add(x = 7, n = 20, confLevel = cl)
# errors
add(x = 11, n = 10)
add(x = 2.5, n = 10)
add(x = -1, n = 10)
add(x = 3, n = 10, p = 1.5)
add(x = c(1, 2, 3))
binom_fun <- function(a) {
  args <- list(x = a$x, n = a$n, p = a$p, alternative = a$alternative, conf.level = a$confLevel)
  htest_fields(call_with(binom.test, args))
}
write_htest_fixture("binomTest", cases, binom_fun)

cases <- list()
for (i in 1:80) {
  T <- sample(c(1, round(10^runif(1, -1, 2), 4)), 1)
  r <- sample(c(1, round(10^runif(1, -1, 2), 4)), 1)
  x <- qpois(runif(1, 0.001, 0.999), r * T * 10^runif(1, -0.5, 0.5))
  add(x = x, T = T, r = r, alternative = sample(alts, 1), confLevel = sample(c(0.95, 0.9, 0.99), 1))
}
for (i in 1:60) {
  T <- round(10^runif(2, 0, 3), 2)
  x <- sample(0:60, 2)
  if (sum(x) == 0) next
  add(x = x, T = T, r = sample(c(1, round(10^runif(1, -1, 1), 3)), 1), alternative = sample(alts, 1),
      confLevel = sample(c(0.95, 0.9, 0.99), 1))
}
for (alt in alts) {
  add(x = 137, T = 24.19893, alternative = alt)
  add(x = c(11, 6 + 8 + 7), T = c(800, 1083 + 1050 + 878), alternative = alt)
  add(x = 0, T = 2, alternative = alt)
  add(x = 4, T = 2, r = 2, alternative = alt)
  add(x = c(0, 5), T = c(1, 1), alternative = alt)
  add(x = c(5, 0), T = c(1, 1), alternative = alt)
  add(x = 1e5, T = 1, r = 1e5 + 300, alternative = alt)
}
add(x = -1)
add(x = 2.5)
add(x = c(1, 2, 3))
add(x = c(1, 2), T = 1:3)
add(x = 3, r = -1)
pois_fun <- function(a) {
  args <- list(x = a$x, T = a$T, r = a$r, alternative = a$alternative, conf.level = a$confLevel)
  htest_fields(call_with(poisson.test, args))
}
write_htest_fixture("poissonTest", cases, pois_fun)
