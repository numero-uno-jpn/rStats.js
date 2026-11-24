# psm112-edge-iter.R: how clogit(method = "exact") counts its iterations when they run out (separated data, small
# iter.max), next to "approximate" (1.12.0). Public functions only. Output: text, 17 digits.
suppressPackageStartupMessages(library(survival))
d <- data.frame(s = rep(1:6, each = 2), y = rep(c(1, 0), 6), x = rep(c(1, 0), 6))
for (meth in c("exact", "approximate")) for (k in c(1, 2, 3, 5)) {
  fit <- suppressWarnings(clogit(y ~ x + strata(s), data = d, method = meth, iter.max = k))
  cat(sprintf("%-11s iter.max=%d coef=%.17g iter=%d loglik=%.17g\n", meth, k, coef(fit), fit$iter, fit$loglik[2]))
}
