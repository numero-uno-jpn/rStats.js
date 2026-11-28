# plot121-plots.R: the values behind three plots (1.21.0, experiment 4).
# 1. Dendrograms: as.dendrogram's documented attributes (members, midpoint, height) and order.dendrogram, for the
#    candidate "a merge is drawn at x = the position of its leftmost leaf + midpoint, the leaves at 1..n in order",
#    which makes a merge's x the mean of its two children's x.
# 2. meta's forest: the study intervals (lower, upper of the meta object) against TE -+ qnorm(0.975) seTE, and the
#    weights in percent (100 w / sum w, common and random) for metagen with REML and HK, and level = 0.9.
# 3. survival's risk table: summary(fit, times)$n.risk per stratum at pretty(c(0, max(time))), against "the n.risk of
#    the first time at or after t, 0 after the last time".
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(meta); library(survival) })
out <- list(R = R.version.string, arch = R.version$arch, meta = as.character(packageVersion("meta")),
            survival = as.character(packageVersion("survival")))

pts <- matrix(c(1, 2, 6, 7, 15, 16.5, 30, 3.5), ncol = 1)
den <- list()
for (m in c("complete", "average", "single")) {
  hcl <- hclust(stats::dist(pts), method = m)
  d <- as.dendrogram(hcl)
  nodes <- list()
  walk <- function(node) {
    if (is.leaf(node)) return(invisible())
    nodes[[length(nodes) + 1]] <<- list(height = attr(node, "height"), members = attr(node, "members"),
                                        midpoint = attr(node, "midpoint"), leaves = order.dendrogram(node))
    for (k in seq_along(node)) walk(node[[k]])
  }
  walk(d)
  den[[m]] <- list(merge = hcl$merge, height = hcl$height, order = hcl$order, nodes = nodes)
}
out$dendrogram <- den

TE <- c(0.21, 0.52, -0.08, 0.35, 0.11, 0.62); seTE <- c(0.11, 0.21, 0.16, 0.12, 0.09, 0.3)
fo <- list()
for (lv in c(0.95, 0.9)) {
  mfit <- metagen(TE, seTE, method.tau = "REML", method.random.ci = "HK", level = lv)
  fo[[as.character(lv)]] <- list(level = lv, lower = as.numeric(mfit$lower), upper = as.numeric(mfit$upper),
                                 wc = 100 * mfit$w.common / sum(mfit$w.common), wr = 100 * mfit$w.random / sum(mfit$w.random),
                                 TEc = mfit$TE.common, lc = mfit$lower.common, uc = mfit$upper.common,
                                 TEr = mfit$TE.random, lr = mfit$lower.random, ur = mfit$upper.random,
                                 lp = mfit$lower.predict, up = mfit$upper.predict)
}
out$forest <- fo

tm <- c(5, 8, 12, 12, 20, 3, 9, 9, 15, 22, 30, 4); st <- c(1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1)
g <- c(rep("a", 5), rep("b", 7))
fit <- survfit(Surv(tm, st) ~ g)
times <- pretty(c(0, max(tm)))
s <- summary(fit, times = times, extend = TRUE)
out$risk <- list(time = tm, status = st, group = g, times = times, at = as.numeric(s$time), strata = as.character(s$strata),
                 n.risk = as.numeric(s$n.risk), surv = as.numeric(s$surv))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
