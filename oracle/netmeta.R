# issue: 570
# oracle-platform: amd64
# Public outputs of netmeta 3.7.0 (pairwise, netmeta, netrank, netsplit, netleague, decomp.design, netmeasures,
# netconnection, netcomb, discomb, netposet; the values behind forest) for test/fixtures/netmeta.json (1.20.0). The
# behaviour is in oracle/tsmeta-behaviour.md ("netmeta"); the experiments behind it in experiments/tsmeta120-netmeta*.R
# (log 71-74, 77).
library(jsonlite)
suppressPackageStartupMessages(library(netmeta))
M <- function(x) list(rows = rownames(x), cols = colnames(x), values = unname(as.matrix(x)))
mk <- function(st, arms, eff, sA) { cmb <- combn(length(arms), 2)
  data.frame(stud = st, t1 = arms[cmb[1, ]], t2 = arms[cmb[2, ]], TE = eff[cmb[1, ]] - eff[cmb[2, ]], seTE = sqrt(sA[cmb[1, ]]^2 + sA[cmb[2, ]]^2)) }
netOut <- function(nm) list(trts = nm$trts, TE.common = M(nm$TE.common), seTE.common = M(nm$seTE.common), lower.common = M(nm$lower.common), upper.common = M(nm$upper.common),
  TE.random = M(nm$TE.random), seTE.random = M(nm$seTE.random), lower.random = M(nm$lower.random), upper.random = M(nm$upper.random),
  lower.predict = M(nm$lower.predict), upper.predict = M(nm$upper.predict),
  TE.direct.common = M(nm$TE.direct.common), seTE.direct.common = M(nm$seTE.direct.common), TE.direct.random = M(nm$TE.direct.random), seTE.direct.random = M(nm$seTE.direct.random),
  Q = nm$Q, df.Q = nm$df.Q, pval.Q = nm$pval.Q, tau2 = nm$tau^2, I2 = nm$I2, lower.I2 = nm$lower.I2, upper.I2 = nm$upper.I2,
  Q.heterogeneity = nm$Q.heterogeneity, df.Q.heterogeneity = nm$df.Q.heterogeneity, Q.inconsistency = nm$Q.inconsistency, df.Q.inconsistency = nm$df.Q.inconsistency,
  w.common = unname(nm$w.common), w.random = unname(nm$w.random), k = nm$k, n = nm$n,
  Pscore.common = as.list(netrank(nm, common = TRUE, random = FALSE)$ranking.common), Pscore.random = as.list(netrank(nm, common = FALSE, random = TRUE)$ranking.random),
  Pscore.common.undesirable = as.list(netrank(nm, small.values = "undesirable")$ranking.common))
out <- list()
set.seed(82)
true <- c(A = 0, B = -0.3, C = -0.5, D = -0.2, E = -0.6)
designs <- list(c("A", "B"), c("A", "B"), c("A", "C"), c("A", "C"), c("B", "C"), c("A", "D"), c("C", "D"), c("B", "E"), c("D", "E"), c("A", "E"),
                c("A", "B", "C"), c("A", "D", "E"), c("B", "D"), c("A", "B", "C"))
d <- do.call(rbind, lapply(seq_along(designs), function(i) { a <- designs[[i]]; sA <- runif(length(a), 0.08, 0.15)
  mk(paste0("s", i), a, true[a] + rnorm(length(a), 0, 0.25), sA) }))
nm1 <- netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud, reference.group = "A")
ns <- netsplit(nm1)
nsOut <- function(x) list(comparison = x$comparison, TE = x$TE, seTE = x$seTE, lower = x$lower, upper = x$upper, z = x$z, p = x$p)
dd <- decomp.design(nm1); me <- netmeasures(nm1)
out$net1 <- list(data = d, fit = netOut(nm1), netsplit = list(direct.random = nsOut(ns$direct.random), indirect.random = nsOut(ns$indirect.random), compare.random = nsOut(ns$compare.random),
    direct.common = nsOut(ns$direct.common), indirect.common = nsOut(ns$indirect.common), compare.common = nsOut(ns$compare.common), prop.random = ns$prop.random, prop.common = ns$prop.common),
  decomp = list(Q = dd$Q.decomp$Q, df = dd$Q.decomp$df, pval = dd$Q.decomp$pval, het_design = dd$Q.het.design$design, het_Q = dd$Q.het.design$Q, het_df = dd$Q.het.design$df, het_p = dd$Q.het.design$pval),
  netmeasures = list(proportion = as.list(me$proportion), meanpath = as.list(me$meanpath), minpar = as.list(me$minpar)),
  league = { nl <- netleague(nm1, digits = 4, bracket = "(", separator = " to "); list(random = unname(as.matrix(nl$random)), common = unname(as.matrix(nl$common))) },
  common_only = netOut(netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud, reference.group = "B", random = FALSE)))
set.seed(83)
true2 <- c(A = 0, B = -0.3, C = -0.5, D = -0.2)
designs2 <- list(c("A", "B"), c("A", "C"), c("B", "C"), c("A", "D"), c("C", "D"), c("A", "B", "C"), c("B", "D"), c("A", "B"))
d2 <- do.call(rbind, lapply(seq_along(designs2), function(i) { a <- designs2[[i]]; mk(paste0("s", i), a, true2[a] + rnorm(length(a), 0, 0.2), runif(length(a), 0.08, 0.15)) }))
nm2 <- netmeta(d2$TE, d2$seTE, d2$t1, d2$t2, d2$stud, reference.group = "A")
d3 <- do.call(rbind, lapply(seq_along(designs2), function(i) { a <- designs2[[i]]; mk(paste0("s", i), a, true2[a] * 0.3 + rnorm(length(a), 0, 0.2), runif(length(a), 0.08, 0.15)) }))
nm3 <- netmeta(d3$TE, d3$seTE, d3$t1, d3$t2, d3$stud, reference.group = "A")
np <- netposet(netrank(nm2), netrank(nm3), outcomes = c("o1", "o2"))
out$net2 <- list(data = d2, fit = netOut(nm2), data3 = d3, fit3 = netOut(nm3), poset = list(P = M(np$P.random), M0 = M(np$M0.random), Pc = M(np$P.common), M0c = M(np$M0.common)))
st <- c("p1", "p1", "p2", "p2", "p3", "p3", "p3", "p4", "p4", "p5", "p5", "p5")
tr <- c("A", "B", "A", "C", "A", "B", "C", "B", "C", "A", "B", "C")
ev <- c(10, 6, 0, 3, 8, 5, 2, 4, 9, 7, 0, 3); nn <- c(50, 48, 30, 32, 60, 58, 61, 40, 42, 45, 44, 46)
pwOut <- function(p) list(TE = p$TE, seTE = p$seTE, treat1 = p$treat1, treat2 = p$treat2, studlab = p$studlab)
mean1 <- c(5.1, 4.6, 5.0, 4.2, 5.5, 5.0, 4.8, 4.4, 4.9, 5.2, 4.7, 4.6); sd1 <- c(1.1, 1.2, 1.0, 1.3, 1.4, 1.1, 1.2, 1.0, 1.1, 1.3, 1.2, 1.1)
out$pairwise <- list(treat = tr, event = ev, n = nn, studlab = st, mean = mean1, sd = sd1,
  OR = pwOut(pairwise(treat = tr, event = ev, n = nn, studlab = st, sm = "OR")), RR = pwOut(pairwise(treat = tr, event = ev, n = nn, studlab = st, sm = "RR")),
  RD = pwOut(pairwise(treat = tr, event = ev, n = nn, studlab = st, sm = "RD")), MD = pwOut(pairwise(treat = tr, mean = mean1, sd = sd1, n = nn, studlab = st, sm = "MD")))
nc <- netconnection(c("A", "A", "C", "E", "F"), c("B", "C", "D", "F", "G"), paste0("x", 1:5))
out$netconnection <- list(t1 = c("A", "A", "C", "E", "F"), t2 = c("B", "C", "D", "F", "G"), n.subnets = nc$n.subnets, k = nc$k, n = nc$n, D = M(nc$D.matrix))
dc <- data.frame(stud = paste0("c", 1:9), t1 = c("A+B", "A+B", "A", "B", "A+C", "C", "A+C", "B+C", "A"),
                 t2 = c("P", "A", "P", "P", "P", "P", "A", "P", "B"), TE = c(-0.8, -0.35, -0.4, -0.45, -0.95, -0.25, -0.3, -0.2, 0.3),
                 seTE = c(0.2, 0.22, 0.18, 0.25, 0.21, 0.19, 0.24, 0.2, 0.23))
nmc <- netmeta(dc$TE, dc$seTE, dc$t1, dc$t2, dc$stud, reference.group = "P"); cb <- netcomb(nmc, inactive = "P")
cbOut <- function(x) list(comps = x$comps, Comp.common = unname(x$Comp.common), seComp.common = unname(x$seComp.common), Comp.random = unname(x$Comp.random), seComp.random = unname(x$seComp.random),
  Comb.common = as.list(x$Comb.common), seComb.common = as.list(x$seComb.common), Comb.random = as.list(x$Comb.random), Q.additive = x$Q.additive, df.Q.additive = x$df.Q.additive, tau2 = x$tau^2)
dd2 <- data.frame(stud = paste0("d", 1:6), t1 = c("A", "A+B", "B", "C", "C+D", "D"), t2 = c("P", "P", "A", "Q", "Q", "C"),
                  TE = c(-0.4, -0.7, -0.2, -0.5, -0.9, -0.3), seTE = c(0.2, 0.22, 0.25, 0.18, 0.21, 0.24))
out$cnma <- list(data = dc, netcomb = cbOut(cb), data_dis = dd2, discomb = cbOut(discomb(dd2$TE, dd2$seTE, dd2$t1, dd2$t2, dd2$stud, inactive = "P")))
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "netmeta.json"))
