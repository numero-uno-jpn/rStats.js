# qccbt118-misc3.R: what qccbt118-misc2.R left open (1.18.0):
# (a) the Cpm confidence limits: solve for the nu that gives R's limits with Cpm sqrt(qchisq(., nu) / nu), and try the
#     candidates nu = n (1 + d^2)^2 / (1 + 2 d^2) with n - 1, with d from the total sd, and the quantiles a/2 vs a;
# (b) the expected fraction below LSL that came back 0 for an xbar.one chart (pnorm gave 2.86e-6);
# (c) the grid of the c chart OC curve (0:24 for center 3.9, 0:69 for a center near 20).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261129)
pdf(NULL)
x <- c(rnorm(15, 5, 1), rnorm(10, 7, 1))
m <- matrix(rnorm(25 * 5, 10, 1), 25, 5)
qx <- qcc(m, type = "xbar", plot = FALSE)
qo <- qcc(x, type = "xbar.one", plot = FALSE)

solve_nu <- function(cpm, lim, conf) {
  a <- 1 - conf
  c(lo = uniroot(function(nu) cpm * sqrt(qchisq(a / 2, nu) / nu) - lim[1], c(1, 1e5))$root,
    hi = uniroot(function(nu) cpm * sqrt(qchisq(1 - a / 2, nu) / nu) - lim[2], c(1, 1e5))$root)
}
cases <- list(
  pc2 = list(q = qx, spec = c(7, 12.5), target = 10.2, conf = 0.95, n = 125),
  pc6 = list(q = qo, spec = c(2, 9), target = 5.5, conf = 0.95, n = 25),
  pc10 = list(q = qx, spec = c(7, 13), target = 11, conf = 0.95, n = 125),
  pc11 = list(q = qo, spec = c(2, 9), target = 5.5, conf = 0.8, n = 25),
  pc12 = list(q = qo, spec = c(2, 9), target = qo$center, conf = 0.95, n = 25)
)
out$a <- list()
for (nm in names(cases)) {
  cs <- cases[[nm]]
  pc <- process.capability(cs[["q"]], spec.limits = cs[["spec"]], target = cs[["target"]],
                           confidence.level = cs[["conf"]], print = FALSE)
  cpm <- pc$indices[5, 1]; lim <- pc$indices[5, 2:3]
  sdv <- cs[["q"]]$std.dev; ctr <- cs[["q"]]$center; n <- cs[["n"]]
  d <- (ctr - cs[["target"]]) / sdv
  out$a[[nm]] <- list(cpm = cpm, lim = unname(lim), nu_solved = solve_nu(cpm, lim, cs[["conf"]]), d = d,
                      nu_n = n * (1 + d^2)^2 / (1 + 2 * d^2), nu_n1 = (n - 1) * (1 + d^2)^2 / (1 + 2 * d^2),
                      exp = pc$exp, obs = pc$obs, center = ctr, sd = sdv)
}

# (b)
pcb <- process.capability(qo, spec.limits = c(2, 9), print = FALSE)
pcb2 <- process.capability(qo, spec.limits = c(3, 9), print = FALSE)
pcb3 <- process.capability(qo, spec.limits = c(1, 7.5), print = FALSE)
out$b <- list(exp = pcb$exp, exp2 = pcb2$exp, exp3 = pcb3$exp,
              cand = c(pnorm(2, qo$center, qo$std.dev), pnorm(3, qo$center, qo$std.dev), pnorm(1, qo$center, qo$std.dev),
                       1 - pnorm(9, qo$center, qo$std.dev), 1 - pnorm(7.5, qo$center, qo$std.dev)),
              printed = capture.output(process.capability(qo, spec.limits = c(2, 9))))

# (c)
out$c <- list()
for (lam in c(0.5, 2, 3.9, 8, 20, 50)) {
  cc <- rpois(20, lam); cc[1] <- max(cc[1], 1)
  q <- qcc(cc, type = "c", plot = FALSE)
  oc <- suppressWarnings(oc.curves(q))
  out$c[[as.character(lam)]] <- list(center = q$center, limits = unname(q$limits[1, ]), first = names(oc)[1],
                                     last = names(oc)[length(oc)], len = length(oc))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
