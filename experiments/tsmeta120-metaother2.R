# tsmeta120-metaother2.R: meta's metacont (SMD variance, ROM), metainc (IRD with zeros, the default MH), metaprop
# (PRAW / PLN with zeros), second experiment (1.20.0). Candidates written for this experiment:
#   SMD variance: V1 1/n1 + 1/n2 + g^2 / (2 (n1 + n2)); V2 ... / (2 (n1 + n2 - 3.94)) (RevMan); V3 J^2 times the
#     Cohen's d variance; V4 (n1 + n2)/(n1 n2) + g^2 / (2 (n1 + n2 - 2));
#   ROM: log(m1/m2), variance s1^2/(n1 m1^2) + s2^2/(n2 m2^2) (as escalc) — the TE difference read off per study;
#   IRD with a zero: I1 increments on both rates' events (x + 0.5)/t; I2 raw estimate, variance from incremented events;
#   metainc MH (Greenland and Robins 1985 for person-time): IRR = sum(x1 t2 / T) / sum(x2 t1 / T), variance of log
#     sum(t1 t2 (x1 + x2) / T^2) / (sum(x1 t2 / T) sum(x2 t1 / T)); IRD = sum((x1 t2 - x2 t1)/T) / sum(t1 t2 / T),
#     variance sum((t1 t2 / T)^2 (x1/t1^2 + x2/t2^2)) / sum(t1 t2 / T)^2;
#   PRAW / PLN with a zero: R1 raw p with variance from incremented counts; R2 increments on x and n (x + 0.5, n + 1).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
n1 <- c(20, 35, 50, 41, 28); m1 <- c(10.2, 11.5, 9.8, 12.1, 10.9); s1 <- c(2.1, 2.5, 1.9, 3.0, 2.2)
n2 <- c(22, 33, 48, 40, 30); m2 <- c(9.1, 10.2, 9.9, 10.5, 9.4); s2 <- c(2.3, 2.4, 2.0, 2.8, 2.5)
mS <- metacont(n1, m1, s1, n2, m2, s2, sm = "SMD"); N <- n1 + n2
sp <- sqrt(((n1 - 1) * s1^2 + (n2 - 1) * s2^2) / (N - 2)); d <- (m1 - m2) / sp
J <- exp(lgamma((N - 2) / 2) - log(sqrt((N - 2) / 2)) - lgamma((N - 3) / 2)); g <- J * d
out$smd <- list(TE = max(abs(mS$TE - g)), V1 = max(abs(mS$seTE - sqrt(1 / n1 + 1 / n2 + g^2 / (2 * N)))),
                V2 = max(abs(mS$seTE - sqrt(1 / n1 + 1 / n2 + g^2 / (2 * (N - 3.94))))),
                V3 = max(abs(mS$seTE - sqrt(J^2 * (1 / n1 + 1 / n2 + d^2 / (2 * N))))), V4 = max(abs(mS$seTE - sqrt(N / (n1 * n2) + g^2 / (2 * (N - 2))))))
mR <- metacont(n1, m1, s1, n2, m2, s2, sm = "ROM")
out$rom <- list(TE_diff = mR$TE - log(m1 / m2), se_diff = mR$seTE - sqrt(s1^2 / (n1 * m1^2) + s2^2 / (n2 * m2^2)))
e1 <- c(3, 0, 12, 7, 5); t1 <- c(1200, 800, 3100, 1500, 2000); e2 <- c(6, 2, 15, 3, 9); t2 <- c(1100, 900, 2900, 1600, 2100)
z <- e1 == 0 | e2 == 0; inc <- ifelse(z, 0.5, 0)
mD <- metainc(e1, t1, e2, t2, sm = "IRD", method = "Inverse")
out$ird <- list(I1 = max(abs(mD$TE - ((e1 + inc) / t1 - (e2 + inc) / t2))), I2 = max(abs(mD$TE - (e1 / t1 - e2 / t2))),
                se_I1 = max(abs(mD$seTE - sqrt((e1 + inc) / t1^2 + (e2 + inc) / t2^2))), se_raw = max(abs(mD$seTE - sqrt(e1 / t1^2 + e2 / t2^2))))
T <- t1 + t2
for (sm in c("IRR", "IRD")) {
  m <- metainc(e1, t1, e2, t2, sm = sm)
  X1 <- e1; X2 <- e2
  if (sm == "IRR") { R <- sum(X1 * t2 / T); S <- sum(X2 * t1 / T); est <- log(R / S); seM <- sqrt(sum(t1 * t2 * (X1 + X2) / T^2) / (R * S)) }
  else { w <- t1 * t2 / T; est <- sum((X1 * t2 - X2 * t1) / T) / sum(w); seM <- sqrt(sum(w^2 * (X1 / t1^2 + X2 / t2^2))) / sum(w) }
  out[[paste0("mh_", sm)]] <- c(TE = m$TE.common - est, se = m$seTE.common - seM, TE_R = m$TE.common)
}
xp <- c(4, 0, 15, 22, 9); np <- c(40, 25, 60, 70, 45); zp <- xp == 0 | xp == np; ip <- ifelse(zp, 0.5, 0)
for (sm in c("PRAW", "PLN")) {
  m <- metaprop(xp, np, sm = sm, method = "Inverse")
  raw <- if (sm == "PRAW") xp / np else log(xp / np)
  inc1 <- if (sm == "PRAW") (xp + ip) / (np + 2 * ip) else log((xp + ip) / (np + 2 * ip))
  inc2 <- if (sm == "PRAW") (xp + ip) / (np + ip) else log((xp + ip) / (np + ip))
  out[[paste0("prop_", sm)]] <- list(TE = m$TE, raw = m$TE - raw, inc_2 = m$TE - inc1, inc_1 = m$TE - inc2, seTE = m$seTE)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
