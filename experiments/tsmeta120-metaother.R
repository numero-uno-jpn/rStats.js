# tsmeta120-metaother.R: meta's metacont, metainc, metacor, metamean, metarate and metaprop (1.20.0), first experiment.
# Their defaults (gs()) and study-level TE / seTE against metafor's escalc measures, the pooled values against rma
# (REML) — candidates written for this experiment from the help pages (Hedges 1981 for SMD; Rothman et al. for
# incidence rates; Fisher's z for correlations; Freeman-Tukey for proportions):
#   metacont MD = MD; SMD (method.smd "Hedges") = SMD with the exact or approximate J (escalc "SMD" uses exact J), and
#     the variance variants; ROM = ROM;
#   metainc IRR = IRR (log rate ratio, increment 0.5 for zero events), IRD = IRD, method MH (Greenland-Robins for
#     rates) recorded;
#   metacor ZCOR (default sm) = ZCOR; COR = COR;
#   metamean MRAW = MN, MLN = MNLN; metarate IR = IR, IRLN = IRLN, IRS = IRS, IRFT = IRFT;
#   metaprop PLOGIT = PLO, PFT = PFT, PAS = PAS, PRAW = PR, PLN = PLN, with method = "Inverse" (the default method is
#     recorded: it may be GLMM, out of scope).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
out$settings <- setNames(lapply(c("smcont", "method.smd", "sd.glass", "exact.smd", "sminc", "smcor", "smmean", "smrate", "smprop", "method.prop",
                                  "incr", "method.incr"), function(s) gs(s)),
                         c("smcont", "method.smd", "sd.glass", "exact.smd", "sminc", "smcor", "smmean", "smrate", "smprop", "method.prop", "incr", "method.incr"))
cmp <- function(m, e, keep = TRUE) c(TE = max(abs(m$TE[keep] - as.numeric(e$yi)[keep]), na.rm = TRUE),
                                     se = max(abs(m$seTE[keep] - sqrt(as.numeric(e$vi))[keep]), na.rm = TRUE),
                                     pooled = { r <- rma(yi = as.numeric(e$yi)[keep], vi = as.numeric(e$vi)[keep], method = "REML")
                                       abs(m$TE.random - r$b[1]) })
r <- list()
n1 <- c(20, 35, 50, 41, 28); m1 <- c(10.2, 11.5, 9.8, 12.1, 10.9); s1 <- c(2.1, 2.5, 1.9, 3.0, 2.2)
n2 <- c(22, 33, 48, 40, 30); m2 <- c(9.1, 10.2, 9.9, 10.5, 9.4); s2 <- c(2.3, 2.4, 2.0, 2.8, 2.5)
r$cont_MD <- cmp(metacont(n1, m1, s1, n2, m2, s2, sm = "MD"), escalc("MD", n1i = n1, m1i = m1, sd1i = s1, n2i = n2, m2i = m2, sd2i = s2))
mS <- metacont(n1, m1, s1, n2, m2, s2, sm = "SMD")
r$cont_SMD_exactJ <- cmp(mS, escalc("SMD", n1i = n1, m1i = m1, sd1i = s1, n2i = n2, m2i = m2, sd2i = s2))
r$cont_SMD_approxJ <- cmp(mS, escalc("SMD", n1i = n1, m1i = m1, sd1i = s1, n2i = n2, m2i = m2, sd2i = s2, correct = FALSE))
r$cont_SMD_vtype <- cmp(mS, escalc("SMD", n1i = n1, m1i = m1, sd1i = s1, n2i = n2, m2i = m2, sd2i = s2, vtype = "LS2"))
r$cont_ROM <- cmp(metacont(n1, m1, s1, n2, m2, s2, sm = "ROM"), escalc("ROM", n1i = n1, m1i = m1, sd1i = s1, n2i = n2, m2i = m2, sd2i = s2))
e1 <- c(3, 0, 12, 7, 5); t1 <- c(1200, 800, 3100, 1500, 2000); e2 <- c(6, 2, 15, 3, 9); t2 <- c(1100, 900, 2900, 1600, 2100)
inc <- ifelse(e1 == 0 | e2 == 0, 0.5, 0)
r$inc_IRR <- cmp(metainc(e1, t1, e2, t2, sm = "IRR", method = "Inverse"), escalc("IRR", x1i = e1 + inc, t1i = t1, x2i = e2 + inc, t2i = t2))
r$inc_IRD <- cmp(metainc(e1, t1, e2, t2, sm = "IRD", method = "Inverse"), escalc("IRD", x1i = e1, t1i = t1, x2i = e2, t2i = t2))
mI <- metainc(e1, t1, e2, t2); out$metainc_default <- list(sm = mI$sm, method = mI$method, TE.common = mI$TE.common, seTE.common = mI$seTE.common)
cr <- c(0.31, 0.45, 0.12, 0.6, 0.38); nc <- c(40, 85, 120, 33, 64)
r$cor_ZCOR <- cmp(metacor(cr, nc), escalc("ZCOR", ri = cr, ni = nc)); r$cor_COR <- cmp(metacor(cr, nc, sm = "COR"), escalc("COR", ri = cr, ni = nc))
r$mean_MRAW <- cmp(metamean(n1, m1, s1), escalc("MN", ni = n1, mi = m1, sdi = s1)); r$mean_MLN <- cmp(metamean(n1, m1, s1, sm = "MLN"), escalc("MNLN", ni = n1, mi = m1, sdi = s1))
r$rate_IR <- cmp(metarate(e1 + inc, t1, sm = "IR"), escalc("IR", xi = e1 + inc, ti = t1))
r$rate_IRLN <- cmp(metarate(e1, t1, sm = "IRLN"), escalc("IRLN", xi = e1 + inc, ti = t1)); r$rate_IRS <- cmp(metarate(e1, t1, sm = "IRS"), escalc("IRS", xi = e1, ti = t1))
r$rate_IRFT <- cmp(metarate(e1, t1, sm = "IRFT"), escalc("IRFT", xi = e1, ti = t1))
mR <- metarate(e1, t1); out$metarate_default <- list(sm = mR$sm, method = mR$method)
xp <- c(4, 0, 15, 22, 9); np <- c(40, 25, 60, 70, 45); incp <- ifelse(xp == 0 | xp == np, 0.5, 0)
r$prop_PLOGIT <- cmp(metaprop(xp, np, sm = "PLOGIT", method = "Inverse"), escalc("PLO", xi = xp + incp, ni = np + 2 * incp))
r$prop_PFT <- cmp(metaprop(xp, np, sm = "PFT", method = "Inverse"), escalc("PFT", xi = xp, ni = np))
r$prop_PAS <- cmp(metaprop(xp, np, sm = "PAS", method = "Inverse"), escalc("PAS", xi = xp, ni = np))
r$prop_PRAW <- cmp(metaprop(xp, np, sm = "PRAW", method = "Inverse"), escalc("PR", xi = xp + incp, ni = np + 2 * incp))
r$prop_PLN <- cmp(metaprop(xp, np, sm = "PLN", method = "Inverse"), escalc("PLN", xi = xp + incp, ni = np + 2 * incp))
mP <- metaprop(xp, np); out$metaprop_default <- list(sm = mP$sm, method = mP$method)
out$cmp <- r
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
