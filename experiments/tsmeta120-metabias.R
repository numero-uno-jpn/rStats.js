# tsmeta120-metabias.R: meta's SMD variance (last variants), subgroups, metabias, trimfill, metareg, metainf and metacum
# (1.20.0). Candidates written for this experiment from the help pages and the papers they cite:
#   SMD variance: V5 1/n1 + 1/n2 + d^2 / (2 (N - 3.94)) (d = Cohen's d); V6 Hedges (1981) exact:
#     J^2 (N - 2)/(N - 4) (1/n1 + 1/n2)(1 + d^2 n1 n2 / N... ) recorded as (N-2)/(N-4) (1/n1 + 1/n2) (1 + g^2 / (1/n1 + 1/n2)) - g^2 / J^2;
#   subgroups: the subgroup estimates as separate metagen fits; Q.b.common = Q of the subgroup common estimates with
#     weights 1/se^2 (df = groups - 1); Q.b.random likewise with the random estimates; Q.w = sum of the within Q;
#   metabias: Egger (linear regression of TE/se on 1/se, the intercept's t test, df k - 2) = metafor's regtest(model =
#     "lm", predictor = "sei"); Begg (Kendall's tau between the standardised TE (TE - TE.common)/sqrt(se^2 - se.common^2)
#     and the variance, continuity-corrected normal approximation); Harbord / Peters / Thompson-Sharp recorded;
#   trimfill (Duval and Tweedie 2000, L0 estimator, side by Egger's intercept): k0, the filled studies (mirror image
#     about the trimmed estimate), the final estimate = metafor's trimfill(rma(..., method = "DL"?)) beside it;
#   metareg = rma(yi, sei, mods, method = method.tau, test = "z" / "knha"); metainf: leave-one-out common / random;
#   metacum: cumulative common / random estimates in the study order.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
n1 <- c(20, 35, 50, 41, 28); m1 <- c(10.2, 11.5, 9.8, 12.1, 10.9); s1 <- c(2.1, 2.5, 1.9, 3.0, 2.2)
n2 <- c(22, 33, 48, 40, 30); m2 <- c(9.1, 10.2, 9.9, 10.5, 9.4); s2 <- c(2.3, 2.4, 2.0, 2.8, 2.5)
mS <- metacont(n1, m1, s1, n2, m2, s2, sm = "SMD"); N <- n1 + n2
sp <- sqrt(((n1 - 1) * s1^2 + (n2 - 1) * s2^2) / (N - 2)); d <- (m1 - m2) / sp
J <- exp(lgamma((N - 2) / 2) - log(sqrt((N - 2) / 2)) - lgamma((N - 3) / 2)); g <- J * d
out$smd <- c(V5 = max(abs(mS$seTE - sqrt(1 / n1 + 1 / n2 + d^2 / (2 * (N - 3.94))))),
             V6 = max(abs(mS$seTE - sqrt((N - 2) / (N - 4) * (1 / n1 + 1 / n2) * (1 + g^2 / (1 / n1 + 1 / n2) / ((N - 2) / (N - 4))) - g^2 / J^2 * 0 - g^2))),
             V7 = max(abs(mS$seTE - sqrt(J^2 * (N - 2) / (N - 4) * (1 / n1 + 1 / n2 + d^2) - g^2))))
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
y <- as.numeric(es$yi); s <- sqrt(as.numeric(es$vi)); k <- length(y); grp <- ifelse(dat.colditz1994$alloc == "random", "random", "other")
m <- metagen(y, s, subgroup = grp)
gl <- split(seq_len(k), grp); sub <- lapply(gl, function(i) metagen(y[i], s[i]))
Qb <- function(est, seE) { w <- 1 / seE^2; sum(w * (est - sum(w * est) / sum(w))^2) }
out$subgroup <- list(Q.b.common = m$Q.b.common - Qb(sapply(sub, `[[`, "TE.common"), sapply(sub, `[[`, "seTE.common")),
                     Q.b.random = m$Q.b.random - Qb(sapply(sub, `[[`, "TE.random"), sapply(sub, `[[`, "seTE.random")),
                     Q.w.common = m$Q.w.common - sum(sapply(sub, `[[`, "Q")), TE.random.w = max(abs(m$TE.random.w - sapply(sub, `[[`, "TE.random"))),
                     df.Q.b = m$df.Q.b, tau.common = m$tau.common, Q.b = m$Q.b.random, pval.Q.b = m$pval.Q.b.random)
mb <- list()
for (meth in c("Egger", "Begg", "Thompson")) { b <- metabias(metagen(y, s), method.bias = meth, k.min = 5)
  mb[[meth]] <- list(statistic = unname(b$statistic), pval = b$p.value, estimate = unname(b$estimate), df = unname(b$parameter)) }
rt <- regtest(rma(yi = y, sei = s, method = "FE"), model = "lm", predictor = "sei")
mb$Egger_cand <- list(t = rt$zval, p = rt$pval, df = rt$dfs)
mg <- metagen(y, s); ts <- (y - mg$TE.common) / sqrt(s^2 - mg$seTE.common^2)
kt <- cor(ts, s^2, method = "kendall"); mb$Begg_cand <- list(tau = kt)
ab <- metabin(dat.colditz1994$tpos, dat.colditz1994$tpos + dat.colditz1994$tneg, dat.colditz1994$cpos, dat.colditz1994$cpos + dat.colditz1994$cneg, sm = "OR")
for (meth in c("Harbord", "Peters")) { b <- metabias(ab, method.bias = meth); mb[[meth]] <- list(statistic = unname(b$statistic), pval = b$p.value, df = unname(b$parameter)) }
out$metabias <- mb
tf <- trimfill(mg); rtf <- trimfill(rma(yi = y, sei = s, method = "DL")); rtf2 <- trimfill(rma(yi = y, sei = s, method = "REML"))
out$trimfill <- list(k0 = tf$k0, TE.random = tf$TE.random, TE.common = tf$TE.common, mf_DL = list(k0 = rtf$k0, b = rtf$b[1]),
                     mf_REML = list(k0 = rtf2$k0, b = rtf2$b[1]), k = tf$k, side = tf$side, method.tau = tf$method.tau)
mods <- dat.colditz1994$ablat
mr <- metareg(mg, ~ mods); rr <- rma(yi = y, sei = s, mods = ~ mods, method = "REML")
out$metareg <- list(b = max(abs(coef(mr) - coef(rr))), se = max(abs(mr$se - rr$se)), tau2 = mr$tau2 - rr$tau2, QM = mr$QM - rr$QM)
mi <- metainf(mg); loo <- sapply(1:k, function(i) { r <- rma(yi = y[-i], sei = s[-i], method = "REML"); r$b[1] })
loo_c <- sapply(1:k, function(i) { w <- 1 / s[-i]^2; sum(w * y[-i]) / sum(w) })
out$metainf <- list(TE = mi$TE, cand_random = loo, cand_common = loo_c, pooled = mi$pooled, names = names(mi))
mc <- metacum(mg); cum <- sapply(2:k, function(i) { r <- rma(yi = y[1:i], sei = s[1:i], method = "REML"); r$b[1] })
out$metacum <- list(TE = mc$TE, cand_random = cum, pooled = mc$pooled)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
