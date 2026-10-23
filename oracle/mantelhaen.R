source("/oracle/_htest.R")

# mantelhaen.test (fixture mantelhaenTest). The array is written as a list of strata, each an array of rows.

set.seed(20261027)
alts <- c("two.sided", "less", "greater")
arg_json_vector <- arg_json
arg_json <- function(v) {
  if (is.array(v) && length(dim(v)) == 3)
    return(lapply(seq_len(dim(v)[3]), function(k) {
      m <- matrix(v[, , k], dim(v)[1])
      lapply(seq_len(nrow(m)), function(i) I(num2str(m[i, ])))
    }))
  arg_json_vector(v)
}
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:120) {
  K <- sample(2:6, 1)
  x <- array(sample(0:25, 4 * K, replace = TRUE), c(2, 2, K))
  add(x = x, alternative = sample(alts, 1), confLevel = sample(c(0.95, 0.9, 0.99), 1), correct = runif(1) < 0.6,
      exact = runif(1) < 0.4)
}
for (i in 1:40) {
  K <- sample(2:5, 1); I <- sample(2:4, 1); J <- sample(3:4, 1)
  add(x = array(sample(0:30, I * J * K, replace = TRUE), c(I, J, K)))
}
# the examples of ?mantelhaen.test
Rabbits <- array(c(0, 0, 6, 5, 3, 0, 3, 6, 6, 2, 0, 4, 5, 6, 1, 0, 2, 5, 0, 0), dim = c(2, 2, 5))
for (alt in alts) {
  add(x = Rabbits, alternative = alt)
  add(x = Rabbits, alternative = alt, exact = TRUE)
  add(x = Rabbits, alternative = alt, correct = FALSE)
}
add(x = array(c(2, 5, 3, 6, 4, 4, 4, 4), c(2, 2, 2)))  # |delta| < 1/2: no correction
add(x = array(c(10, 0, 0, 10, 8, 0, 0, 9), c(2, 2, 2)), exact = TRUE)
add(x = array(c(1, 0, 0, 0, 5, 3, 2, 1), c(2, 2, 2)))
add(x = array(c(1, 2, 3, 4), c(2, 2, 1)))
add(x = array(1:12, c(2, 3, 2)), exact = TRUE)
mh_fun <- function(a) {
  args <- list(x = a$x, alternative = a$alternative, conf.level = a$confLevel, correct = a$correct, exact = a$exact)
  htest_fields(call_with(mantelhaen.test, args))
}
write_htest_fixture("mantelhaenTest", cases, mh_fun)
