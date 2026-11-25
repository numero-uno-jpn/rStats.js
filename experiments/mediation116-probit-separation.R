# mediation116-probit-separation.R: the probit mediator model Mbin ~ Xb refitted on two bootstrap resamples of
# oracle/mediation.R's case "probit_lm boot_perc" (replicates 37 and 46, where rStats.js's draws differed from R's by
# 0.004-0.009) (1.16.0): R's coefficients, convergence, iterations and the cross-table of the resample, to see whether
# the resamples separate the data.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261125)
n <- 70
C <- rnorm(n); C2 <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
Mc <- 0.5 * Xb + 0.2 * X + 0.3 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-0.5 + 0.9 * Xb + 0.1 * X + 0.4 * C))
d <- data.frame(Xb, Mbin)
set.seed(1234); I <- matrix(sample(n, n * 50, replace = TRUE), 50, n)
out$reps <- lapply(c(37, 46, 1), function(j) {
  dd <- d[I[j, ], ]
  w <- character(0)
  f <- withCallingHandlers(glm(Mbin ~ Xb, family = binomial(link = "probit"), data = dd),
                           warning = function(x) { w <<- c(w, conditionMessage(x)); invokeRestart("muffleWarning") })
  list(j = j, coef = unname(coef(f)), iter = f$iter, converged = f$converged, deviance = f$deviance, warnings = w,
       table = as.vector(table(factor(dd$Xb, 0:1), factor(dd$Mbin, 0:1))), rows = I[j, ])
})
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, pretty = TRUE))
