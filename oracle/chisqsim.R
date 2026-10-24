# oracle-platform: amd64
source("/oracle/_htest.R")

# chisq.test(simulate.p.value = TRUE) (fixture chisqTestSim). Each case calls set.seed(seed) right before
# chisq.test. Goodness of fit draws sample.int(k, B * n, TRUE, prob = p) (Walker's alias method when k > 200);
# contingency tables draw B tables with r2dtable's algorithm. The statistic is the ordinary one (no continuity
# correction); the p-value is (1 + #{simulated >= statistic * (1 - 64 eps)}) / (B + 1) and the parameter is NA.
# next: runif(1) drawn after the test, to check how many uniforms were consumed.

set.seed(20261103)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
seeds <- c(1, 42, 2024)

# ---- Goodness of fit ----
gof <- list(c(20, 15, 25), c(89, 37, 30, 28, 2), c(1, 2), c(0, 5, 3), c(3, 3, 3, 3), rpois(12, 3), rpois(30, 50))
for (x in gof) for (s in seeds) {
  add(x = x, simulatePValue = TRUE, seed = s)
  k <- length(x); p <- runif(k); p <- p / sum(p)
  add(x = x, p = p, simulatePValue = TRUE, B = 500, seed = s)
}
big <- rpois(250, 2)                               # more than 200 categories: Walker's alias method
add(x = big, simulatePValue = TRUE, B = 200, seed = 1)
pb <- runif(250); add(x = big, p = pb / sum(pb), simulatePValue = TRUE, B = 200, seed = 2)
add(x = rpois(201, 1), simulatePValue = TRUE, B = 100, seed = 3)
add(x = rpois(200, 1), simulatePValue = TRUE, B = 100, seed = 3)
add(x = c(2, 3, 5), p = c(2, 3, 5), rescaleP = TRUE, simulatePValue = TRUE, B = 1, seed = 4)
add(x = c(2, 3, 5), simulatePValue = TRUE, B = 1, seed = 5)
add(x = c(2, 3, 5), simulatePValue = TRUE, B = 10000, seed = 6)
add(x = c(10, 0, 0), p = c(0.2, 0.3, 0.5), simulatePValue = TRUE, B = 300, seed = 7)
# Non-integer counts (R uses round(sum(x)) draws)
add(x = c(1, 2.5, 3), simulatePValue = TRUE, B = 100, seed = 8)

# ---- Contingency tables ----
tabs <- list(
  matrix(c(12, 5, 7, 7), 2),
  matrix(c(762, 484, 327, 239, 468, 477), 2),
  matrix(c(3, 2, 2, 3), 2),
  matrix(c(1, 2, 3, 4), 2),
  matrix(c(0, 5, 3, 4), 2),
  matrix(c(30, 10, 5, 10, 30, 5, 5, 5, 30), 3),
  matrix(rpois(9, 4), 3),
  matrix(rpois(20, 2), 4),
  matrix(rpois(30, 100), 5)
)
for (x in tabs) for (s in seeds) add(x = x, simulatePValue = TRUE, seed = s)
for (x in tabs[c(1, 6)]) {
  add(x = x, simulatePValue = TRUE, B = 1, seed = 9)
  add(x = x, simulatePValue = TRUE, B = 50, seed = 10)
  add(x = x, simulatePValue = TRUE, correct = FALSE, B = 50, seed = 10)
}
# Zero row (R does not simulate when a margin is 0: ordinary test, NaN), 1-row table (goodness of fit)
add(x = matrix(c(1, 0, 3, 0, 5, 0), 2), simulatePValue = TRUE, B = 50, seed = 11)
add(x = matrix(c(1, 2, 3), 1), simulatePValue = TRUE, B = 50, seed = 12)
# B = 0 (allowed) and invalid B
add(x = matrix(c(12, 5, 7, 7), 2), simulatePValue = TRUE, B = 0, seed = 13)
add(x = c(2, 3, 5), simulatePValue = TRUE, B = -1, seed = 13)
add(x = c(2, 3, 5), simulatePValue = TRUE, B = NaN, seed = 13)

write_htest_fixture("chisqTestSim", cases, function(a) {
  set.seed(a$seed)
  r <- call_with(chisq.test, list(x = a$x, p = a$p, rescale.p = a$rescaleP, correct = a$correct,
                                  simulate.p.value = a$simulatePValue, B = a$B))
  nxt <- runif(1)
  f <- htest_fields(r)
  f$alternative <- NULL
  c(f, list(observed = num_or_vec(unclass(r$observed)), expected = num_or_vec(r$expected),
            residuals = num_or_vec(r$residuals), stdres = num_or_vec(r$stdres), "next" = num2str(nxt)))
})
