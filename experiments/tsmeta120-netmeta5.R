# tsmeta120-netmeta5.R: netmeta's discomb, netcomb's random effects, netleague, the values behind forest and funnel,
# and netposet's order (1.20.0), fifth network experiment. Candidates written for this experiment:
#   discomb: the additive CNMA of netcomb on a disconnected network (the same weighted least squares on X = B C; the
#     components connect the subnets);
#   netcomb random: tau2 of the additive model by the DL generalisation with the additive hat matrix (H = X (X'WX)^-1
#     X'W, S as in netmeta): (Q.additive - df) / tr(W (I - H) S (I - H)'), then the WLS with v + tau2;
#   netleague: the lower triangle = TE.random of row versus column (and the upper = the direct estimates), recorded as
#     numbers; forest (netmeta): the treatment estimates against the reference with CIs = TE.random[, ref] +-
#     z seTE.random; funnel (netmeta): the comparison-adjusted residuals y - theta_comparison, recorded;
#   netposet: treatment i above j when its P-score is at least j's in every outcome (and greater in one).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(netmeta))
out <- list(R = R.version.string, arch = R.version$arch, netmeta = as.character(packageVersion("netmeta")))
wls <- function(dc, tau2 = 0, ref = "P", inactive = "P") {
  trts <- sort(unique(c(dc$t1, dc$t2))); cn <- setdiff(sort(unique(unlist(strsplit(trts, "\\+")))), inactive)
  Cm <- t(sapply(trts, function(t) as.numeric(cn %in% strsplit(t, "\\+")[[1]]))); colnames(Cm) <- cn
  B <- matrix(0, nrow(dc), length(trts), dimnames = list(NULL, trts)); for (i in seq_len(nrow(dc))) { B[i, dc$t1[i]] <- 1; B[i, dc$t2[i]] <- -1 }
  X <- B %*% Cm; W <- diag(1 / (dc$seTE^2 + tau2), nrow(dc)); A <- solve(t(X) %*% W %*% X)
  beta <- A %*% t(X) %*% W %*% dc$TE; r <- dc$TE - X %*% beta; H <- X %*% A %*% t(X) %*% W
  list(beta = drop(beta), se = sqrt(diag(A)), Q = drop(t(r) %*% W %*% r), H = H, W = W, df = nrow(dc) - qr(X)$rank, Cm = Cm)
}
dc <- data.frame(stud = paste0("c", 1:9), t1 = c("A+B", "A+B", "A", "B", "A+C", "C", "A+C", "B+C", "A"),
                 t2 = c("P", "A", "P", "P", "P", "P", "A", "P", "B"), TE = c(-0.8, -0.35, -0.4, -0.45, -0.95, -0.25, -0.3, -0.2, 0.3),
                 seTE = c(0.2, 0.22, 0.18, 0.25, 0.21, 0.19, 0.24, 0.2, 0.23))
nmc <- netmeta(dc$TE, dc$seTE, dc$t1, dc$t2, dc$stud, reference.group = "P"); cb <- netcomb(nmc, inactive = "P")
f0 <- wls(dc); I <- diag(nrow(dc)); t2 <- max(0, (f0$Q - f0$df) / sum(diag(f0$W %*% (I - f0$H) %*% (I - f0$H)))); fr <- wls(dc, t2)
out$netcomb_random <- list(R_tau2 = cb$tau^2, cand_tau2 = t2, R_comp = cb$Comp.random, cand_comp = fr$beta, R_se = cb$seComp.random, cand_se = fr$se)
dd <- data.frame(stud = paste0("d", 1:6), t1 = c("A", "A+B", "B", "C", "C+D", "D"), t2 = c("P", "P", "A", "Q", "Q", "C"),
                 TE = c(-0.4, -0.7, -0.2, -0.5, -0.9, -0.3), seTE = c(0.2, 0.22, 0.25, 0.18, 0.21, 0.24))
db <- discomb(dd$TE, dd$seTE, dd$t1, dd$t2, dd$stud, inactive = "P")
fd <- wls(dd, inactive = "P")
out$discomb <- list(R_comp = db$Comp.common, R_names = names(db$Comp.common), cand = fd$beta, R_Q = db$Q.additive, cand_Q = fd$Q, R_df = db$df.Q.additive, cand_df = fd$df)
set.seed(82)
mk <- function(st, arms, eff, sA) { cmb <- combn(length(arms), 2)
  data.frame(stud = st, t1 = arms[cmb[1, ]], t2 = arms[cmb[2, ]], TE = eff[cmb[1, ]] - eff[cmb[2, ]], seTE = sqrt(sA[cmb[1, ]]^2 + sA[cmb[2, ]]^2)) }
true <- c(A = 0, B = -0.3, C = -0.5, D = -0.2)
designs <- list(c("A", "B"), c("A", "C"), c("B", "C"), c("A", "D"), c("C", "D"), c("A", "B", "C"), c("B", "D"))
d <- do.call(rbind, lapply(seq_along(designs), function(i) { a <- designs[[i]]; mk(paste0("s", i), a, true[a] + rnorm(length(a), 0, 0.2), runif(length(a), 0.08, 0.15)) }))
nm1 <- netmeta(d$TE, d$seTE, d$t1, d$t2, d$stud, reference.group = "A")
nl <- netleague(nm1, digits = 6, bracket = "(", separator = " to ")
out$netleague <- list(random = as.matrix(nl$random), TE.random = nm1$TE.random, direct.random = nm1$TE.direct.random)
out$forest_cand <- list(TE = nm1$TE.random[, "A"], lower = nm1$TE.random[, "A"] - qnorm(0.975) * nm1$seTE.random[, "A"],
                        R_lower = nm1$lower.random[, "A"], R_upper = nm1$upper.random[, "A"])
d2 <- do.call(rbind, lapply(seq_along(designs), function(i) { a <- designs[[i]]; mk(paste0("s", i), a, true[a] * 0.3 + rnorm(length(a), 0, 0.2), runif(length(a), 0.08, 0.15)) }))
nm2 <- netmeta(d2$TE, d2$seTE, d2$t1, d2$t2, d2$stud, reference.group = "A")
np <- netposet(netrank(nm1), netrank(nm2), outcomes = c("o1", "o2"))
P <- np$P.random; trt <- rownames(P)
dom <- outer(seq_along(trt), seq_along(trt), Vectorize(function(i, j) as.numeric(i != j && all(P[i, ] >= P[j, ]) && any(P[i, ] > P[j, ]))))
out$netposet <- list(P = P, M0 = np$M0.random, cand_M0 = dom, names = names(np))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
