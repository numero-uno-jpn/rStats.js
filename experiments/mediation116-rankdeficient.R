# mediation116-rankdeficient.R: mediate's bootstrap when a resample makes a coefficient inestimable (1.16.0): the demo
# example mediate-bootstrap-binary (n = 10, a binary mediator) has resamples where B is collinear with X. Settles: the
# warnings, and whether the replicate's effect equals that with the NA coefficient taken as 0.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(mediation))
out <- list(R = R.version.string, arch = R.version$arch)
d <- data.frame(X = c(0, 0, 0, 0, 0, 1, 1, 1, 1, 1), Y = c(2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8), B = c(0, 0, 1, 1, 0, 1, 1, 1, 0, 1))
assign("d", d, envir = globalenv())
warns <- character(0)
set.seed(1234)
r <- withCallingHandlers(mediate(glm(B ~ X, family = binomial, data = d), lm(Y ~ X + B, data = d), treat = "X", mediator = "B",
                                 sims = 200, boot = TRUE, boot.ci.type = "bca"),
                         warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
out$warnings <- unique(warns); out$n_warnings <- length(warns)
out$d0_sims <- as.vector(r$d0.sims); out$z0_sims <- as.vector(r$z0.sims)
# the resamples whose outcome refit has an NA coefficient, and those whose mediator refit does
set.seed(1234); I <- matrix(sample(10, 10 * 200, replace = TRUE), 200, 10)
out$na_outcome <- which(sapply(1:200, function(j) anyNA(coef(lm(Y ~ X + B, data = d[I[j, ], ])))))
out$na_mediator <- which(sapply(1:200, function(j) anyNA(suppressWarnings(coef(glm(B ~ X, family = binomial, data = d[I[j, ], ]))))))
out$d0_at_na <- out$d0_sims[out$na_outcome]
# added after the first run: rStats.js's draws differed from R's from replicate 37 on (8 of 200). The mediator refits of
# the first differing replicates and the original data: coefficients, iterations, and whether the predicted
# probabilities at X = 0 and 1 are exactly 0 or 1 (rbinom draws no uniform then)
out$refits <- lapply(c(36, 37, 68), function(j) {
  f <- suppressWarnings(glm(B ~ X, family = binomial, data = d[I[j, ], ]))
  p <- predict(f, newdata = data.frame(X = c(0, 1)), type = "response")
  list(j = j, rows = I[j, ], coef = unname(coef(f)), iter = f$iter, converged = f$converged, p = unname(p), exact01 = unname(p == 0 | p == 1))
})
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, pretty = TRUE))
