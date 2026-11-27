# tsmeta120-netmeta.R: netmeta's netmeta and netrank (1.20.0), first network experiment. A candidate written for this
# experiment from Ruecker (2012, "Network meta-analysis, electrical networks and graph theory", Res. Syn. Meth. 3:312)
# and Ruecker and Schwarzer (2015, P-scores):
#   B = the m x n edge-vertex incidence matrix of the comparisons (treat1 = +1, treat2 = -1), W = diag(weights);
#   L = B' W B, L+ = its Moore-Penrose pseudoinverse; the network estimates of all contrasts theta_i - theta_j =
#   (L+ B' W y) differences; var(theta_i - theta_j) = L+_ii + L+_jj - 2 L+_ij;
#   multi-arm studies (k arms, all k(k-1)/2 comparisons given): weights adjusted so that the study's effective
#   resistances equal its comparison variances: L_s = pinv(-P V P / 2), P = I - J/k, V the k x k matrix of v_ij,
#   edge weights -L_s[i, j];
#   Q = (y - B theta)' W (y - B theta), df = sum over studies (k_s - 1) - (n - 1);
#   tau2 (DerSimonian-Laird for networks) = max(0, (Q - df) / tr((I - H) U ... )) — candidate T1: (Q - df) /
#   (sum(W) - tr(W B L+ B' W)) with the multi-arm-adjusted W summed over edges;
#   random effects: the same with variances v + tau2 (multi-arm adjustment repeated with v_ij + tau2);
#   P-scores: P_i = mean_{j != i} pnorm((theta_j - theta_i) / se_ij) for small values good, or with the sign flipped.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(netmeta))
out <- list(R = R.version.string, arch = R.version$arch, netmeta = as.character(packageVersion("netmeta")))
pinv <- function(M) { e <- eigen((M + t(M)) / 2, symmetric = TRUE); d <- ifelse(abs(e$values) > 1e-10 * max(abs(e$values)), 1 / e$values, 0); e$vectors %*% diag(d, length(d)) %*% t(e$vectors) }
candidate <- function(TE, seTE, t1, t2, stud, tau2 = 0) {
  trts <- sort(unique(c(t1, t2))); n <- length(trts); m <- length(TE)
  B <- matrix(0, m, n, dimnames = list(NULL, trts)); for (i in 1:m) { B[i, t1[i]] <- 1; B[i, t2[i]] <- -1 }
  w <- numeric(m); v <- seTE^2 + tau2
  for (s in unique(stud)) {
    idx <- which(stud == s)
    if (length(idx) == 1) { w[idx] <- 1 / v[idx]; next }
    arms <- unique(c(t1[idx], t2[idx])); k <- length(arms)
    V <- matrix(0, k, k, dimnames = list(arms, arms))
    for (i in idx) { V[t1[i], t2[i]] <- v[i]; V[t2[i], t1[i]] <- v[i] }
    P <- diag(k) - 1 / k; Ls <- pinv(-P %*% V %*% P / 2); dimnames(Ls) <- list(arms, arms)
    for (i in idx) w[i] <- -Ls[t1[i], t2[i]]
  }
  W <- diag(w); L <- t(B) %*% W %*% B; Lp <- pinv(L); dimnames(Lp) <- list(trts, trts)
  th <- Lp %*% t(B) %*% W %*% TE
  TEm <- outer(th[, 1], th[, 1], "-"); Vm <- outer(diag(Lp), diag(Lp), "+") - 2 * Lp
  res <- TE - B %*% th; Q <- drop(t(res) %*% W %*% res)
  df <- sum(tapply(seq_along(stud), stud, function(i) length(unique(c(t1[i], t2[i]))) - 1)) - (n - 1)
  H <- B %*% Lp %*% t(B) %*% W
  list(TE = TEm, se = sqrt(pmax(Vm, 0)), Q = Q, df = df, w = w, denom = sum(w) - sum(diag(W %*% H)), trts = trts)
}
set.seed(81)
d2 <- data.frame(stud = paste0("s", 1:8), t1 = c("A", "A", "A", "B", "B", "C", "A", "B"), t2 = c("B", "C", "D", "C", "D", "D", "B", "D"),
                 TE = c(0.3, 0.5, 0.2, 0.25, -0.1, -0.3, 0.45, 0.05), seTE = c(0.15, 0.2, 0.18, 0.22, 0.25, 0.2, 0.17, 0.3))
# a three-arm study s9 (A, B, C): contrasts from arm effects and arm standard errors
armE <- c(A = 0, B = -0.28, C = -0.41); armS <- c(A = 0.12, B = 0.13, C = 0.11)
d3 <- rbind(d2, data.frame(stud = "s9", t1 = c("A", "A", "B"), t2 = c("B", "C", "C"),
                           TE = c(armE["A"] - armE["B"], armE["A"] - armE["C"], armE["B"] - armE["C"]),
                           seTE = sqrt(c(armS["A"]^2 + armS["B"]^2, armS["A"]^2 + armS["C"]^2, armS["B"]^2 + armS["C"]^2))))
for (nm in c("twoarm", "threearm")) {
  d <- if (nm == "twoarm") d2 else d3
  nm1 <- netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud, reference.group = "A")
  c0 <- candidate(d$TE, d$seTE, d$t1, d$t2, d$stud)
  t2c <- max(0, (c0$Q - c0$df) / c0$denom)
  cr <- candidate(d$TE, d$seTE, d$t1, d$t2, d$stud, tau2 = nm1$tau^2)
  ord <- rownames(nm1$TE.common)
  pr <- netrank(nm1, small.values = "desirable"); prU <- netrank(nm1, small.values = "undesirable")
  pc <- sapply(ord, function(i) mean(sapply(setdiff(ord, i), function(j) pnorm((nm1$TE.random[j, i]) / nm1$seTE.random[i, j]))))
  out[[nm]] <- list(order = ord, TE.common = max(abs(nm1$TE.common - c0$TE[ord, ord])), seTE.common = max(abs(nm1$seTE.common - c0$se[ord, ord])),
                    Q = nm1$Q - c0$Q, df.Q = nm1$df.Q - c0$df, tau2 = nm1$tau^2, tau2_T1 = nm1$tau^2 - t2c,
                    TE.random = max(abs(nm1$TE.random - cr$TE[ord, ord])), seTE.random = max(abs(nm1$seTE.random - cr$se[ord, ord])),
                    Pscore_R = pr$ranking.random, Pscore_undesirable = prU$ranking.random, Pscore_cand = pc,
                    names = names(nm1)[1:60], w_common = nm1$w.common, cand_w = c0$w)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
