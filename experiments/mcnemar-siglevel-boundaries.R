# issue: 527
# Probe exact2x2's public McNemar power over significance levels and errbound.
alphas <- c(0, 0.05, 0.1, 0.2, 0.5, 0.9, 0.99, 0.999, 1)
bounds <- c(0, 1e-12, 1e-8, 1e-6, 1e-3)
methods <- c("central", "minlike", "blaker")
for (method in methods) {
  for (alpha in alphas) {
    for (bound in bounds) {
      ans <- exact2x2::powerPaired2x2(
        pb = 0.5, pc = 0.3, npairs = 40,
        sig.level = alpha, errbound = bound, tsmethod = method
      )
      cat(sprintf("method=%s alpha=%.17g errbound=%.17g power=%.17g note=%s\n",
                  method, alpha, bound, ans$power, ans$note))
    }
  }
}
cat("-- strict and alternative probes at alpha 0.5, 0.9, 0.99, 1 --\n")
for (alpha in c(0.5, 0.9, 0.99, 1)) {
  for (strict in c(FALSE, TRUE)) {
    for (alternative in c("two.sided", "one.sided")) {
      ans <- exact2x2::powerPaired2x2(
        pb = 0.5, pc = 0.3, npairs = 40,
        sig.level = alpha, errbound = 0, strict = strict, alternative = alternative
      )
      cat(sprintf("strict=%s alternative=%s alpha=%.17g power=%.17g\n",
                  strict, alternative, alpha, ans$power))
    }
  }
}
