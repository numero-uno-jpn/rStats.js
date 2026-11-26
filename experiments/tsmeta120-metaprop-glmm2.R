# tsmeta120-metaprop-glmm2.R: metaprop's GLMM heterogeneity statistics (1.20.0; the GLMM brought into scope by the
# user, 2026-11-27). meta reports two Q values equal to metafor's rma.glmm QE.Wld and QE.LRT (log item 75). Candidates
# written for this experiment (metafor's help for rma.glmm: "Wald-type and likelihood ratio tests for heterogeneity"):
#   LRT: L1 the residual deviance of glm(cbind(x, n - x) ~ 1, binomial) (equal-effects against the saturated model);
#   Wald: W1 Cochran's Q of the study logits (x + 0.5 / n + 1 for 0 or n) with inverse-variance weights about their IV
#     estimate; W2 about the glm's common estimate; W3 the Wald chi-square of glm(cbind ~ factor(study)) for all
#     study effects equal (on the studies without 0 or n); df = k - 1 (or the studies used);
#   the p-values (chi-squared on df);
#   second run: W4 the Wald chi-square of glm(cbind ~ factor(study)) on ALL studies (a study with 0 or n events
#     diverges in glm's iterations and contributes almost nothing), with glm's iteration count and convergence flag.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
set.seed(91)
sets <- list(k6 = list(x = c(4, 0, 15, 22, 9, 12), n = c(40, 25, 60, 70, 45, 50)),
             k10 = { n <- sample(30:120, 10); list(x = rbinom(10, n, plogis(rnorm(10, -1, 0.6))), n = n) },
             nozero = list(x = c(5, 9, 14, 3, 20, 11, 7), n = c(50, 60, 70, 40, 90, 55, 45)))
for (nm in names(sets)) {
  x <- sets[[nm]]$x; n <- sets[[nm]]$n; k <- length(x)
  m <- metaprop(x, n); rg <- rma.glmm(measure = "PLO", xi = x, ni = n)
  gc <- glm(cbind(x, n - x) ~ 1, family = binomial)
  z <- x == 0 | x == n; xi <- x + ifelse(z, 0.5, 0); ni <- n + ifelse(z, 1, 0)
  y <- log(xi / (ni - xi)); v <- 1 / xi + 1 / (ni - xi); w <- 1 / v
  W1 <- sum(w * (y - sum(w * y) / sum(w))^2); W2 <- sum(w * (y - coef(gc))^2)
  ok <- !z; st <- factor(seq_len(k))[ok]
  gs3 <- glm(cbind(x[ok], n[ok] - x[ok]) ~ st, family = binomial); b <- coef(gs3)[-1]; V <- vcov(gs3)[-1, -1]
  W3 <- drop(t(b) %*% solve(V) %*% b)
  st4 <- factor(seq_len(k)); g4 <- suppressWarnings(glm(cbind(x, n - x) ~ st4, family = binomial))
  b4 <- coef(g4)[-1]; V4 <- vcov(g4)[-1, -1]; W4 <- drop(t(b4) %*% solve(V4) %*% b4)
  out[[nm]] <- list(W4 = W4, glm_iter = g4$iter, glm_converged = g4$converged, R_Q = m$Q, R_df = m$df.Q, R_pval = m$pval.Q, QE.Wld = rg$QE.Wld, QE.LRT = rg$QE.LRT, QE.df = rg$QE.df,
                    L1 = deviance(gc), W1 = W1, W2 = W2, W3 = W3, k_ok = sum(ok))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
