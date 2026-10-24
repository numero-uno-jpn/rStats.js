# oracle-platform: amd64
source("/oracle/_htest.R")

# fisher.test(simulate.p.value = TRUE) (fixture fisherTestSim). Each case calls set.seed(seed) right before
# fisher.test. For tables larger than 2 x 2, B tables are drawn with r2dtable's algorithm and the p-value is
# (1 + #{simulated tables at most as probable as the observed one, with relative tolerance 64 eps}) / (B + 1).
# For 2 x 2 tables simulate.p.value is ignored (the exact test is used and no random numbers are drawn).
# next: runif(1) drawn after the test, to check how many uniforms were consumed.

set.seed(20261104)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
seeds <- c(1, 42, 2024)

tabs <- list(
  matrix(c(1, 2, 3, 4, 5, 6), 2),
  matrix(c(2, 10, 15, 3, 3, 1), 2),
  matrix(c(30, 10, 5, 10, 30, 5, 5, 5, 30), 3),
  matrix(c(1, 0, 0, 0, 1, 0, 0, 0, 1), 3),
  matrix(rpois(9, 4), 3),
  matrix(rpois(12, 2), 3),
  matrix(rpois(20, 3), 4),
  matrix(rpois(30, 20), 5),
  matrix(c(0, 3, 5, 0, 2, 4, 0, 1, 6), 3),     # zero row
  matrix(c(5, 0, 3, 4, 0, 2), 2)                 # zero column (2 x 2 after dropping it)
)
for (x in tabs) for (s in seeds) add(x = x, simulatePValue = TRUE, seed = s)
for (x in tabs[c(1, 3)]) {
  add(x = x, simulatePValue = TRUE, B = 1, seed = 5)
  add(x = x, simulatePValue = TRUE, B = 100, seed = 6)
  add(x = x, simulatePValue = TRUE, B = 10000, seed = 7)
}
# 2 x 2: simulate.p.value is ignored
add(x = matrix(c(3, 1, 1, 3), 2), simulatePValue = TRUE, seed = 8)
add(x = matrix(c(3, 1, 1, 3), 2), simulatePValue = TRUE, B = 100, alternative = "greater", seed = 8)
# B = 0 (allowed) and invalid B
add(x = matrix(c(1, 2, 3, 4, 5, 6), 2), simulatePValue = TRUE, B = 0, seed = 9)
add(x = matrix(c(1, 2, 3, 4, 5, 6), 2), simulatePValue = TRUE, B = NaN, seed = 9)

write_htest_fixture("fisherTestSim", cases, function(a) {
  set.seed(a$seed)
  r <- call_with(fisher.test, list(x = a$x, alternative = a$alternative, simulate.p.value = a$simulatePValue,
                                   B = a$B))
  nxt <- runif(1)
  f <- htest_fields(r)
  f$statistic <- NULL
  f$statisticName <- NULL
  c(f, list("next" = num2str(nxt)))
})
