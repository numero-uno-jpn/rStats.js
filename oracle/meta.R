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
# metabin (log 64-65)
data(Fleiss1993bin, package = "meta")
fl <- Fleiss1993bin
zero <- data.frame(e1 = c(0, 3, 5, 0, 12, 0, 7), n1 = c(20, 30, 40, 25, 60, 15, 33), e2 = c(2, 0, 8, 0, 15, 3, 7), n2 = c(22, 28, 41, 24, 58, 16, 33))
full <- data.frame(e1 = c(10, 20, 5), n1 = c(10, 40, 30), e2 = c(8, 18, 0), n2 = c(9, 41, 32))
bsets <- list(fleiss = list(fl$d.asp, fl$n.asp, fl$d.plac, fl$n.plac), zero = list(zero$e1, zero$n1, zero$e2, zero$n2), full = list(full$e1, full$n1, full$e2, full$n2))
mb <- list()
for (nm in names(bsets)) {
  b <- bsets[[nm]]; cases <- list()
  for (sm in c("RR", "OR", "RD")) for (meth in c("MH", "Inverse")) for (mt in c("REML", "DL")) {
    m <- metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = sm, method = meth, method.tau = mt)
    cases[[paste(sm, meth, mt)]] <- pick(m)
  }
  cases[["OR Peto REML"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "OR", method = "Peto"))
  cases[["OR Peto DL"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "OR", method = "Peto", method.tau = "DL"))
  cases[["OR MH REML exact"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "OR", MH.exact = TRUE))
  cases[["RR MH REML allstudies"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "RR", allstudies = TRUE))
  cases[["OR MH REML incr1"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "OR", incr = 1))
  cases[["OR MH REML all"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "OR", method.incr = "all"))
  cases[["OR MH REML if0all"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "OR", method.incr = "if0all"))
  cases[["RR MH DL QnotCochrane"]] <- pick(metabin(b[[1]], b[[2]], b[[3]], b[[4]], sm = "RR", method.tau = "DL", Q.Cochrane = FALSE))
  mb[[nm]] <- list(e1 = b[[1]], n1 = b[[2]], e2 = b[[3]], n2 = b[[4]], cases = cases)
}
out$metabin <- mb
# metacont, metainc, metacor, metamean, metarate, metaprop (inverse variance; log 66-67, 69)
set.seed(73)
cont <- data.frame(n1 = c(20, 35, 50, 12, 80), m1 = c(5.1, 4.8, 6.0, 5.5, 4.9), sd1 = c(1.2, 1.5, 1.1, 2.0, 1.3), n2 = c(22, 30, 48, 15, 75), m2 = c(4.6, 4.9, 5.2, 4.1, 4.7), sd2 = c(1.1, 1.4, 1.3, 1.8, 1.2))
oc <- list(data = cont, cases = list())
for (sm in c("MD", "SMD", "ROM")) for (mt in c("REML", "DL")) oc$cases[[paste(sm, mt)]] <- pick(metacont(cont$n1, cont$m1, cont$sd1, cont$n2, cont$m2, cont$sd2, sm = sm, method.tau = mt))
inc <- data.frame(e1 = c(5, 0, 12, 3, 8, 0), t1 = c(1000, 800, 2500, 600, 1500, 900), e2 = c(9, 2, 15, 0, 10, 0), t2 = c(1100, 750, 2400, 650, 1400, 950))
oi <- list(data = inc, cases = list())
for (sm in c("IRR", "IRD")) for (meth in c("MH", "Inverse")) oi$cases[[paste(sm, meth)]] <- pick(metainc(inc$e1, inc$t1, inc$e2, inc$t2, sm = sm, method = meth))
cr <- data.frame(r = c(0.3, 0.45, 0.12, 0.6, -0.05, 0.38), n = c(50, 120, 35, 80, 60, 200))
ocr <- list(data = cr, cases = list(ZCOR = pick(metacor(cr$r, cr$n)), COR = pick(metacor(cr$r, cr$n, sm = "COR"))))
mn <- data.frame(n = c(30, 45, 25, 60), mean = c(12.1, 10.5, 13.4, 11.8), sd = c(3.2, 2.9, 4.1, 3.0))
omn <- list(data = mn, cases = list(MRAW = pick(metamean(mn$n, mn$mean, mn$sd)), MLN = pick(metamean(mn$n, mn$mean, mn$sd, sm = "MLN"))))
rt <- data.frame(e = c(12, 0, 30, 7, 18), t = c(400, 250, 1200, 300, 800))
ort <- list(data = rt, cases = list())
for (sm in c("IRLN", "IR", "IRS", "IRFT")) ort$cases[[sm]] <- pick(metarate(rt$e, rt$t, sm = sm))
pr <- data.frame(e = c(4, 0, 15, 30, 9, 20), n = c(40, 25, 60, 30, 50, 45))
opr <- list(data = pr, cases = list())
for (sm in c("PLOGIT", "PFT", "PAS", "PRAW", "PLN")) opr$cases[[sm]] <- pick(metaprop(pr$e, pr$n, sm = sm, method = "Inverse"))
out$other <- list(metacont = oc, metainc = oi, metacor = ocr, metamean = omn, metarate = ort, metaprop = opr)
# metaprop's default GLMM (log 75-76)
set.seed(74)
gsets <- list(k6 = list(c(4, 0, 15, 30, 9, 20), c(40, 25, 60, 30, 50, 45)), k10 = list(rbinom(10, 80, 0.2), rep(80, 10)),
              k20 = { n <- sample(20:150, 20); list(rbinom(20, n, plogis(rnorm(20, -1, 0.6))), n) }, nozero = list(c(12, 18, 7, 25, 14), c(60, 70, 40, 90, 55)))
gl <- list()
for (nm in names(gsets)) {
  x <- gsets[[nm]][[1]]; n <- gsets[[nm]][[2]]
  m <- metaprop(x, n); m90 <- metaprop(x, n, level.ma = 0.9, prediction = TRUE)
  st <- factor(seq_along(x)); g <- lme4::glmer(cbind(x, n - x) ~ 1 + (1 | st), family = binomial, nAGQ = 7)
  gl[[nm]] <- list(x = x, n = n, r = pick(m), Qs = unname(m$Q), dfQs = unname(m$df.Q), pvalQs = unname(m$pval.Q), r90 = pick(m90),
                   lme4 = list(deviance = deviance(g), fixef = unname(lme4::fixef(g)), theta = unname(lme4::getME(g, "theta"))))
}
out$glmm <- gl
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "meta.json"))
