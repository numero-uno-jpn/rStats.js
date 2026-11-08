source("/oracle/_htest.R")

# DeLong's test of two ROC curves: pROC::roc.test(method = "delong") (fixture rocTest). See oracle/roc-behaviour.md.
#
# Paired curves (one response, two predictors): args `response`, `predictor1`, `predictor2` (each curve is built
# with roc(response, predictor_i, direction = direction1 / direction2), then roc.test(roc1, roc2, ...)). Unpaired
# curves: `controls1`, `cases1`, `controls2`, `cases2`. Options: alternative, confLevel, paired (TRUE / FALSE / not
# given = pROC's detection), method (given explicitly as "delong" unless `methodMissing: true`, which lets pROC
# choose). Expected: the htest fields (Z for paired with a conf.int of the difference; D and df for unpaired), and
# warnings.

# oracle-memory: 1g

suppressPackageStartupMessages(library(pROC))
data(aSAH)

set.seed(20261110)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

resp <- as.numeric(aSAH$outcome == "Poor")
s100b <- aSAH$s100b; wfns <- as.numeric(aSAH$wfns); ndka <- aSAH$ndka
paired_sets <- list(
  list(response = resp, predictor1 = s100b, predictor2 = wfns),
  list(response = resp, predictor1 = s100b, predictor2 = ndka),
  list(response = resp, predictor1 = wfns, predictor2 = ndka),
  local({ n <- 60; y <- rep(0:1, c(35, 25)); x1 <- rnorm(n) + y; x2 <- x1 + rnorm(n, 0, 0.7)
          list(response = y, predictor1 = x1, predictor2 = x2) }),
  local({ n <- 40; y <- rep(0:1, each = 20); x1 <- round(rnorm(n) + y, 0); x2 <- round(rnorm(n) + 0.5 * y, 0)
          list(response = y, predictor1 = x1, predictor2 = x2) }),
  local({ y <- rep(0:1, c(300, 200)); x1 <- rnorm(500) + 0.8 * y; x2 <- 0.6 * x1 + rnorm(500) + 0.3 * y
          list(response = y, predictor1 = x1, predictor2 = x2) }),
  list(response = c(0, 0, 0, 1, 1, 1), predictor1 = c(1, 2, 3, 4, 5, 6), predictor2 = c(1, 4, 2, 3, 6, 5)),
  list(response = c(0, 0, 1, 1), predictor1 = c(1, 2, 3, 4), predictor2 = c(1, 2, 4, 3)),   # both perfect
  list(response = c(0, 0, 1, 1), predictor1 = c(1, 2, 3, 4), predictor2 = c(1, 3, 2, 4)),   # one perfect
  list(response = c(0, 1, 0, 1, 0, 1), predictor1 = c(1, 1, 1, 1, 1, 1), predictor2 = c(1, 2, 1, 3, 2, 2)),
  list(response = c(0, 0, 1), predictor1 = c(1, 2, 3), predictor2 = c(2, 1, 3))           # one case
)
for (ps in paired_sets) {
  add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2)
  for (alt in c("less", "greater")) add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2,
                                        alternative = alt)
}
ps <- paired_sets[[1]]
for (cl in c(0, 0.5, 0.9, 0.99, 1)) add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2,
                                       confLevel = cl)
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2, confLevel = 1.5)
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2, confLevel = 1.5, methodMissing = TRUE)
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2, alternative = "g")
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor2, paired = FALSE)    # warning
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = ps$predictor1)                   # identical
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = -ps$predictor2, direction2 = ">")
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = -ps$predictor2)                  # auto: ">"
# NA in one predictor: pROC drops the observation from both curves
p2 <- ps$predictor2; p2[c(3, 7, 50)] <- NA
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = p2)
add(response = ps$response, predictor1 = ps$predictor1, predictor2 = p2, paired = TRUE)
# scaled data (ranks only: the same values)
for (k in c(-1060, 1000)) add(response = ps$response, predictor1 = ps$predictor1 * 2^k, predictor2 = ps$predictor2 * 2^k)

# unpaired
unp <- list(
  local({ list(controls1 = rnorm(15), cases1 = rnorm(15, 1), controls2 = rnorm(20), cases2 = rnorm(20, 0.5)) }),
  local({ list(controls1 = s100b[resp == 0], cases1 = s100b[resp == 1], controls2 = round(rnorm(50), 1),
               cases2 = round(rnorm(30, 0.4), 1)) }),
  list(controls1 = c(1, 2, 3), cases1 = c(4, 5), controls2 = c(1, 3, 5, 7), cases2 = c(2, 4, 6)),
  list(controls1 = c(1, 2, 3), cases1 = c(4, 5), controls2 = c(1, 2), cases2 = c(3, 4, 5)),   # both perfect
  list(controls1 = c(1, 2, 3), cases1 = c(2.5), controls2 = c(1, 3, 5, 7), cases2 = c(2, 4, 6))
)
for (u in unp) {
  add(controls1 = u$controls1, cases1 = u$cases1, controls2 = u$controls2, cases2 = u$cases2)
  for (alt in c("less", "greater")) add(controls1 = u$controls1, cases1 = u$cases1, controls2 = u$controls2,
                                        cases2 = u$cases2, alternative = alt)
}
u <- unp[[1]]
add(controls1 = u$controls1, cases1 = u$cases1, controls2 = u$controls2, cases2 = u$cases2, paired = TRUE)   # error
add(controls1 = u$controls1, cases1 = u$cases1, controls2 = u$controls2, cases2 = u$cases2, confLevel = 0.9)
add(controls1 = u$controls1, cases1 = u$cases1, controls2 = -u$controls2, cases2 = -u$cases2)              # ">" vs "<"
add(controls1 = u$controls1, cases1 = u$cases1, controls2 = u$controls2, cases2 = u$cases2, alternative = "foo")

build <- function(a) {
  if (!is.null(a$response)) {
    r1 <- call_with(roc, list(response = a$response, predictor = a$predictor1, direction = a$direction1, quiet = TRUE))
    r2 <- call_with(roc, list(response = a$response, predictor = a$predictor2, direction = a$direction2, quiet = TRUE))
  } else {
    r1 <- roc(controls = a$controls1, cases = a$cases1, quiet = TRUE)
    r2 <- roc(controls = a$controls2, cases = a$cases2, quiet = TRUE)
  }
  list(r1, r2)
}
write_htest_fixture("rocTest", cases, function(a) {
  rr <- build(a)
  args <- list(roc1 = rr[[1]], roc2 = rr[[2]], method = if (!isTRUE(a$methodMissing)) "delong",
               alternative = a$alternative, conf.level = a$confLevel, paired = a$paired)
  htest_fields(call_with(roc.test, args))
}, warnings = TRUE)
