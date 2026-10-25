source("/oracle/_common.R")

# Noncentral chi-squared and F with a huge noncentrality, far from the quantile (fixtures pnchisqHuge, pnfHuge): the
# far tail is below the smallest double, so the probabilities are 0 and 1 exactly (R's values, which are right here).
# Only the non-log tails and the log of the near tail are written (the log of the far tail is a finite number far
# below the double range's reach of R, which returns -Inf). The power functions of pwr evaluate such points at the
# ends of their intervals (pwr.chisq.test: ncp up to 1e20; pwr.anova.test: 4e15).
g <- expand.grid(q = c(0.5, 3.84, 30), df = c(1, 4, 20), ncp = c(1e8, 1e10, 1e12, 1e13, 1e14, 1e16, 1e20),
                 KEEP.OUT.ATTRS = FALSE)
grid <- rbind(transform(g, lowerTail = TRUE, logP = FALSE), transform(g, lowerTail = FALSE, logP = FALSE),
              transform(g, lowerTail = FALSE, logP = TRUE))
write_fixture("pnchisqHuge", grid, function(r) pchisq(r$q, r$df, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP))
gf <- expand.grid(q = c(0.5, 2.7, 10), df1 = c(1, 3, 10), df2 = c(5, 36, 1000), ncp = c(1e8, 1e10, 4e15, 1e20),
                  KEEP.OUT.ATTRS = FALSE)
gridf <- rbind(transform(gf, lowerTail = TRUE, logP = FALSE), transform(gf, lowerTail = FALSE, logP = FALSE),
               transform(gf, lowerTail = FALSE, logP = TRUE))
write_fixture("pnfHuge", gridf, function(r) pf(r$q, r$df1, r$df2, ncp = r$ncp, lower.tail = r$lowerTail, log.p = r$logP))
