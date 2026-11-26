# tdroc119-cr-fit.R: an analysis of tdroc119-cr6.json (1.19.0; no package function called): the difference between
# R's mat_iid_rep_2 and the candidate (A, S2) at each time, regressed on the case weight a_k, the control weight c_k
# and a constant, to see which term of the candidate differs (the differences were constant over the controls and
# proportional to a_k over the cases).
library(jsonlite)
o <- fromJSON("experiments/tdroc119-cr6.json")
T <- o$data$T; d <- o$data$delta; n <- length(T)
od <- order(T); Ts <- T[od]; ds <- d[od]
ut <- sort(unique(T)); Ru <- sapply(ut, function(u) sum(T > u) + sum(T == u & d == 0))
dL <- ifelse(Ru > 0, sapply(ut, function(u) sum(T == u & d == 0)) / Ru, 0); Gs <- cumprod(1 - dL)
G <- function(x, left) sapply(x, function(v) { k <- if (left) which(ut < v) else which(ut <= v); if (length(k)) Gs[max(k)] else 1 })
res <- list()
for (j in 1:3) {
  t <- o$data$times[j]
  a <- (Ts < t & ds == 1) / G(Ts, TRUE); cc <- (Ts > t) / G(t, FALSE) + (Ts < t & ds == 2) / G(Ts, TRUE)
  m <- (Ts == t & ds == 1) / G(Ts, TRUE)
  diff <- o$iid_2[[j]] - o$cand[["def2,A,S2"]]$IF[[j]]
  f <- lm(diff ~ 0 + a + cc + m + I(rep(1, n)))
  res[[j]] <- list(coef = unname(coef(f)), resid = max(abs(residuals(f))), F = sum(a) / n, S = sum(cc) / n,
                   mass_at_t = sum(m) / n, auc = o$AUC_2[j])
}
cat(toJSON(res, digits = I(10), auto_unbox = TRUE, na = "null"))
