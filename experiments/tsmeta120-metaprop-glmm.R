# tsmeta120-metaprop-glmm.R: meta's metaprop with method = "GLMM" (its default) against lme4's glmer and metafor's
# rma.glmm (1.20.0), asked for by the user to decide whether the GLMM can come into scope with rStats.js's glmer.
# Candidates written for this experiment from the help pages (metaprop: "GLMM ... a random intercept logistic regression
# model"; metafor's rma.glmm: measure "PLO", model "UM.FS" / ML):
#   random effect: glmer(cbind(x, n - x) ~ 1 + (1 | study), family = binomial) with nAGQ = 1 (Laplace) or nAGQ = 7
#     (adaptive Gauss-Hermite) or other K; TE.random = the intercept, seTE.random = its se, tau2 = the variance of the
#     random intercept;
#   common effect: glm(cbind(x, n - x) ~ 1, binomial): the intercept and its se;
#   metafor rma.glmm(measure = "PLO", xi = x, ni = n) beside it (and its nAGQ control);
#   also the heterogeneity statistics meta reports for GLMM (Q, the LRT) recorded.
# Data: three sets (k = 6, 10, 20), one with a zero and one with all events in a study.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor); library(lme4) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")),
            metafor = as.character(packageVersion("metafor")), lme4 = as.character(packageVersion("lme4")))
set.seed(91)
sets <- list(k6 = list(x = c(4, 0, 15, 22, 9, 12), n = c(40, 25, 60, 70, 45, 50)),
             k10 = { n <- sample(30:120, 10); list(x = rbinom(10, n, plogis(rnorm(10, -1, 0.6))), n = n) },
             k20 = { n <- sample(20:200, 20); x <- rbinom(20, n, plogis(rnorm(20, -2, 0.9))); x[3] <- n[3]; list(x = x, n = n) })
for (nm in names(sets)) {
  x <- sets[[nm]]$x; n <- sets[[nm]]$n; k <- length(x); st <- factor(seq_len(k))
  m <- metaprop(x, n)
  res <- list(method = m$method, TE.common = m$TE.common, seTE.common = m$seTE.common, TE.random = m$TE.random,
              seTE.random = m$seTE.random, tau2 = m$tau2, Q = m$Q, df.Q = m$df.Q, Q.LRT = m$Q.LRT, df.Q.LRT = m$df.Q.LRT,
              lower.random = m$lower.random, upper.random = m$upper.random, method.random.ci = m$method.random.ci)
  gc <- glm(cbind(x, n - x) ~ 1, family = binomial)
  res$common_glm <- c(TE = unname(coef(gc)) - m$TE.common, se = sqrt(vcov(gc)[1, 1]) - m$seTE.common)
  for (K in c(1, 7, 10, 20)) {
    g <- glmer(cbind(x, n - x) ~ 1 + (1 | st), family = binomial, nAGQ = K)
    res[[paste0("glmer_nAGQ", K)]] <- c(TE = unname(fixef(g)) - m$TE.random, se = sqrt(vcov(g)[1, 1]) - m$seTE.random,
                                        tau2 = as.numeric(VarCorr(g)$st) - m$tau2)
  }
  rg <- rma.glmm(measure = "PLO", xi = x, ni = n)
  res$rma_glmm <- c(TE = rg$b[1] - m$TE.random, se = rg$se - m$seTE.random, tau2 = rg$tau2 - m$tau2, QE.Wld = rg$QE.Wld, QE.LRT = rg$QE.LRT)
  out[[nm]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
