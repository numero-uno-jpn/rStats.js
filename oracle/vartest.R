source("/oracle/_htest.R")

# var.test, bartlett.test and mcnemar.test (fixtures varTest, bartlettTest and mcnemarTest)

set.seed(20261024)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:120) {
  x <- round(rnorm(sample(2:60, 1), 0, 10^runif(1, -3, 3)), 6)
  y <- round(rnorm(sample(2:60, 1), 5, 10^runif(1, -3, 3)), 6)
  add(x = x, y = y, ratio = sample(c(1, round(10^runif(1, -2, 2), 4)), 1), alternative = sample(alts, 1),
      confLevel = sample(c(0.95, 0.9, 0.99), 1))
}
for (alt in alts) {
  add(x = c(1, 3, 2, 5, 4), y = c(2, 9, 4, 12, 7, 1), alternative = alt)
  add(x = rnorm(1000), y = rnorm(800, 0, 3), alternative = alt)
  add(x = c(1, 2, NA, 4), y = c(NA, 3, 8, 1, 5), alternative = alt)
  add(x = 1e8 + rnorm(20, 0, 1e-3), y = 1e8 + rnorm(20, 0, 1e-3), alternative = alt)
}
for (cl in c(0, 0.5, 0.999999, 1)) add(x = c(1, 3, 2, 5, 4), y = c(2, 9, 4, 12, 7, 1), confLevel = cl)
add(x = 1, y = c(1, 2, 3))
add(x = c(1, 2, 3), y = 4)
add(x = c(1, 2, 3), y = c(4, 5, 6), ratio = -1)
add(x = c(1, 1, 1), y = c(4, 5, 6))
var_fun <- function(a) {
  args <- list(x = a$x, y = a$y, ratio = a$ratio, alternative = a$alternative, conf.level = a$confLevel)
  htest_fields(call_with(var.test, args))
}
write_htest_fixture("varTest", cases, var_fun)

# bartlett.test takes a list of samples: write each group as an array
arg_json_vector <- arg_json
arg_json <- function(v) if (is.list(v)) lapply(v, function(g) I(num2str(g))) else arg_json_vector(v)
cases <- list()
for (i in 1:80) {
  k <- sample(2:7, 1)
  add(groups = lapply(seq_len(k), function(j) round(rnorm(sample(2:40, 1), 3, 10^runif(1, -1, 1) *
                                                     (if (runif(1) < 0.6) 1 else 10^runif(1, -2, 2))), 6)))
}
add(groups = list(c(1, 3, 2, 5), c(2, 9, 4, 12, 7), c(3, 3.5, 4, 2)))
add(groups = list(c(1, 2, NA, 5), c(2, 9, 4)))
add(groups = list(rnorm(500), rnorm(400, 0, 1.1), rnorm(300, 0, 0.9)))
add(groups = list(c(1, 2, 3)))
add(groups = list(c(1, 2, 3), 4))
# infinite values are dropped along with missing ones
add(groups = list(c(1, 3, 2, 5, Inf), c(2, 9, 4, 12, 7), c(3, 3.5, 4, 2, -Inf)))
add(groups = list(c(1, 3, 2, 5), c(2, Inf)))
add(groups = list())
bartlett_fun <- function(a) htest_fields(bartlett.test(a$groups))
write_htest_fixture("bartlettTest", cases, bartlett_fun)
arg_json <- arg_json_vector

cases <- list()
for (i in 1:80) {
  r <- sample(c(2, 2, 2, 3, 4, 5), 1)
  t <- matrix(sample(0:200, r * r, replace = TRUE), r)
  t[runif(r * r) < 0.1] <- sample(1:5, 1)
  if (any((t + t(t))[upper.tri(t)] == 0)) next
  add(x = t, correct = runif(1) < 0.6)
}
add(x = matrix(c(794, 86, 150, 570), 2))
add(x = matrix(c(794, 86, 150, 570), 2), correct = FALSE)
add(x = matrix(c(10, 3, 3, 10), 2))
add(x = matrix(c(10, 4, 3, 10), 2))
add(x = matrix(1:9, 3), correct = TRUE)
add(x = matrix(1:6, 2))
add(x = matrix(c(1, -1, 2, 3), 2))
# two factors (paired codes): incomplete pairs dropped, then each factor has its own levels, which must be as many
# (at least 2) and are matched by position
add(x = c(1, 2, 1, 2, 3), y = c(1, 1, 2, 2, 2))
add(x = c(1, 2, 1, 2, NA), y = c(1, 1, 2, 2, 3))
add(x = c(1, 2, 1, 2, 1, 2, 2, 1), y = c(5, 7, 5, 7, 7, 5, 7, 7))
add(x = c(1, 2, 3, 1, 2, 3, 3, 1, 2, 2, 3, 1), y = c(1, 2, 3, 2, 3, 1, 1, 3, 2, 1, 3, 2), correct = FALSE)
add(x = c(1, 1, 1), y = c(1, 2, 1))
mcnemar_fun <- function(a) htest_fields(call_with(mcnemar.test, list(x = a$x, y = a$y, correct = a$correct)))
write_htest_fixture("mcnemarTest", cases, mcnemar_fun)
