# tsmeta120-netmeta2.R: netmeta's tau2, decomp.design, netsplit, netmeasures and netleague (1.20.0), second network
# experiment, on a heterogeneous network with two multi-arm studies. Candidates written for this experiment from
# Ruecker (2012), Krahn, Binder and Koenig (2013, decomposition of Q, "netmeasures"), Dias et al. (2010) / Koenig et al.
# (2013) for node-splitting by back-calculation (SIDDE):
#   tau2 (T1, the generalised DerSimonian-Laird): max(0, (Q - df) / (sum(w) - tr(W B L+ B' W))) with w the multi-arm-
#     adjusted common-effect weights (tsmeta120-netmeta's candidate);
#   decomp.design: Q.decomp = Q total = Q within designs (the sum of each design's own Q about its design estimate) +
#     Q between designs (the rest); df within = sum over designs of (comparisons - (arms - 1)) ...;
#   netsplit: direct estimate of each comparison = the inverse-variance (common) estimate from the studies comparing
#     it (multi-arm studies contributing their adjusted contrast), indirect = (theta_net / v_net - theta_dir / v_dir)
#     / (1 / v_net - 1 / v_dir), v_ind = 1 / (1 / v_net - 1 / v_dir); the difference's z test;
#   netmeasures: proportion of direct evidence = v_net / v_dir;
#   netleague: the matrix of TE.random (or common) with CIs, recorded.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(netmeta))
out <- list(R = R.version.string, arch = R.version$arch, netmeta = as.character(packageVersion("netmeta")))
pinv <- function(M) { e <- eigen((M + t(M)) / 2, symmetric = TRUE); d <- ifelse(abs(e$values) > 1e-10 * max(abs(e$values)), 1 / e$values, 0); e$vectors %*% diag(d, length(d)) %*% t(e$vectors) }
weightsOf <- function(TE, v, t1, t2, stud) {
  w <- numeric(length(TE))
  for (s in unique(stud)) { idx <- which(stud == s); if (length(idx) == 1) { w[idx] <- 1 / v[idx]; next }
    arms <- unique(c(t1[idx], t2[idx])); k <- length(arms); V <- matrix(0, k, k, dimnames = list(arms, arms))
    for (i in idx) { V[t1[i], t2[i]] <- v[i]; V[t2[i], t1[i]] <- v[i] }
    P <- diag(k) - 1 / k; Ls <- pinv(-P %*% V %*% P / 2); dimnames(Ls) <- list(arms, arms); for (i in idx) w[i] <- -Ls[t1[i], t2[i]] }
  w }
fitNet <- function(TE, v, t1, t2, stud) {
  trts <- sort(unique(c(t1, t2))); n <- length(trts); m <- length(TE)
  B <- matrix(0, m, n, dimnames = list(NULL, trts)); for (i in 1:m) { B[i, t1[i]] <- 1; B[i, t2[i]] <- -1 }
  w <- weightsOf(TE, v, t1, t2, stud); W <- diag(w); Lp <- pinv(t(B) %*% W %*% B); dimnames(Lp) <- list(trts, trts)
  th <- Lp %*% t(B) %*% W %*% TE; r <- TE - B %*% th
  list(th = th[, 1], Lp = Lp, Q = drop(t(r) %*% W %*% r), w = w, tr = sum(diag(W %*% B %*% Lp %*% t(B) %*% W)), B = B)
}
set.seed(82)
mk <- function(st, arms, eff, seA) { cmb <- combn(length(arms), 2)
  data.frame(stud = st, t1 = arms[cmb[1, ]], t2 = arms[cmb[2, ]], TE = eff[cmb[1, ]] - eff[cmb[2, ]], seTE = sqrt(seA[cmb[1, ]]^2 + seA[cmb[2, ]]^2)) }
true <- c(A = 0, B = -0.3, C = -0.5, D = -0.2, E = -0.6)
dl <- list()
designs <- list(c("A", "B"), c("A", "B"), c("A", "C"), c("A", "C"), c("B", "C"), c("A", "D"), c("C", "D"), c("B", "E"), c("D", "E"), c("A", "E"),
                c("A", "B", "C"), c("A", "D", "E"), c("B", "D"))
for (i in seq_along(designs)) { a <- designs[[i]]; seA <- runif(length(a), 0.08, 0.15); eff <- true[a] + rnorm(length(a), 0, 0.25)
  dl[[i]] <- mk(paste0("s", i), a, eff, seA) }
d <- do.call(rbind, dl)
nm1 <- netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud, reference.group = "A")
f0 <- fitNet(d$TE, d$seTE^2, d$t1, d$t2, d$stud); dfQ <- nm1$df.Q
out$tau2 <- list(R = nm1$tau^2, T1 = max(0, (f0$Q - dfQ) / (sum(f0$w) - f0$tr)), Q = nm1$Q - f0$Q, df = dfQ, method.tau = nm1$method.tau)
dd <- decomp.design(nm1)
out$decomp <- list(Q.decomp = dd$Q.decomp, Q.het.design = dd$Q.het.design, Q.inc.design = dd$Q.inc.design, names = names(dd))
ns <- netsplit(nm1)
fr <- fitNet(d$TE, d$seTE^2 + nm1$tau^2, d$t1, d$t2, d$stud)
cmpDirect <- function(a, b, tau2) { sel <- (d$t1 == a & d$t2 == b) | (d$t1 == b & d$t2 == a); if (!any(sel)) return(c(NA, NA))
  w <- weightsOf(d$TE, d$seTE^2 + tau2, d$t1, d$t2, d$stud)[sel]; y <- ifelse(d$t1[sel] == a, d$TE[sel], -d$TE[sel]); c(sum(w * y) / sum(w), 1 / sum(w)) }
sp <- list()
for (i in seq_len(nrow(ns$random))) { lab <- as.character(ns$random$comparison[i]); ab <- strsplit(lab, ":")[[1]]
  dir <- cmpDirect(ab[1], ab[2], nm1$tau^2)
  vnet <- fr$Lp[ab[1], ab[1]] + fr$Lp[ab[2], ab[2]] - 2 * fr$Lp[ab[1], ab[2]]; tnet <- fr$th[ab[1]] - fr$th[ab[2]]
  vind <- 1 / (1 / vnet - 1 / dir[2]); tind <- vind * (tnet / vnet - dir[1] / dir[2])
  sp[[lab]] <- c(R_direct = ns$direct.random$TE[i], c_direct = dir[1], R_indirect = ns$indirect.random$TE[i], c_indirect = tind,
                 R_seind = ns$indirect.random$seTE[i], c_seind = sqrt(vind), R_prop = ns$prop.random[i], c_prop = vnet / dir[2]) }
out$netsplit <- sp
nmm <- netmeasures(nm1); out$netmeasures <- list(names = names(nmm), proportion = nmm$proportion[1:5], meanpath = nmm$meanpath[1:5], minpar = nmm$minpar[1:5])
nl <- netleague(nm1, digits = 4); out$netleague <- list(names = names(nl), random_dim = dim(nl$random))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
