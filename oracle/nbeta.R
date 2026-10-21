source("/oracle/_common.R")
source("/oracle/_noncentral.R")

# ---- Noncentral beta distribution (ncp of dbeta / pbeta / qbeta). Reference values in _noncentral.R ----
shp <- data.frame(shape1 = c(0.5, 0.5, 2, 3, 1, 5, 50, 100),
                  shape2 = c(0.5, 3, 3, 0.5, 1, 50, 5, 100))
bncp <- c(0, 1e-10, 0.5, 1, 5, 10, 50, 100, 1000, 1e4)
bx <- c(0, 1e-300, 1e-100, 1e-20, 1e-10, 1e-5, 0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9,
        0.99, 0.999, 1 - 1e-10, 1, -0.1, 1.1, NaN)
bgrid <- merge(merge(data.frame(x = bx), shp, by = NULL), data.frame(ncp = bncp), by = NULL)
bbad <- rbind(merge(data.frame(x = c(-1, 0.5, 2)),
                    data.frame(shape1 = c(0, 3, Inf, 3, -1, 2, 2, 2, 2, NaN),
                               shape2 = c(3, 0, 3, Inf, 2, -1, 2, 2, 2, 2),
                               ncp = c(1, 1, 1, 1, 1, 1, -1, Inf, NaN, 1)), by = NULL))
bgrid <- rbind(bgrid, bbad)
write_fixture("dnbeta", with_log(bgrid), function(r)
  dbeta(r$x, r$shape1, r$shape2, ncp = r$ncp, log = r$log),
  function(r) ref_dnbeta(r$x, r$shape1, r$shape2, r$ncp, r$log))
names(bgrid)[1] <- "q"
write_fixture("pnbeta", with_tails(bgrid), function(r)
  pbeta(r$q, r$shape1, r$shape2, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pnbeta(r$q, r$shape1, r$shape2, r$ncp, r$lowerTail, r$logP))
qb <- rbind(merge(data.frame(shape1 = c(0.5, 2, 50), shape2 = c(3, 3, 5)),
                  data.frame(ncp = c(0, 1, 10, 100, 1000)), by = NULL),
            data.frame(shape1 = c(0, 2, 2, 3), shape2 = c(3, 2, 2, Inf), ncp = c(1, -1, Inf, 1)))
write_fixture("qnbeta", quantile_grid(qb), function(r)
  qbeta(r$p, r$shape1, r$shape2, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP))

# ---- Noncentral F distribution (ncp of df / pf / qf) ----
fdf <- data.frame(df1 = c(1, 1, 3, 5, 10, 2, 5, 3),
                  df2 = c(1, 10, 5, 30, 100, Inf, Inf, 1e9))
fncp <- c(0, 0.5, 1, 5, 10, 50, 100, 1000, 1e4)
fx <- c(0, 1e-300, 1e-100, 1e-10, 0.001, 0.1, 0.5, 1, 2, 3, 5, 10, 30, 100, 1e3, 1e5, 1e10,
        1e100, Inf, -1, NaN)
fgrid <- merge(merge(data.frame(x = fx), fdf, by = NULL), data.frame(ncp = fncp), by = NULL)
# With df2 = 1e9 the reference value for the deep upper tail at large x cannot be computed (1 - x is close to 1 and the series does not converge),
# so x goes up to 30 only
fgrid <- fgrid[!(fgrid$df2 == 1e9 & is.finite(fgrid$x) & fgrid$x > 30), ]
fbad <- merge(data.frame(x = c(-1, 0, 1, Inf)),
              data.frame(df1 = c(Inf, Inf, 0, 3, -1, 2, 2, 2, NaN),
                         df2 = c(3, Inf, 3, 0, 3, 3, 3, 3, 3),
                         ncp = c(1, 1, 1, 1, 1, -1, Inf, NaN, 1)), by = NULL)
fgrid <- rbind(fgrid, fbad)
write_fixture("dnf", with_log(fgrid), function(r)
  df(r$x, r$df1, r$df2, ncp = r$ncp, log = r$log),
  function(r) ref_dnf(r$x, r$df1, r$df2, r$ncp, r$log))
names(fgrid)[1] <- "q"
write_fixture("pnf", with_tails(fgrid), function(r)
  pf(r$q, r$df1, r$df2, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP),
  function(r) ref_pnf(r$q, r$df1, r$df2, r$ncp, r$lowerTail, r$logP))
qfp <- rbind(merge(data.frame(df1 = c(1, 3, 5, 5), df2 = c(10, 5, 30, Inf)),
                   data.frame(ncp = c(0, 1, 10, 100, 1000)), by = NULL),
             data.frame(df1 = c(Inf, 2, 2), df2 = c(3, 3, 3), ncp = c(1, -1, Inf)))
write_fixture("qnf", quantile_grid(qfp), function(r)
  qf(r$p, r$df1, r$df2, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP))
