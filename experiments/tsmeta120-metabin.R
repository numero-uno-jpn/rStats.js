# tsmeta120-metabin.R: meta's metabin (1.20.0), first experiment. Defaults (gs()) and candidates written for this
# experiment from the help page and the papers it cites (Mantel and Haenszel 1959; Robins, Breslow and Greenland 1986;
# Greenland and Robins 1985; Yusuf et al. 1985 (Peto); Cochrane Handbook ch. 10):
#   Mantel-Haenszel: OR = sum(a d / n) / sum(b c / n) with the RBG variance of log OR; RR = sum(a n2 / n) / sum(c n1 / n)
#     with the Greenland-Robins variance; RD = sum((a n2 - c n1) / n) / sum(n1 n2 / n) with the Greenland-Robins (Sato)
#     variance; zero cells: incr (0.5) added to all four cells of studies with a zero cell (method.incr "only0");
#   Peto: log OR = sum(O - E) / sum(V), V = n1 n2 (a + c)(b + d) / (n^2 (n - 1)), se = 1 / sqrt(sum V);
#   inverse variance: escalc per study (with the same increment) and the common IV estimate;
#   heterogeneity: Q with inverse-variance weights about the IV estimate (Q1) or about the MH estimate (Q2,
#     "Q.Cochrane"); tau2 (DL) from that Q: (Q - df) / (sum w - sum w^2 / sum w);
#   random effects: the IV random-effects estimate with that tau2.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(metafor) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")))
out$settings <- setNames(lapply(c("method", "smbin", "incr", "method.incr", "allstudies", "MH.exact", "RR.Cochrane", "Q.Cochrane", "method.tau"),
                                function(s) gs(s)), c("method", "smbin", "incr", "method.incr", "allstudies", "MH.exact", "RR.Cochrane", "Q.Cochrane", "method.tau"))
sets <- list(fleiss = list(a = c(49, 44, 102, 32, 85, 246, 1570), n1 = c(615, 758, 832, 317, 810, 2267, 8587),
                           c = c(67, 64, 126, 38, 52, 219, 1720), n2 = c(624, 771, 850, 309, 406, 2257, 8600)),
             zeros = list(a = c(0, 3, 5, 1, 0, 7), n1 = c(20, 30, 25, 40, 15, 50), c = c(2, 6, 0, 4, 3, 12), n2 = c(21, 29, 25, 38, 16, 52)))
for (nm in names(sets)) {
  d <- sets[[nm]]; a <- d$a; b <- d$n1 - d$a; cc <- d$c; dd <- d$n2 - d$c
  z <- (a == 0 | b == 0 | cc == 0 | dd == 0); inc <- ifelse(z, 0.5, 0)
  A <- a + inc; B <- b + inc; C <- cc + inc; D <- dd + inc; N1 <- A + B; N2 <- C + D; N <- N1 + N2
  res <- list()
  for (sm in c("OR", "RR", "RD")) for (meth in c("MH", "Inverse", "Peto")) {
    if (meth == "Peto" && sm != "OR") next
    m <- metabin(d$a, d$n1, d$c, d$n2, sm = sm, method = meth)
    cand <- NA; cse <- NA
    if (meth == "MH" && sm == "OR") {
      R <- A * D / N; S <- B * C / N; P <- (A + D) / N; Qm <- (B + C) / N
      cand <- log(sum(R) / sum(S)); cse <- sqrt(sum(P * R) / (2 * sum(R)^2) + sum(P * S + Qm * R) / (2 * sum(R) * sum(S)) + sum(Qm * S) / (2 * sum(S)^2))
    }
    if (meth == "MH" && sm == "RR") {
      Rn <- A * N2 / N; Sn <- C * N1 / N; cand <- log(sum(Rn) / sum(Sn))
      cse <- sqrt(sum((N1 * N2 * (A + C) - A * C * N) / N^2) / (sum(Rn) * sum(Sn)))
    }
    if (meth == "MH" && sm == "RD") {
      w <- N1 * N2 / N; cand <- sum(w * (A / N1 - C / N2)) / sum(w)
      cse <- sqrt(sum((A * B * N2^3 + C * D * N1^3) / (N1 * N2 * N^2)) / sum(w)^2)
    }
    if (meth == "Peto") {
      a0 <- d$a; n1 <- d$n1; n2 <- d$n2; tt <- d$a + d$c; n <- n1 + n2
      E <- n1 * tt / n; V <- n1 * n2 * tt * (n - tt) / (n^2 * (n - 1)); cand <- sum(a0 - E) / sum(V); cse <- 1 / sqrt(sum(V))
    }
    if (meth == "Inverse") {
      es <- escalc(sm, ai = A, bi = B, ci = C, di = D); w <- 1 / es$vi; cand <- sum(w * es$yi) / sum(w); cse <- 1 / sqrt(sum(w))
    }
    esI <- escalc(sm, ai = A, bi = B, ci = C, di = D); wI <- 1 / esI$vi; yI <- as.numeric(esI$yi)
    Q1 <- sum(wI * (yI - sum(wI * yI) / sum(wI))^2); Q2 <- sum(wI * (yI - m$TE.common)^2)
    t2 <- function(Q) max(0, (Q - (length(yI) - 1)) / (sum(wI) - sum(wI^2) / sum(wI)))
    res[[paste(sm, meth)]] <- list(TE = m$TE.common - cand, se = m$seTE.common - cse, Q = m$Q, Q1 = m$Q - Q1, Q2 = m$Q - Q2,
                                   tau2 = m$tau2, tau2_Q1 = m$tau2 - t2(Q1), tau2_Q2 = m$tau2 - t2(Q2), method.tau = m$method.tau,
                                   TE.random = m$TE.random, k = m$k, incr = m$incr, TE_study = m$TE, seTE_study = m$seTE,
                                   cand_study = yI, cand_se_study = sqrt(as.numeric(esI$vi)))
  }
  out[[nm]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
