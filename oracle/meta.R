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
# subgroups, metabias, trimfill, metareg, metainf, metacum, baujat (log 68-70)
bcg <- dat.colditz1994
ebcg <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = bcg)
lat <- abs(bcg$ablat); alloc <- as.character(bcg$alloc)
mbcg <- metagen(as.numeric(ebcg$yi), sqrt(as.numeric(ebcg$vi)))
sg <- list()
for (mt in c("REML", "DL")) for (tc in c(FALSE, TRUE)) {
  m <- metagen(as.numeric(ebcg$yi), sqrt(as.numeric(ebcg$vi)), subgroup = alloc, method.tau = mt, tau.common = tc)
  sg[[paste(mt, tc)]] <- list(levels = m$subgroup.levels, TE.common.w = unname(m$TE.common.w), seTE.common.w = unname(m$seTE.common.w),
    TE.random.w = unname(m$TE.random.w), seTE.random.w = unname(m$seTE.random.w), tau2.w = unname(m$tau2.w), Q.w = unname(m$Q.w), k.w = unname(m$k.w),
    Q.w.common = m$Q.w.common, Q.w.random = m$Q.w.random, Q.b.common = m$Q.b.common, Q.b.random = m$Q.b.random, df.Q.b = m$df.Q.b, df.Q.w = m$df.Q.w,
    pval.Q.b.common = m$pval.Q.b.common, pval.Q.b.random = m$pval.Q.b.random, tau2 = m$tau2, TE.random = m$TE.random, seTE.random = m$seTE.random)
}
mbsub <- metabin(fl$d.asp, fl$n.asp, fl$d.plac, fl$n.plac, sm = "OR", subgroup = c("a", "a", "b", "b", "a", "b", "a"))
sg[["metabin MH OR"]] <- list(levels = mbsub$subgroup.levels, TE.common.w = unname(mbsub$TE.common.w), seTE.common.w = unname(mbsub$seTE.common.w),
  TE.random.w = unname(mbsub$TE.random.w), seTE.random.w = unname(mbsub$seTE.random.w), Q.b.common = mbsub$Q.b.common, Q.b.random = mbsub$Q.b.random, Q.w = unname(mbsub$Q.w))
bias <- list()
bt <- function(b) list(statistic = unname(b$statistic), df = if (is.null(b$df)) NULL else unname(b$df), p = unname(b$p.value), estimate = unname(b$estimate))
for (mb in c("Egger", "Begg", "Thompson")) bias[[mb]] <- bt(metabias(mbcg, method.bias = mb, k.min = 3))
mbor <- metabin(fl$d.asp, fl$n.asp, fl$d.plac, fl$n.plac, sm = "OR")
zor <- metabin(zero$e1, zero$n1, zero$e2, zero$n2, sm = "OR")
for (mb in c("Harbord", "Peters", "Egger")) { bias[[paste("fleiss", mb)]] <- bt(metabias(mbor, method.bias = mb, k.min = 3)); bias[[paste("zero", mb)]] <- bt(metabias(zor, method.bias = mb, k.min = 3)) }
tf <- trimfill(mbcg); tfl <- trimfill(metagen(as.numeric(ebcg$yi)[-c(1, 4)], sqrt(as.numeric(ebcg$vi))[-c(1, 4)]))
tfo <- function(t) list(k0 = t$k0, TE = unname(t$TE), seTE = unname(t$seTE), TE.common = t$TE.common, seTE.common = t$seTE.common, TE.random = t$TE.random, seTE.random = t$seTE.random, tau2 = t$tau2, Q = t$Q, k = t$k)
mr <- metareg(mbcg, ~ lat); mr2 <- metareg(metagen(as.numeric(ebcg$yi), sqrt(as.numeric(ebcg$vi)), method.tau = "DL"), ~ lat + alloc)
mro <- function(r) list(beta = as.numeric(r$beta), se = unname(r$se), zval = unname(r$zval), pval = unname(r$pval), tau2 = r$tau2, QE = r$QE, QM = r$QM, QMp = r$QMp, R2 = r$R2, I2 = r$I2)
inf <- function(x) list(TE = unname(x$TE), seTE = unname(x$seTE), lower = unname(x$lower), upper = unname(x$upper), tau2 = unname(x$tau2), I2 = unname(x$I2), pval = unname(x$pval))
bj <- baujat(mbcg, plot = FALSE)
out$extra <- list(TE = as.numeric(ebcg$yi), seTE = sqrt(as.numeric(ebcg$vi)), lat = lat, alloc = alloc, subgroups = sg, bias = bias,
  trimfill = tfo(tf), trimfill_left = tfo(tfl), metareg = mro(mr), metareg2 = mro(mr2),
  metainf = inf(metainf(mbcg)), metainf_random = inf(metainf(mbcg, pooled = "random")), metacum = inf(metacum(mbcg)), metacum_random = inf(metacum(mbcg, pooled = "random")),
  baujat = list(x = unname(bj$x), y = unname(bj$y)))
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "meta.json"))
