source("/oracle/_htest.R")

# ansari.test without conf.int (fixture ansariTest)

set.seed(20261028)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
draw <- function(n, kind) switch(kind,
  round(rnorm(n), 6),
  as.numeric(sample(0:6, n, replace = TRUE)),
  round(rexp(n) * 10^runif(1, -3, 3), 4))
for (i in 1:150) {
  kind <- sample(c(1, 1, 2, 3), 1)
  add(x = draw(sample(1:70, 1), kind), y = draw(sample(1:70, 1), kind) * runif(1, 0.3, 3), alternative = sample(alts, 1))
}
ramsay <- c(111, 107, 100, 99, 102, 106, 109, 108, 104, 99, 101, 96, 97, 102, 107, 113, 116, 113, 110, 98)
vanEden <- c(107, 108, 106, 98, 105, 103, 110, 105, 104, 100, 96, 108, 103, 104, 114, 114, 113, 108, 106, 99)
for (alt in alts) {
  add(x = ramsay, y = vanEden, alternative = alt)
  add(x = c(1.1, 2.3, 0.4), y = c(5.2, -3.1, 7.7, 0.9), alternative = alt)
  add(x = c(1.1, 2.3, 0.4), y = c(5.2, -3.1, 7.7, 0.9), alternative = alt, exact = FALSE)
  add(x = rnorm(60), y = rnorm(70, 0, 2), alternative = alt)
  add(x = rnorm(60), y = rnorm(70, 0, 2), alternative = alt, exact = TRUE)
  add(x = rnorm(10), y = rnorm(11), alternative = alt)
  add(x = 1, y = 2, alternative = alt)
}
add(x = c(1, 2, NA, 4), y = c(3, 5, 6))
add(x = numeric(0), y = c(1, 2))
ansari_fun <- function(a) htest_fields(call_with(ansari.test, list(x = a$x, y = a$y, alternative = a$alternative,
                                                                   exact = a$exact)))
write_htest_fixture("ansariTest", cases, ansari_fun)
