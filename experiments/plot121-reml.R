# plot121-reml.R: meta's REML tau2 iterated to the maximum (1.21.0, experiment 7). The user decided (2026-11-28) that
# rStats.js's metagen iterates REML to the maximum instead of stopping at metafor's absolute threshold (1e-5). For the
# R references: does metagen's documented `control` argument (passed to metafor's rma.uni) with threshold = 1e-12
# reach the maximum, against my REML profile likelihood (from the textbook formula) maximised by optimize? And can
# the control be set once for every call (settings.meta)?
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(meta))
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")),
            metafor = as.character(packageVersion("metafor")))
remlProfile <- function(tau2, y, v) {
  w <- 1 / (v + tau2); mu <- sum(w * y) / sum(w)
  -0.5 * sum(log(v + tau2)) - 0.5 * log(sum(w)) - 0.5 * sum(w * (y - mu)^2)
}
sets <- list(a = list(y = c(0.21, 0.52, -0.08), s = c(0.11, 0.21, 0.16)),
             b = list(y = c(0.21, 0.52, -0.08, 0.35, 0.11, 0.62), s = c(0.11, 0.21, 0.16, 0.12, 0.09, 0.3)),
             c = list(y = c(-0.89, -1.59, -1.35, -1.44, -0.22, -0.79, -1.62, 0.01, -0.47, -1.37, -0.34, 0.45, -0.02),
                      s = c(0.57, 0.44, 0.64, 0.14, 0.23, 0.06, 0.47, 0.06, 0.24, 0.27, 0.11, 0.53, 0.27)))
res <- list()
for (nm in names(sets)) {
  d <- sets[[nm]]; v <- d$s^2
  m0 <- metagen(d$y, d$s)
  m1 <- metagen(d$y, d$s, control = list(threshold = 1e-12, maxiter = 1000))
  opt <- optimize(function(t) -remlProfile(t, d$y, v), c(0, 10), tol = 1e-15)
  res[[nm]] <- list(default = m0$tau2, tight = m1$tau2, optimize = opt$minimum, TEr0 = m0$TE.random, TEr1 = m1$TE.random)
}
out$tau2 <- res
out$settings <- tryCatch({ settings.meta(control = list(threshold = 1e-12)); "accepted" }, error = function(e) conditionMessage(e),
                         warning = function(w) paste("warning:", conditionMessage(w)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = TRUE))
