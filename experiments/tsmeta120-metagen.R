# tsmeta120-metagen.R: meta's metagen (1.20.0), first meta-analysis experiment. The defaults (gs()) and metagen's
# results against metafor's rma / confint / predict (already reproduced by rStats.js, oracle/meta-behaviour.md), with
# candidates written for this experiment from the meta help pages and the papers they cite (DerSimonian and Laird
# 1986; Viechtbauer 2005; Hartung and Knapp 2001; Higgins and Thompson 2002; Higgins, Thompson and Spiegelhalter 2009):
#   common: TE = sum w y / sum w, w = 1 / se^2, se = 1 / sqrt(sum w), normal CI;
#   random: rma(yi, sei = seTE, method = method.tau) estimate and se; CI classic (z) or HK (test = "knha");
#   Q, df, pval.Q; tau2 (and tau) with its CI by the Q-profile (confint.rma) beside meta's lower.tau2 / upper.tau2;
#   H = sqrt(Q / df) and I2 = (Q - df) / Q with the Higgins-Thompson CI (from the CI of log H); prediction interval
#   candidates: P1 TE.random +- t_{k-2} sqrt(tau2 + se^2) (Higgins et al. 2009), P2 with z (metafor's predict);
#   the weights w.common, w.random (1 / (se^2 + tau2)).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")),
            metafor = as.character(packageVersion("metafor")))
out$settings <- lapply(c("method.tau", "method.tau.ci", "method.random.ci", "method.common.ci", "method.predict", "method.I2",
                         "level", "level.ma", "level.predict", "level.hetstat", "common", "random", "prediction", "adhoc.hakn.ci",
                         "adhoc.hakn.pi", "tau.common", "test.subgroup"), function(s) gs(s))
names(out$settings) <- c("method.tau", "method.tau.ci", "method.random.ci", "method.common.ci", "method.predict", "method.I2",
                         "level", "level.ma", "level.predict", "level.hetstat", "common", "random", "prediction", "adhoc.hakn.ci",
                         "adhoc.hakn.pi", "tau.common", "test.subgroup")
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
y <- as.numeric(es$yi); seY <- sqrt(as.numeric(es$vi)); k <- length(y)
res <- list()
for (mt in c("REML", "DL", "PM", "ML", "SJ")) for (rci in c("classic", "HK")) {
  m <- metagen(y, seY, method.tau = mt, method.random.ci = rci, prediction = TRUE)
  r <- rma(yi = y, sei = seY, method = mt, test = if (rci == "HK") "knha" else "z")
  ci <- confint(r)$random
  w <- 1 / seY^2; TEc <- sum(w * y) / sum(w)
  H <- sqrt(m$Q / m$df.Q)
  P1 <- r$b[1] + c(-1, 1) * qt(0.975, k - 2) * sqrt(r$tau2 + r$se^2)
  res[[paste(mt, rci)]] <- list(
    TE.common = m$TE.common - TEc, seTE.common = m$seTE.common - 1 / sqrt(sum(w)),
    TE.random = m$TE.random - r$b[1], seTE.random = m$seTE.random - r$se, lower.random = m$lower.random - r$ci.lb,
    upper.random = m$upper.random - r$ci.ub, Q = m$Q - r$QE, tau2 = m$tau2 - r$tau2,
    lower.tau2 = m$lower.tau2 - ci["tau^2", "ci.lb"], upper.tau2 = m$upper.tau2 - ci["tau^2", "ci.ub"],
    I2 = m$I2 - max(0, (m$Q - m$df.Q) / m$Q), H = m$H - H,
    lower.predict = m$lower.predict - P1[1], upper.predict = m$upper.predict - P1[2],
    w.random = max(abs(m$w.random - 1 / (seY^2 + r$tau2))),
    raw = list(lower.I2 = m$lower.I2, upper.I2 = m$upper.I2, lower.H = m$lower.H, upper.H = m$upper.H, df.Q = m$df.Q,
               pval.Q = m$pval.Q, df.random = m$df.random, pval.random = m$pval.random, statistic.random = m$statistic.random,
               seTE.predict = m$seTE.predict, lower.predict = m$lower.predict, k = m$k, method.predict = m$method.predict,
               se.tau2 = m$se.tau2, tau = m$tau, lower.tau = m$lower.tau, upper.tau = m$upper.tau,
               r_I2 = r$I2, r_H2 = r$H2, ci_I2 = unname(ci["I^2(%)", ]), ci_H2 = unname(ci["H^2", ])))
}
out$metagen <- res
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
