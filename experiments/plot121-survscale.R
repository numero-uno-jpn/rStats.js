# plot121-survscale.R: survfit with times at tiny and huge scales (1.21.0, experiment 6). rStats.js's survfit merged
# the times 1e-150, 2e-150, 3e-150, 4e-150 into one (surv 0.25); does R's (with its documented timefix, aeqSurv)?
# Also meta's metagen at 1e300 and 1e-300 times the help-page-like data: tau2, tau and the weights.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(survival); library(meta) })
out <- list(R = R.version.string, arch = R.version$arch)
sv <- list()
for (s in c(1e-300, 1e-150, 1e-8, 1, 1e150, 1e300)) {
  f <- survfit(Surv(c(1, 2, 3, 4) * s, c(1, 0, 1, 1)) ~ 1)
  g <- survfit(Surv(c(1, 2, 3, 4) * s, c(1, 0, 1, 1)) ~ 1, timefix = FALSE)
  sv[[format(s)]] <- list(scale = s, time = f$time, surv = f$surv, timeNoFix = g$time, survNoFix = g$surv)
}
out$survfit <- sv
mg <- list()
for (s in c(1e-300, 1, 1e300)) {
  # (the first run stopped here at 1e-300: "Division by zero when computing the inverse variance weights")
  m <- tryCatch(metagen(c(0.21, 0.52, -0.08) * s, c(0.11, 0.21, 0.16) * s), error = function(e) conditionMessage(e))
  mg[[format(s)]] <- if (is.character(m)) list(scale = s, error = m) else
    list(scale = s, tau2 = m$tau2, tau = m$tau, wc = m$w.common, wr = m$w.random, TEr = m$TE.random)
}
out$metagen <- mg
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = TRUE))
