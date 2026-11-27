# tsmeta120-metabin2.R: meta's metabin, second experiment (1.20.0): zero cells and the switches. Candidates written
# for this experiment (Cochrane Handbook; Greenland and Robins 1985; the help page's incr, MH.exact, RR.Cochrane,
# Q.Cochrane, allstudies):
#   study estimates with zero cells: Z1 0.5 added to all four cells of the study (as for OR); Z2 RR: events + 0.5 and
#     group sizes + 0.5 (RR.Cochrane-like) / + 1; Z3 RD without any increment (a/n1 - c/n2, variance p(1-p)/n),
#     Z4 RD estimate raw with the variance from the incremented cells;
#   Peto: study log OR = (O - E)/V, se = 1/sqrt(V);
#   double-zero studies (a = c = 0): left out (k counts the others) unless allstudies = TRUE;
#   MH.exact = TRUE: no increment in the MH estimate; Q.Cochrane with method.tau = "DL": Q about the MH estimate;
#   RR.Cochrane = TRUE: recorded.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
a <- c(0, 3, 5, 1, 0, 7, 0); n1 <- c(20, 30, 25, 40, 15, 50, 12); cc <- c(2, 6, 0, 4, 3, 12, 0); n2 <- c(21, 29, 25, 38, 16, 52, 14)
z <- (a == 0 | cc == 0 | a == n1 | cc == n2)
st <- list()
for (sm in c("RR", "RD", "OR")) {
  m <- metabin(a, n1, cc, n2, sm = sm)
  inc <- ifelse(z, 0.5, 0)
  zz <- list(
    Z1 = escalc(sm, ai = a + inc, bi = n1 - a + inc, ci = cc + inc, di = n2 - cc + inc),
    Z2a = if (sm == "RR") list(yi = log((a + inc) / (n1 + inc)) - log((cc + inc) / (n2 + inc)),
                               vi = 1 / (a + inc) - 1 / (n1 + inc) + 1 / (cc + inc) - 1 / (n2 + inc)) else NULL,
    Z2b = if (sm == "RR") list(yi = log((a + inc) / (n1 + 2 * inc)) - log((cc + inc) / (n2 + 2 * inc)),
                               vi = 1 / (a + inc) - 1 / (n1 + 2 * inc) + 1 / (cc + inc) - 1 / (n2 + 2 * inc)) else NULL,
    Z3 = if (sm == "RD") list(yi = a / n1 - cc / n2, vi = a / n1 * (1 - a / n1) / n1 + cc / n2 * (1 - cc / n2) / n2) else NULL,
    Z4 = if (sm == "RD") { e <- escalc("RD", ai = a + inc, bi = n1 - a + inc, ci = cc + inc, di = n2 - cc + inc); list(yi = a / n1 - cc / n2, vi = e$vi) } else NULL)
  keep <- !(a == 0 & cc == 0)
  st[[sm]] <- list(TE = m$TE, seTE = m$seTE, k = m$k, k.all = m$k.all, cand = lapply(Filter(Negate(is.null), zz), function(e)
    c(TE = max(abs(m$TE[keep] - as.numeric(e$yi)[keep]), na.rm = TRUE), se = max(abs(m$seTE[keep] - sqrt(as.numeric(e$vi))[keep]), na.rm = TRUE))))
}
out$studies <- st
# Peto study estimates
mP <- metabin(a, n1, cc, n2, sm = "OR", method = "Peto"); tt <- a + cc; n <- n1 + n2
E <- n1 * tt / n; V <- n1 * n2 * tt * (n - tt) / (n^2 * (n - 1))
out$peto <- list(TE = max(abs(mP$TE - (a - E) / V), na.rm = TRUE), se = max(abs(mP$seTE - 1 / sqrt(V)), na.rm = TRUE), k = mP$k)
# switches
sw <- list()
for (sm in c("OR", "RR", "RD")) {
  m0 <- metabin(a, n1, cc, n2, sm = sm); mx <- metabin(a, n1, cc, n2, sm = sm, MH.exact = TRUE)
  mAll <- metabin(a, n1, cc, n2, sm = sm, allstudies = TRUE); mDL <- metabin(a, n1, cc, n2, sm = sm, method.tau = "DL")
  mRC <- if (sm == "RR") metabin(a, n1, cc, n2, sm = sm, RR.Cochrane = TRUE) else NULL
  keep <- !(a == 0 & cc == 0); A <- a[keep]; B <- (n1 - a)[keep]; C <- cc[keep]; D <- (n2 - cc)[keep]; N <- A + B + C + D
  exactOR <- log(sum(A * D / N) / sum(B * C / N))
  sw[[sm]] <- list(TE = m0$TE.common, TE_exact = mx$TE.common, exactOR_cand = if (sm == "OR") mx$TE.common - exactOR else NA,
                   k = m0$k, k_all = mAll$k, TE_all = mAll$TE.common, Q_DL = mDL$Q, tau2_DL = mDL$tau2, Q = m0$Q,
                   Qcochrane_cand = { es <- escalc(sm, ai = a + ifelse(z, 0.5, 0), bi = n1 - a + ifelse(z, 0.5, 0), ci = cc + ifelse(z, 0.5, 0), di = n2 - cc + ifelse(z, 0.5, 0))
                     w <- 1 / es$vi[keep]; sum(w * (es$yi[keep] - mDL$TE.common)^2) },
                   RRC = if (!is.null(mRC)) list(TE = mRC$TE, TE.common = mRC$TE.common) else NA)
}
out$switches <- sw
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
