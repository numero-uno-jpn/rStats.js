# issue: 570
# oracle-platform: amd64
# Public outputs of meta 8.5.0 (metagen, metabin, metacont, metainc, metacor, metamean, metarate, metaprop, subgroups,
# metabias, trimfill, metareg, metainf, metacum) for test/fixtures/meta.json (1.20.0). The behaviour is in
# oracle/tsmeta-behaviour.md (Part 2); the experiments behind it in experiments/tsmeta120-meta*.R (log 61-70, 75-76).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
FIELDS <- c("TE.common", "seTE.common", "lower.common", "upper.common", "statistic.common", "pval.common",
            "TE.random", "seTE.random", "lower.random", "upper.random", "statistic.random", "pval.random", "df.random",
            "seTE.predict", "lower.predict", "upper.predict", "df.predict", "Q", "df.Q", "pval.Q", "tau2", "lower.tau2", "upper.tau2",
            "tau", "lower.tau", "upper.tau", "H", "lower.H", "upper.H", "I2", "lower.I2", "upper.I2", "w.common", "w.random", "k", "TE", "seTE")
pick <- function(m) { r <- lapply(FIELDS, function(f) if (is.null(m[[f]])) NULL else unname(m[[f]])); names(r) <- FIELDS; r }
out <- list()
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
set.seed(72)
sets <- list(bcg = list(as.numeric(es$yi), sqrt(as.numeric(es$vi))), k5 = list(c(0.3, 0.1, 0.25, 0.4, 0.2), c(0.15, 0.2, 0.1, 0.3, 0.12)),
             lowQ = list(c(0.21, 0.2, 0.19, 0.22, 0.2, 0.18), rep(0.1, 6)), mid = list(rnorm(8, 0.3, 0.15), runif(8, 0.1, 0.3)),
             k4 = list(c(0.5, 0.1, 0.3, 0.2), c(0.2, 0.25, 0.15, 0.3)), k3 = list(c(1.2, 0.4, -0.1), c(0.3, 0.25, 0.4)),
             k30 = list(rnorm(30, -0.2, 0.3), runif(30, 0.05, 0.5)))
mg <- list()
for (nm in names(sets)) {
  y <- sets[[nm]][[1]]; s <- sets[[nm]][[2]]
  cases <- list()
  for (mt in c("REML", "DL", "PM", "ML", "SJ", "HE", "EB", "HS")) for (ci in c("classic", "HK")) {
    m <- metagen(y, s, method.tau = mt, method.random.ci = ci, prediction = TRUE)
    cases[[paste(mt, ci)]] <- pick(m)
  }
  for (tci in c("QP", "J", "BJ")) cases[[paste("REML tauci", tci)]] <- pick(metagen(y, s, method.tau = "REML", method.tau.ci = tci))
  cases[["DL tauci QP"]] <- pick(metagen(y, s, method.tau = "DL", method.tau.ci = "QP"))
  cases[["level90"]] <- pick(metagen(y, s, level.ma = 0.9, prediction = TRUE, level.predict = 0.8))
  mg[[nm]] <- list(TE = y, seTE = s, cases = cases)
}
out$metagen <- mg
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "meta.json"))
