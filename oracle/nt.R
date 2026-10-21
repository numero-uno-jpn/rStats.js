source("/oracle/_common.R")
source("/oracle/_noncentral.R")

# ---- Noncentral t distribution (ncp of dt / pt / qt). Reference values in _noncentral.R ----
# R's noncentral t is accurate only for |ncp| <= 37.62 (?pt). Values outside that (40, 50) are included too,
# and those that disagree with R are checked against reference values.
tdf <- c(1e-10, 0.5, 1, 2, 3, 5, 10, 30, 100, Inf)
tncp <- c(0, 0.5, 1, 2, 5, 10, 20, 37.5, 40, 50, -1, -5, -20)
tx <- c(-Inf, -100, -20, -10, -5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 10, 20, 40, 50,
        100, 1000, 1e5, Inf, NaN)
tgrid <- grid_of(x = tx, df = tdf, ncp = tncp)
tbad <- grid_of(x = c(-1, 0, 1), df = c(0, -1, NaN, 5, 5, 5), ncp = 1)
tbad$ncp <- rep(c(1, 1, 1, NaN, Inf, -Inf), each = 3)
tgrid <- rbind(tgrid, tbad)
write_fixture("dnt", with_log(tgrid), function(r) dt(r$x, r$df, ncp = r$ncp, log = r$log),
              function(r) ref_dnt(r$x, r$df, r$ncp, r$log))
names(tgrid)[1] <- "q"
write_fixture("pnt", with_tails(tgrid), function(r)
  pt(r$q, r$df, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pnt(r$q, r$df, r$ncp, r$lowerTail, r$logP))
qtp <- rbind(grid_of(df = c(1, 3, 10, 100), ncp = c(1, -2, 5, 20)),
             data.frame(df = c(5, 0, 5, 5), ncp = c(0, 1, Inf, NaN)))
write_fixture("qnt", quantile_grid(qtp), function(r)
  qt(r$p, r$df, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP))
