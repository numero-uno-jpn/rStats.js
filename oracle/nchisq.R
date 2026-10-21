source("/oracle/_common.R")
source("/oracle/_noncentral.R")

# ---- Noncentral χ² distribution (ncp of dchisq / pchisq / qchisq). Reference values in _noncentral.R ----
dfs <- c(0, 0.5, 1, 2, 3, 5, 10, 50, 100, 1000)
ncps <- c(0, 1e-10, 0.1, 1, 2.5, 10, 50, 100, 500, 1000, 1e4)
xabs <- c(0, 1e-300, 1e-10, 1e-3, 0.1, 1, 3, 10, 30, 100, 300, 1000, 3000, 1e4, 1e5, Inf, -1, NaN)
cgrid <- do.call(rbind, lapply(dfs, function(df) do.call(rbind, lapply(ncps, function(ncp) {
  m <- df + ncp; s <- sqrt(2 * (df + 2 * ncp))
  rel <- m + s * c(-6, -3, -1, 0, 1, 3, 6, 15)
  data.frame(x = unique(c(xabs, signif(rel[rel > 0], 6))), df = df, ncp = ncp)
}))))
bad <- data.frame(x = 1, df = c(-1, Inf, NaN, 2, 2, 2), ncp = c(1, 1, 1, -1, Inf, NaN))
cgrid <- rbind(cgrid, bad)
rownames(cgrid) <- NULL

write_fixture("dnchisq", with_log(cgrid), function(r)
  dchisq(r$x, r$df, ncp = r$ncp, log = r$log),
  function(r) ref_dnchisq(r$x, r$df, r$ncp, r$log))
names(cgrid)[1] <- "q"
write_fixture("pnchisq", with_tails(cgrid), function(r)
  pchisq(r$q, r$df, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pnchisq(r$q, r$df, r$ncp, r$lowerTail, r$logP))
qp <- rbind(grid_of(df = c(0, 0.5, 2, 5, 50), ncp = c(0, 1, 10, 100, 1000)),
            data.frame(df = c(2, -1, 2, 2), ncp = c(1e4, 1, -1, Inf)))
write_fixture("qnchisq", quantile_grid(qp), function(r)
  qchisq(r$p, r$df, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP))
