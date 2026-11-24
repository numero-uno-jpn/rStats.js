# step115-gamma.R: what the AIC column of stats' drop1 and add1 is for a Gamma (and inverse.gaussian) glm, public
# functions only (1.15.0). In oracle/step.R it differs from AIC() of the candidate model refitted with glm() (139.417
# against 137.831 for dropping x1) while the Deviance column agrees to all digits. For each candidate: drop1's
# columns, the refit's AIC(), deviance and dispersions, and the AIC of glm.fit calls with the candidate's columns of
# the model matrix under several weights.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
set.seed(20261125)
n <- 60
d <- data.frame(x1 = round(rnorm(n), 3), x2 = round(rnorm(n), 3), x3 = round(rnorm(n), 3),
                x4 = round(rnorm(n), 3), x5 = round(rnorm(n), 3), f = sample(c("a", "b", "c"), n, TRUE))
d$y <- round(1 + 0.9 * d$x1 - 0.5 * d$x2 + 0.25 * d$x3 + 0.4 * (d$f == "c") + rnorm(n), 3)
d$yb <- rbinom(n, 1, plogis(-0.3 + 1.1 * d$x1 - 0.7 * d$x2 + 0.2 * d$x4))
d$yc <- rpois(n, exp(0.5 + 0.4 * d$x1 + 0.3 * d$x3))
d$ygam <- round(rgamma(n, shape = 4, rate = 4 / exp(0.3 + 0.3 * d$x1 - 0.2 * d$x2)), 4)
probe <- function(fam, fo) {
  full <- glm(fo, family = fam, data = d)
  X <- model.matrix(full); asg <- attr(X, "assign"); labs <- attr(terms(full), "term.labels")
  dr <- drop1(full)
  cands <- lapply(seq_along(labs), function(j) {
    cols <- asg != j
    fresh <- glm.fit(X[, cols, drop = FALSE], full$y, weights = full$prior.weights, family = fam)
    work <- glm.fit(X[, cols, drop = FALSE], full$y, weights = full$weights, family = fam)
    list(term = labs[j], drop1_AIC = dr$AIC[j + 1], drop1_dev = dr$Deviance[j + 1],
         fresh_aic = fresh$aic, fresh_dev = fresh$deviance, fresh_rank = fresh$rank,
         working_aic = work$aic, working_dev = work$deviance,
         disp_full_pearson = sum(residuals(full, "pearson")^2) / full$df.residual,
         disp_cand_pearson = sum(((full$y - fresh$fitted.values) / fresh$family$variance(fresh$fitted.values)^0.5)^2 * full$prior.weights) / fresh$df.residual)
  })
  list(family = fam$family, link = fam$link, full_aic = full$aic, full_dev = full$deviance, drop1_none_AIC = dr$AIC[1],
       full_disp = summary(full)$dispersion, cands = cands)
}
out <- list(R = R.version.string,
  gamma = probe(Gamma(), ygam ~ x1 + x2 + x3 + f),
  gamma_log = probe(Gamma(link = "log"), ygam ~ x1 + x2 + x3),
  invgauss = probe(inverse.gaussian(link = "log"), ygam ~ x1 + x2 + x3),
  gaussian = probe(gaussian(), y ~ x1 + x2 + x3),
  poisson = probe(poisson(), yc ~ x1 + x2 + x3))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
