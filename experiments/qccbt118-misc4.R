# qccbt118-misc4.R: two thresholds left by qccbt118-misc3.R (1.18.0):
# (b) the expected fraction outside a specification limit is reported as 0 below some size: move LSL so that
#     pnorm(LSL, center, sd) runs from 1e-3 to 1e-8 and see where 0 starts;
# (c) the end of the lambda grid of the c chart OC curve (0:8, 0:14, 0:23, 0:40, 0:69, 0:121 for the centers 0.5,
#     1.55, 3.5, 9.35, 21.7, 50.05): candidates qpois(p, center) and qpois(p, UCL) for several p, printed next to it.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
pdf(NULL)
x <- c(4.2, 5.1, 6.3, 5.8, 4.9, 5.5, 6.1, 4.7, 5.2, 5.9, 5.0, 4.4, 6.6, 5.3, 4.8)
qo <- qcc(x, type = "xbar.one", plot = FALSE)
pr <- 10^-seq(2, 8, by = 0.25)
lsl <- qnorm(pr, qo$center, qo$std.dev)
out$b <- list(center = qo$center, sd = qo$std.dev, target_p = pr,
              exp = sapply(lsl, function(l) process.capability(qo, spec.limits = c(l, 20), print = FALSE)$exp[1]),
              exp_up = sapply(qnorm(pr, qo$center, qo$std.dev, lower.tail = FALSE),
                              function(u) process.capability(qo, spec.limits = c(-20, u), print = FALSE)$exp[2]))

out$c <- list()
for (ctr in c(0.5, 1.55, 3.5, 9.35, 21.7, 50.05, 100, 0.05)) {
  cc <- rep(ctr, 20)
  q <- qcc(cc, type = "c", plot = FALSE)
  oc <- suppressWarnings(oc.curves(q))
  ucl <- q$limits[1, 2]
  out$c[[as.character(ctr)]] <- list(center = q$center, ucl = ucl, last = names(oc)[length(oc)],
                                     qp_center = qpois(c(0.99, 0.999, 0.9999, 1 - 1e-5, 1 - 1e-6), q$center),
                                     qp_ucl = qpois(c(0.99, 0.999, 0.9999, 1 - 1e-5, 1 - 1e-6), ucl),
                                     qp_2ucl = qpois(c(0.99, 0.999, 0.9999), 2 * ucl))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
