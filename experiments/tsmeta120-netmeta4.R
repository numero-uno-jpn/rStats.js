# tsmeta120-netmeta4.R: netmeta's decomp.design, pairwise, netconnection, netcomb and netposet (1.20.0), fourth
# network experiment. Candidates written for this experiment from the help pages and the papers they cite:
#   decomp.design (Krahn, Binder and Koenig 2013): Q within a design = the Q of the network fitted to that design's
#     studies alone (multi-arm weights as before); Q within = their sum; Q between = Q total - Q within; df within =
#     sum over designs of (their df);
#   pairwise(treat, event, n, studlab, sm): each pair of arms of a study as a contrast (treat1 = the earlier arm),
#     TE / seTE as metabin's study values (OR: + 0.5 to all cells of a study with a zero cell; for a multi-arm study
#     with a zero in any arm the increment added to all its arms — candidate P1 — or only to the affected pairs, P2);
#   netconnection: the connected components of the treatment graph (number of subnets, treatments per subnet);
#   netcomb (Ruecker et al. 2020, additive CNMA): theta = C beta with C the treatment-by-component matrix ("+"
#     separated names); beta = (X' W X)^{-1} X' W y with X = B C and the multi-arm-adjusted W; Q.additive =
#     (y - X beta)' W (y - X beta), df.Q.additive = m_eff - rank(X); the combination estimates C beta;
#   netposet: i above j when its ranking metric is at least j's for every outcome and greater for one (recorded).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(netmeta))
out <- list(R = R.version.string, arch = R.version$arch, netmeta = as.character(packageVersion("netmeta")))
pinv <- function(M) { e <- eigen((M + t(M)) / 2, symmetric = TRUE); d <- ifelse(abs(e$values) > 1e-10 * max(abs(e$values)), 1 / e$values, 0); e$vectors %*% diag(d, length(d)) %*% t(e$vectors) }
weightsOf <- function(v, t1, t2, stud) { w <- numeric(length(v))
  for (s in unique(stud)) { idx <- which(stud == s); if (length(idx) == 1) { w[idx] <- 1 / v[idx]; next }
    arms <- unique(c(t1[idx], t2[idx])); k <- length(arms); V <- matrix(0, k, k, dimnames = list(arms, arms))
    for (i in idx) { V[t1[i], t2[i]] <- v[i]; V[t2[i], t1[i]] <- v[i] }
    P <- diag(k) - 1 / k; Ls <- pinv(-P %*% V %*% P / 2); dimnames(Ls) <- list(arms, arms); for (i in idx) w[i] <- -Ls[t1[i], t2[i]] }
  w }
qOf <- function(TE, v, t1, t2, stud) { trts <- sort(unique(c(t1, t2))); B <- matrix(0, length(TE), length(trts), dimnames = list(NULL, trts))
  for (i in seq_along(TE)) { B[i, t1[i]] <- 1; B[i, t2[i]] <- -1 }; w <- weightsOf(v, t1, t2, stud); W <- diag(w, length(w))
  Lp <- pinv(t(B) %*% W %*% B); r <- TE - B %*% Lp %*% t(B) %*% W %*% TE; drop(t(r) %*% W %*% r) }
set.seed(82)
mk <- function(st, arms, eff, sA) { cmb <- combn(length(arms), 2)
  data.frame(stud = st, t1 = arms[cmb[1, ]], t2 = arms[cmb[2, ]], TE = eff[cmb[1, ]] - eff[cmb[2, ]], seTE = sqrt(sA[cmb[1, ]]^2 + sA[cmb[2, ]]^2)) }
true <- c(A = 0, B = -0.3, C = -0.5, D = -0.2, E = -0.6)
designs <- list(c("A", "B"), c("A", "B"), c("A", "C"), c("A", "C"), c("B", "C"), c("A", "D"), c("C", "D"), c("B", "E"), c("D", "E"), c("A", "E"),
                c("A", "B", "C"), c("A", "D", "E"), c("B", "D"), c("A", "B", "C"))
d <- do.call(rbind, lapply(seq_along(designs), function(i) { a <- designs[[i]]; sA <- runif(length(a), 0.08, 0.15)
  mk(paste0("s", i), a, true[a] + rnorm(length(a), 0, 0.25), sA) }))
nm1 <- netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud)
dd <- decomp.design(nm1)
des <- tapply(seq_len(nrow(d)), d$stud, function(i) paste(sort(unique(c(d$t1[i], d$t2[i]))), collapse = ":"))
dd_c <- sapply(unique(des), function(g) { st <- names(des)[des == g]; sel <- d$stud %in% st; qOf(d$TE[sel], d$seTE[sel]^2, d$t1[sel], d$t2[sel], d$stud[sel]) })
out$decomp <- list(R_total = dd$Q.decomp$Q, R_design = setNames(dd$Q.het.design$Q, dd$Q.het.design$design), cand_design = dd_c,
                   cand_within = sum(dd_c), cand_between = nm1$Q - sum(dd_c))
# pairwise on arm-level binary data
st <- c("p1", "p1", "p2", "p2", "p3", "p3", "p3", "p4", "p4", "p5", "p5", "p5")
tr <- c("A", "B", "A", "C", "A", "B", "C", "B", "C", "A", "B", "C")
ev <- c(10, 6, 0, 3, 8, 5, 2, 4, 9, 7, 0, 3); nn <- c(50, 48, 30, 32, 60, 58, 61, 40, 42, 45, 44, 46)
pw <- pairwise(treat = tr, event = ev, n = nn, studlab = st, sm = "OR")
cand <- list()
for (s in unique(st)) { i <- which(st == s); anyZ <- any(ev[i] == 0 | ev[i] == nn[i]); cm <- combn(length(i), 2)
  for (j in seq_len(ncol(cm))) { a <- i[cm[1, j]]; b <- i[cm[2, j]]
    pairZ <- ev[a] == 0 | ev[b] == 0 | ev[a] == nn[a] | ev[b] == nn[b]
    for (vv in c("P1", "P2")) { inc <- if ((vv == "P1" && anyZ) || (vv == "P2" && pairZ)) 0.5 else 0
      x1 <- ev[a] + inc; m1 <- nn[a] + 2 * inc; x2 <- ev[b] + inc; m2 <- nn[b] + 2 * inc
      cand[[vv]] <- rbind(cand[[vv]], c(log(x1 / (m1 - x1)) - log(x2 / (m2 - x2)), sqrt(1 / x1 + 1 / (m1 - x1) + 1 / x2 + 1 / (m2 - x2)))) } } }
out$pairwise <- list(TE = pw$TE, seTE = pw$seTE, treat1 = pw$treat1, treat2 = pw$treat2,
                     P1 = c(max(abs(pw$TE - cand$P1[, 1])), max(abs(pw$seTE - cand$P1[, 2]))), P2 = c(max(abs(pw$TE - cand$P2[, 1])), max(abs(pw$seTE - cand$P2[, 2]))))
# netconnection
nc <- netconnection(c("A", "A", "C", "E", "F"), c("B", "C", "D", "F", "G"), paste0("x", 1:5))
out$netconnection <- list(n.subnets = nc$n.subnets, k = nc$k, n = nc$n, names = names(nc))
# netcomb
dc <- data.frame(stud = c("c1", "c2", "c3", "c4", "c5", "c6", "c7"), t1 = c("A+B", "A+B", "A", "B", "A+C", "C", "A+C"),
                 t2 = c("P", "A", "P", "P", "P", "P", "A"), TE = c(-0.8, -0.35, -0.4, -0.45, -0.7, -0.25, -0.3),
                 seTE = c(0.2, 0.22, 0.18, 0.25, 0.21, 0.19, 0.24))
nmc <- netmeta(dc$TE, dc$seTE, dc$t1, dc$t2, dc$stud, reference.group = "P")
cb <- netcomb(nmc, inactive = "P")
trts <- sort(unique(c(dc$t1, dc$t2))); compNames <- setdiff(sort(unique(unlist(strsplit(trts, "\\+")))), "P")
Cm <- t(sapply(trts, function(t) as.numeric(compNames %in% strsplit(t, "\\+")[[1]]))); colnames(Cm) <- compNames
B <- matrix(0, nrow(dc), length(trts), dimnames = list(NULL, trts)); for (i in seq_len(nrow(dc))) { B[i, dc$t1[i]] <- 1; B[i, dc$t2[i]] <- -1 }
X <- B %*% Cm; W <- diag(1 / dc$seTE^2); beta <- solve(t(X) %*% W %*% X, t(X) %*% W %*% dc$TE)
r <- dc$TE - X %*% beta
out$netcomb <- list(R_comp = cb$Comp.common, R_comp_names = names(cb$Comp.common), cand_beta = drop(beta), Q.additive = cb$Q.additive,
                    cand_Q = drop(t(r) %*% W %*% r), df.Q.additive = cb$df.Q.additive, cand_df = nrow(dc) - qr(X)$rank,
                    R_comb = cb$Comb.common, cand_comb = drop(Cm %*% beta), names = head(names(cb), 40))
# netposet
# second run: the second outcome built from arm-level effects (the first run added noise per contrast, which made the
# multi-arm studies inconsistent; netmeta stopped with its tol.multiarm check)
d2 <- do.call(rbind, lapply(seq_along(designs), function(i) { a <- designs[[i]]; sA <- runif(length(a), 0.08, 0.15)
  mk(paste0("s", i), a, true[a] * 0.5 + rnorm(length(a), 0, 0.25), sA) }))
r1 <- netrank(nm1); nm2 <- netmeta(d2$TE, d2$seTE, d2$t1, d2$t2, d2$stud); r2 <- netrank(nm2)
np <- netposet(r1, r2, outcomes = c("o1", "o2"))
out$netposet <- list(names = names(np), P.common = np$P.common, M0.common = np$M0.common)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
