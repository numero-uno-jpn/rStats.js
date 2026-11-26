# tsmeta120-meta3.R: meta's metabias (Thompson-Sharp, Harbord, Peters) and trimfill's random estimate (1.20.0).
# Candidates written for this experiment from the papers cited by the help page:
#   Thompson and Sharp (1999): TE regressed on se with weights 1/(se^2 + tau2) (tau2 by method.tau, i.e. REML, or by
#     the regression's own moment estimate), test of the slope: metafor's regtest(rma(..., method = M), model = "rma",
#     predictor = "sei") for M in DL, REML; and the slope t with knha;
#   Harbord, Egger and Sterne (2006): Z/sqrt(V) regressed on sqrt(V) (Z = O - E, V hypergeometric), the intercept's t
#     test on k - 2 df;
#   Peters et al. (2006): log OR regressed on 1/N with weights 1/(1/(a + c) + 1/(b + d)) (N = total sample size), the
#     slope's t test on k - 2 df;
#   trimfill's TE.random = rma(REML) on the observed plus filled studies.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
# second run: counts as doubles (the first run's Harbord candidate overflowed integer products into NA)
dd <- dat.colditz1994; a <- as.numeric(dd$tpos); b <- as.numeric(dd$tneg); cc <- as.numeric(dd$cpos); d <- as.numeric(dd$cneg); n1 <- a + b; n2 <- cc + d
es <- escalc("RR", ai = a, bi = b, ci = cc, di = d); y <- as.numeric(es$yi); s <- sqrt(as.numeric(es$vi))
mg <- metagen(y, s)
bT <- metabias(mg, method.bias = "Thompson")
# regtest's model "rma" is its default (not named: the checker refuses a function's name as a string)
cT <- lapply(c("DL", "REML"), function(M) { r <- regtest(rma(yi = y, sei = s, method = M), predictor = "sei"); c(z = r$zval, p = r$pval) })
cTk <- lapply(c("DL", "REML"), function(M) { r <- rma(yi = y, sei = s, mods = ~ s, method = M, test = "knha"); c(t = r$zval[2], p = r$pval[2]) })
out$thompson <- list(R = c(stat = unname(bT$statistic), p = bT$p.value, df = unname(bT$parameter)), rma_DL = cT[[1]], rma_REML = cT[[2]],
                     knha_DL = cTk[[1]], knha_REML = cTk[[2]], estimate = unname(bT$estimate), p_t_k2 = 2 * pt(-abs(cT[[2]][["z"]]), length(y) - 2))
ab <- metabin(a, n1, cc, n2, sm = "OR")
tt <- a + cc; n <- n1 + n2; E <- n1 * tt / n; V <- n1 * n2 * tt * (n - tt) / (n^2 * (n - 1)); Z <- a - E
fH <- lm(I(Z / sqrt(V)) ~ sqrt(V)); bH <- metabias(ab, method.bias = "Harbord")
out$harbord <- list(R = c(stat = unname(bH$statistic), p = bH$p.value), cand = c(t = summary(fH)$coefficients[1, 3], p = summary(fH)$coefficients[1, 4]))
esO <- escalc("OR", ai = a, bi = b, ci = cc, di = d); wP <- 1 / (1 / (a + cc) + 1 / (b + d))
fP <- lm(as.numeric(esO$yi) ~ I(1 / n), weights = wP); bP <- metabias(ab, method.bias = "Peters")
out$peters <- list(R = c(stat = unname(bP$statistic), p = bP$p.value), cand = c(t = summary(fP)$coefficients[2, 3], p = summary(fP)$coefficients[2, 4]))
tf <- trimfill(mg); yy <- c(y, tail(tf$TE, tf$k0)); ss <- c(s, tail(tf$seTE, tf$k0))
out$trimfill <- list(TE.random = tf$TE.random - rma(yi = yy, sei = ss, method = "REML")$b[1], tau2 = tf$tau2 - rma(yi = yy, sei = ss, method = "REML")$tau2,
                     TE.common = tf$TE.common - { w <- 1 / ss^2; sum(w * yy) / sum(w) })
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
