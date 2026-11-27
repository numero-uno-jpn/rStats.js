# tsmeta120-meta2.R: meta's SMD variance with designed inputs, trimfill and metacum (1.20.0).
#   SMD (designed, after two experiments of candidates): with m1 = m2 (g = 0) the variance is a function of n1, n2 only
#     (read for several n); with the same n and varying means, var(g) - var(0) = c(n) g^2 gives c(n), compared with
#     1/(2N), 1/(2(N - 2)), 1/(2(N - 3.94)), J^2 / (2(N - 2)) ...; also whether the g in that term is g or d;
#   trimfill: metafor's trimfill on rma(method = "FE") (C1), with estimator "R0" (C2), and on the random model with
#     "L0" (C3), k0 and the side, beside meta's;
#   metacum: the cumulative common estimates (sum w y / sum w over the first i studies) and the cumulative REML
#     estimates beside meta's TE.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
ns <- list(c(10, 10), c(20, 30), c(50, 50), c(7, 12), c(100, 80))
sm <- list()
for (nn in ns) {
  n1 <- nn[1]; n2 <- nn[2]; N <- n1 + n2
  v0 <- metacont(n1, 5, 2, n2, 5, 2, sm = "SMD")$seTE^2
  gs_ <- c(0.2, 0.5, 1, 2); vs <- sapply(gs_, function(dd) metacont(n1, 5 + 2 * dd, 2, n2, 5, 2, sm = "SMD")$seTE^2)
  TEs <- sapply(gs_, function(dd) metacont(n1, 5 + 2 * dd, 2, n2, 5, 2, sm = "SMD")$TE)
  J <- exp(lgamma((N - 2) / 2) - log(sqrt((N - 2) / 2)) - lgamma((N - 3) / 2))
  sm[[paste(n1, n2)]] <- list(v0 = v0, v0_cand = 1 / n1 + 1 / n2, c_g = (vs - v0) / TEs^2, c_d = (vs - v0) / gs_^2, J = J, N = N,
                              ref = c(inv2N = 1 / (2 * N), inv2N2 = 1 / (2 * (N - 2)), inv2N394 = 1 / (2 * (N - 3.94)), J2_2N2 = J^2 / (2 * (N - 2))))
}
out$smd <- sm
es <- escalc("RR", ai = tpos, bi = tneg, ci = cpos, di = cneg, data = dat.colditz1994)
y <- as.numeric(es$yi); s <- sqrt(as.numeric(es$vi)); mg <- metagen(y, s)
tf <- trimfill(mg)
cands <- list(C1 = trimfill(rma(yi = y, sei = s, method = "FE")), C2 = trimfill(rma(yi = y, sei = s, method = "FE"), estimator = "R0"),
              C3 = trimfill(rma(yi = y, sei = s, method = "REML"), estimator = "L0"), C4 = trimfill(rma(yi = y, sei = s, method = "DL"), estimator = "R0"))
out$trimfill <- list(meta_k0 = tf$k0, meta_TE.random = tf$TE.random, meta_TE.common = tf$TE.common,
                     cands = lapply(cands, function(t) list(k0 = t$k0, side = t$side, b = t$b[1])),
                     meta_TE_filled = tail(tf$TE, tf$k0), meta_args = list(type = tf$type, ma.common = tf$ma.common))
mc <- metacum(mg); k <- length(y)
cumC <- sapply(1:k, function(i) { w <- 1 / s[1:i]^2; sum(w * y[1:i]) / sum(w) })
cumR <- sapply(2:k, function(i) rma(yi = y[1:i], sei = s[1:i], method = "REML")$b[1])
out$metacum <- list(TE = mc$TE, common = max(abs(mc$TE[1:k] - cumC)), random = max(abs(mc$TE[2:k] - cumR)), n = length(mc$TE))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
