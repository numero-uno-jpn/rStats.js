# tsmeta120-metagen3.R: meta's metagen, third experiment (1.20.0): the H / I2 interval when Q <= k, and the "J" / "BJ"
# tau2 intervals. Candidates written for this experiment (Higgins and Thompson 2002; Jackson 2013; Biggerstaff and
# Jackson 2008):
#   H interval when Q <= k: centre log H (C0), log max(H, 1) (C1); se of log H by the small-Q formula; the bounds
#     clamped at 1 (B1) or not (B0);
#   "J" = metafor's generalised Q interval with weights 1 / se (rma(method = "GENQ", weights = 1 / se) + confint), and
#   "BJ" = the same with weights 1 / se^2.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
set.seed(72)
sets <- list(k5 = list(c(0.3, 0.1, 0.25, 0.4, 0.2), c(0.15, 0.2, 0.1, 0.3, 0.12)), lowQ = list(c(0.21, 0.2, 0.19, 0.22, 0.2, 0.18), rep(0.1, 6)),
             mid = list(rnorm(8, 0.3, 0.15), runif(8, 0.1, 0.3)), bcg = list(as.numeric(es$yi), sqrt(as.numeric(es$vi))),
             k4 = list(c(0.5, 0.1, 0.3, 0.2), c(0.2, 0.25, 0.15, 0.3)))
for (nm in names(sets)) {
  y <- sets[[nm]][[1]]; s <- sets[[nm]][[2]]; k <- length(y)
  m <- metagen(y, s, method.tau = "DL"); Q <- m$Q; df <- k - 1; H <- sqrt(Q / df)
  seS <- sqrt(1 / (2 * (k - 2)) * (1 - 1 / (3 * (k - 2)^2))); seL <- 0.5 * (log(Q) - log(df)) / (sqrt(2 * Q) - sqrt(2 * k - 3))
  se1 <- if (Q > k) seL else seS
  v <- list()
  for (cen in c("C0", "C1")) for (b in c("B0", "B1")) {
    c0 <- if (cen == "C0") log(H) else log(max(H, 1))
    lo <- exp(c0 - qnorm(0.975) * se1); hi <- exp(c0 + qnorm(0.975) * se1)
    if (b == "B1") { lo <- max(1, lo); hi <- max(1, hi) }
    v[[paste(cen, b)]] <- c(lower = m$lower.H - lo, upper = m$upper.H - hi)
  }
  gJ <- tryCatch(confint(rma(yi = y, sei = s, method = "GENQ", weights = 1 / s))$random["tau^2", ], error = function(e) c(NA, NA, NA))
  gB <- tryCatch(confint(rma(yi = y, sei = s, method = "GENQ", weights = 1 / s^2))$random["tau^2", ], error = function(e) c(NA, NA, NA))
  mJ <- metagen(y, s, method.tau = "DL", method.tau.ci = "J"); mB <- metagen(y, s, method.tau = "DL", method.tau.ci = "BJ")
  out[[nm]] <- list(k = k, Q = Q, H = H, R_H = c(m$lower.H, m$upper.H), R_I2 = c(m$lower.I2, m$upper.I2), variants = v,
                    J = c(mJ$lower.tau2 - gJ[2], mJ$upper.tau2 - gJ[3]), BJ = c(mB$lower.tau2 - gB[2], mB$upper.tau2 - gB[3]))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
