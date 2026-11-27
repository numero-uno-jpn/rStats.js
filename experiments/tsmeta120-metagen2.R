# tsmeta120-metagen2.R: meta's metagen, second experiment (1.20.0): the three departures from metafor found in
# tsmeta120-metagen. Candidates written for this experiment from the papers cited by the help pages:
#   H and I2 intervals (Higgins and Thompson 2002, appendix): log H +- z se, se = 0.5 (log Q - log df) / (sqrt(2Q) -
#     sqrt(2k - 3)) when Q > k, else sqrt(1 / (2 (k - 2)) (1 - 1 / (3 (k - 2)^2))); H bounds at least 1; I2 = 1 - 1/H^2
#     clamped at 0;
#   the default tau2 interval with DL: meta's own method.tau.ci options "QP", "BJ", "J", "PL" recorded, to see which
#     the default equals for each method.tau;
#   prediction intervals: method.predict "V" (the default) against TE.random +- q sqrt(tau2 + seTE.random^2) with q
#     from z (P2), t(k - 1) (P3), t(k - 2) (P1); and the other method.predict values ("HTS", "HK", "S", "KR", "NNF") as
#     recorded;
#   several data sets (k = 3, 5, 13, 30; one with Q < k).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
set.seed(71)
sets <- list(bcg = list(as.numeric(es$yi), sqrt(as.numeric(es$vi))),
             k3 = list(c(0.1, 0.5, -0.2), c(0.2, 0.3, 0.25)), k5 = list(c(0.3, 0.1, 0.25, 0.4, 0.2), c(0.15, 0.2, 0.1, 0.3, 0.12)),
             lowQ = list(c(0.21, 0.2, 0.19, 0.22, 0.2, 0.18), rep(0.1, 6)), k30 = list(rnorm(30, 0.2, 0.3), runif(30, 0.1, 0.4)))
for (nm in names(sets)) {
  y <- sets[[nm]][[1]]; s <- sets[[nm]][[2]]; k <- length(y)
  res <- list()
  for (mt in c("REML", "DL", "PM")) {
    m <- metagen(y, s, method.tau = mt, prediction = TRUE)
    Q <- m$Q; df <- k - 1
    seLH <- if (Q > k) 0.5 * (log(Q) - log(df)) / (sqrt(2 * Q) - sqrt(2 * k - 3)) else sqrt(1 / (2 * (k - 2)) * (1 - 1 / (3 * (k - 2)^2)))
    H <- sqrt(Q / df); Hl <- max(1, exp(log(H) - qnorm(0.975) * seLH)); Hu <- max(1, exp(log(H) + qnorm(0.975) * seLH))
    tci <- sapply(c("QP", "BJ", "J"), function(tm) { mm <- tryCatch(metagen(y, s, method.tau = mt, method.tau.ci = tm), error = function(e) NULL)
      if (is.null(mm)) c(NA, NA) else c(mm$lower.tau2, mm$upper.tau2) })
    sp <- sqrt(m$tau2 + m$seTE.random^2)
    pr <- sapply(c("HTS", "HK", "S", "KR", "NNF"), function(pm) { mm <- tryCatch(metagen(y, s, method.tau = mt, prediction = TRUE, method.predict = pm),
      error = function(e) NULL); if (is.null(mm)) c(NA, NA, NA) else c(mm$lower.predict, mm$upper.predict, mm$seTE.predict) })
    res[[mt]] <- list(lowerH = m$lower.H - Hl, upperH = m$upper.H - Hu, lowerI2 = m$lower.I2 - max(0, 1 - 1 / Hl^2), upperI2 = m$upper.I2 - max(0, 1 - 1 / Hu^2),
                      default_tau_ci = c(m$lower.tau2, m$upper.tau2), method.tau.ci = m$method.tau.ci, by_option = tci,
                      predV = c(m$lower.predict, m$upper.predict, m$seTE.predict),
                      P2 = m$lower.predict - (m$TE.random - qnorm(0.975) * sp), P3 = m$lower.predict - (m$TE.random - qt(0.975, k - 1) * sp),
                      P1 = m$lower.predict - (m$TE.random - qt(0.975, k - 2) * sp), seTE.predict = m$seTE.predict - sp,
                      others = pr, df.predict = m$df.predict, TE.random = m$TE.random, tau2 = m$tau2, seTE.random = m$seTE.random)
  }
  out[[nm]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
