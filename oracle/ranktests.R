source("/oracle/_htest.R")

# kruskal.test, fligner.test, oneway.test (list of samples), friedman.test, quade.test (matrix), mood.test and
# shapiro.test (fixtures kruskalTest, flignerTest, onewayTest, friedmanTest, quadeTest, moodTest, shapiroTest)

set.seed(20261025)
alts <- c("two.sided", "less", "greater")
arg_json_vector <- arg_json
arg_json <- function(v) if (is.list(v)) lapply(v, function(g) I(num2str(g))) else arg_json_vector(v)

# samples: continuous, many ties, wide scales
draw <- function(n, kind) switch(kind,
  round(rnorm(n), 6),
  as.numeric(sample(0:6, n, replace = TRUE)),
  round(rexp(n) * 10^runif(1, -3, 3), 4))
groups_list <- function(k, nmin = 2, nmax = 30) {
  kind <- sample(1:3, 1)
  lapply(seq_len(k), function(j) draw(sample(nmin:nmax, 1), kind) + (j - 1) * runif(1, 0, 0.5))
}

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:100) add(groups = groups_list(sample(2:6, 1)))
add(groups = list(c(2.9, 3.0, 2.5, 2.6, 3.2), c(3.8, 2.7, 4.0, 2.4), c(2.8, 3.4, 3.7, 2.2, 2.0)))
add(groups = list(c(1, 2, NA, 4), c(3, 5, 6)))
add(groups = list(c(1, 1, 1), c(1, 1, 2)))
add(groups = list(c(1, 2, 3)))
add(groups = list(c(1, 1), c(1, 1)))
write_htest_fixture("kruskalTest", cases, function(a) htest_fields(kruskal.test(a$groups)))
write_htest_fixture("flignerTest", cases, function(a) htest_fields(fligner.test(a$groups)))

cases <- list()
for (i in 1:100) {
  g <- groups_list(sample(2:6, 1), nmin = 2)
  g <- lapply(g, function(v) v * 10^runif(1, -1, 1))
  add(groups = g, varEqual = runif(1) < 0.5)
}
add(groups = list(c(1, 2, 3), c(2, 3, 4), c(5, 6, 8)), varEqual = TRUE)
add(groups = list(c(1, 2, 3), c(2, 3, 4), c(5, 6, 8)), varEqual = FALSE)
add(groups = list(c(1, 2, 3), c(4, 4, 4)))
add(groups = list(c(1, 2, 3), 4))
add(groups = list(c(1, 2, 3)))
oneway_fun <- function(a) {
  y <- unlist(a$groups)
  g <- factor(rep(seq_along(a$groups), lengths(a$groups)))
  htest_fields(oneway.test(y ~ g, var.equal = isTRUE(a$varEqual)))
}
write_htest_fixture("onewayTest", cases, oneway_fun)
arg_json <- arg_json_vector

cases <- list()
for (i in 1:100) {
  b <- sample(2:25, 1); k <- sample(2:6, 1); kind <- sample(1:3, 1)
  add(y = t(sapply(seq_len(b), function(r) draw(k, kind) + (seq_len(k) - 1) * runif(1, 0, 0.8))))
}
add(y = matrix(c(31, 27, 24, 31, 28, 31, 45, 29, 46, 21, 18, 48, 42, 36, 46, 32, 17, 40), ncol = 3, byrow = TRUE))
add(y = matrix(c(1, 2, 3, 1, 2, 3, 1, 2, 3), 3, byrow = TRUE))
add(y = matrix(c(1, 1, 1, 2, 2, 2), 2, byrow = TRUE))
add(y = matrix(c(1, 2, NA, 4, 5, 6, 7, 9, 8), 3, byrow = TRUE))
add(y = matrix(1:3, 1))
write_htest_fixture("friedmanTest", cases, function(a) htest_fields(friedman.test(a$y)))
write_htest_fixture("quadeTest", cases, function(a) htest_fields(quade.test(a$y)))

cases <- list()
for (i in 1:100) {
  kind <- sample(1:3, 1)
  add(x = draw(sample(2:40, 1), kind), y = draw(sample(2:40, 1), kind) * runif(1, 0.3, 3), alternative = sample(alts, 1))
}
for (alt in alts) {
  add(x = c(111, 107, 100, 99, 102, 106, 109, 108, 104, 99, 101, 96, 97, 102, 107, 113, 116, 113, 110, 98),
      y = c(107, 108, 106, 98, 105, 103, 110, 105, 104, 100, 96, 108, 103, 104, 114, 114, 113, 108, 106, 99),
      alternative = alt)
  add(x = c(1, 2, 2, 3), y = c(2, 2, 2, 5, 6), alternative = alt)
}
add(x = 1, y = 2)
write_htest_fixture("moodTest", cases, function(a)
  htest_fields(call_with(mood.test, list(x = a$x, y = a$y, alternative = a$alternative))))

cases <- list()
for (n in c(3, 4, 5, 6, 7, 11, 12, 20, 50, 100, 500, 1000, 5000)) {
  add(x = round(rnorm(n), 6))
  add(x = round(rexp(n), 6))
  add(x = round(runif(n), 6))
}
add(x = c(1, 2, 3))
add(x = c(1, 1, 2))
add(x = c(1, 2, NA, 4, 8))
add(x = 1e10 + rnorm(30))
add(x = rnorm(30) * 1e-200)
add(x = c(1, 1, 1, 1))
add(x = c(1, 2))
add(x = rnorm(5001))
write_htest_fixture("shapiroTest", cases, function(a) htest_fields(shapiro.test(a$x)))
