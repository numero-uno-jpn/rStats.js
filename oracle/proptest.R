source("/oracle/_htest.R")

# prop.test (fixture propTest)

set.seed(20261026)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:150) {
  k <- sample(c(1, 1, 2, 2, 3, 4), 1)
  n <- sample(1:400, k, replace = TRUE)
  base <- runif(1, 0.02, 0.98)
  x <- pmin(n, pmax(0, round(n * pmin(pmax(base + runif(k, -0.1, 0.1), 0), 1))))
  a <- list(x = x, n = n, alternative = sample(alts, 1), confLevel = sample(c(0.95, 0.9, 0.99), 1),
            correct = runif(1) < 0.7)
  if (k == 1 || runif(1) < 0.3) a$p <- round(runif(k, 0.05, 0.95), 3)
  cases[[length(cases) + 1]] <- a
}
smokers <- c(83, 90, 129, 70); patients <- c(86, 93, 136, 82)
for (alt in alts) {
  add(x = smokers, n = patients, alternative = alt)
  add(x = smokers[1:2], n = patients[1:2], alternative = alt)
  add(x = 15, n = 20, alternative = alt)
  add(x = 15, n = 20, p = 0.75, alternative = alt)
  add(x = 10, n = 20, alternative = alt)
  add(x = 0, n = 20, alternative = alt)
  add(x = 20, n = 20, alternative = alt)
  add(x = c(5, 5), n = c(10, 10), alternative = alt)
  add(x = c(5, 6), n = c(10, 10), alternative = alt)
  add(x = c(0, 3), n = c(10, 10), alternative = alt, correct = FALSE)
  add(x = c(3, 4), n = c(10, 12), p = c(0.3, 0.4), alternative = alt)
}
for (cl in c(0.5, 0.999999)) add(x = 15, n = 20, confLevel = cl)
add(x = c(1, NA, 3), n = c(10, 10, 10))
add(x = 11, n = 10)
add(x = -1, n = 10)
add(x = 3, n = 10, p = 0)
add(x = 3, n = 10, p = 1)
add(x = c(3, 4), n = 10)
add(x = 3, n = 0)
prop_fun <- function(a) {
  args <- list(x = a$x, n = a$n, p = a$p, alternative = a$alternative, conf.level = a$confLevel, correct = a$correct)
  htest_fields(call_with(prop.test, args))
}
write_htest_fixture("propTest", cases, prop_fun)
