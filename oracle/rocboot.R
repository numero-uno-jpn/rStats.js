source("/oracle/_htest.R")

# The random methods of pROC, for the user's decision whether to support them (fixtures ciAucBoot, rocTestBoot).
# See oracle/roc-behaviour.md. Each case calls set.seed(seed) right before the pROC call; `next` is runif(1) drawn
# after it, to check how many uniforms were consumed.
#   ciAucBoot:   ci.auc(method = "bootstrap", boot.n, boot.stratified) -> ci = [lower, median, upper] (quantile type 7).
#   rocTestBoot: roc.test(method = "bootstrap" | "venkatraman", boot.n, boot.stratified, paired) -> htest fields.
# The draws are sample() / sample.int() (R_unif_index on the Mersenne-Twister stream) and, for Venkatraman, runif():
# no normal deviates and no C arithmetic that FMA contraction could change, so this arm64 fixture should equal the
# x86_64 one (pROC is not in the amd64 image yet; regenerate there with "# oracle-platform: amd64" once it is).

# oracle-memory: 1g

suppressPackageStartupMessages(library(pROC))
data(aSAH)
resp <- as.numeric(aSAH$outcome == "Poor")

set.seed(20261111)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
sets <- list(
  list(controls = c(1, 2, 2, 3, 5, 7), cases = c(2, 4, 5, 5, 8, 9, 10)),
  list(controls = aSAH$s100b[resp == 0], cases = aSAH$s100b[resp == 1]),
  list(controls = round(rnorm(40), 1), cases = round(rnorm(30, 0.8), 1)),
  list(controls = c(1, 2, 3), cases = c(4, 5)),                       # perfect
  list(controls = c(1, 2, 3), cases = 5),                             # one case >= 1: sample(5) draws from 1:5
  list(controls = c(0.1, 0.2, 0.3), cases = 0.25)                     # one case < 1: sample(0.25) returns 0.25
)
for (s in sets) for (strat in c(TRUE, FALSE)) for (seed in c(1, 42)) {
  add(controls = s$controls, cases = s$cases, bootN = 200, bootStratified = strat, seed = seed)
}
add(controls = sets[[2]]$controls, cases = sets[[2]]$cases, seed = 7)                         # defaults: 2000
add(controls = sets[[2]]$controls, cases = sets[[2]]$cases, bootN = 500, confLevel = 0.9, seed = 7)
add(controls = sets[[2]]$controls, cases = sets[[2]]$cases, bootN = 500, direction = ">", seed = 7)
add(response = c(0, 0, 0, 0, 1, 1, 1, 0), predictor = c(1, 2, 3, 4, 5, 6, 3.5, 2), bootN = 300,
    bootStratified = FALSE, seed = 3)                                  # resamples without a case give NA
write_htest_fixture("ciAucBoot", cases, function(a) {
  r <- if (!is.null(a$controls)) call_with(roc, list(controls = a$controls, cases = a$cases, direction = a$direction,
                                                     quiet = TRUE))
       else roc(a$response, a$predictor, quiet = TRUE)
  set.seed(a$seed)
  ci <- call_with(ci.auc, list(roc = r, method = "bootstrap", boot.n = a$bootN, boot.stratified = a$bootStratified,
                               conf.level = a$confLevel))
  list(ci = I(num2str(as.numeric(ci))), `next` = num2str(runif(1)))
}, warnings = TRUE)

# ---- roc.test, bootstrap and Venkatraman ----
cases <- list()
y <- rep(0:1, c(25, 20)); x1 <- round(rnorm(45) + y, 1); x2 <- round(x1 + rnorm(45, 0, 0.8), 1)
pairs <- list(list(response = resp, predictor1 = aSAH$s100b, predictor2 = as.numeric(aSAH$wfns)),
              list(response = y, predictor1 = x1, predictor2 = x2))
unpaired <- list(controls1 = rnorm(15), cases1 = rnorm(15, 1), controls2 = rnorm(20), cases2 = rnorm(25, 0.5))
for (p in pairs) for (m in c("bootstrap", "venkatraman")) for (seed in c(1, 42)) {
  add(response = p$response, predictor1 = p$predictor1, predictor2 = p$predictor2, method = m, bootN = 200, seed = seed)
}
for (m in c("bootstrap", "venkatraman")) for (seed in c(1, 42)) {
  add(controls1 = unpaired$controls1, cases1 = unpaired$cases1, controls2 = unpaired$controls2,
      cases2 = unpaired$cases2, method = m, bootN = 200, seed = seed)
}
p <- pairs[[2]]
add(response = p$response, predictor1 = p$predictor1, predictor2 = p$predictor2, method = "bootstrap", bootN = 200,
    bootStratified = FALSE, seed = 5)
add(response = p$response, predictor1 = p$predictor1, predictor2 = p$predictor2, method = "bootstrap", bootN = 200,
    alternative = "less", seed = 5)
add(response = p$response, predictor1 = p$predictor1, predictor2 = p$predictor2, method = "bootstrap", bootN = 200,
    paired = FALSE, seed = 5)
add(response = p$response, predictor1 = p$predictor1, predictor2 = p$predictor2, method = "venkatraman", bootN = 200,
    alternative = "less", seed = 5)
add(controls1 = unpaired$controls1, cases1 = unpaired$cases1, controls2 = unpaired$controls2,
    cases2 = unpaired$cases2, method = "bootstrap", bootN = 200, bootStratified = FALSE, seed = 5)
write_htest_fixture("rocTestBoot", cases, function(a) {
  if (!is.null(a$response)) {
    r1 <- roc(a$response, a$predictor1, quiet = TRUE); r2 <- roc(a$response, a$predictor2, quiet = TRUE)
  } else {
    r1 <- roc(controls = a$controls1, cases = a$cases1, quiet = TRUE)
    r2 <- roc(controls = a$controls2, cases = a$cases2, quiet = TRUE)
  }
  set.seed(a$seed)
  t <- call_with(roc.test, list(roc1 = r1, roc2 = r2, method = a$method, boot.n = a$bootN,
                                boot.stratified = a$bootStratified, alternative = a$alternative, paired = a$paired))
  f <- htest_fields(t)
  f$parameter <- I(num2str(unname(t$parameter)))
  f$parameterName <- I(names(t$parameter))
  c(f, list(`next` = num2str(runif(1))))
}, warnings = TRUE)
