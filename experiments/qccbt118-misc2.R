# qccbt118-misc2.R: the open parts of qccbt118-misc.R (1.18.0): the confidence limits of process.capability, the OC
# curves of R, S, p, c (candidates in the header of qccbt118-misc.R) and the overdispersion test with unequal sizes.
# New candidates here:
#   Cp CI (Chou): Cp sqrt(qchisq(c(a/2, 1 - a/2), n - 1) / (n - 1)), n = nobs
#   Cpl, Cpu, Cpk CI (Bissell): est +- qnorm(1 - a/2) sqrt(1 / (9 n) + est^2 / (2 (n - 1)))
#   Cpm CI (Boyles): Cpm sqrt(qchisq(c(a/2, 1 - a/2), nu) / nu), nu = n (1 + d^2)^2 / (1 + 2 d^2), d = (center - target) / sd
#   Overdispersion, binomial with sizes n_i: several variances of x and of x / n_i over several "theoretical" ones
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261129)
pdf(NULL)
x <- c(rnorm(15, 5, 1), rnorm(10, 7, 1))   # as in qccbt118-misc.R, to keep the random stream
m <- matrix(rnorm(25 * 5, 10, 1), 25, 5)
qx <- qcc(m, type = "xbar", plot = FALSE)
qR <- qcc(m, type = "R", plot = FALSE)
qS <- qcc(m, type = "S", plot = FALSE)
D <- rbinom(20, 50, 0.08); qp <- qcc(D, sizes = 50, type = "p", plot = FALSE)
cc <- rpois(20, 5); qc <- qcc(cc, type = "c", plot = FALSE)

cap_cand <- function(center, sd, lsl, usl, target, n, k, conf) {
  a <- 1 - conf; z <- qnorm(1 - a / 2)
  cp <- (usl - lsl) / (2 * k * sd); cpl <- (center - lsl) / (k * sd); cpu <- (usl - center) / (k * sd)
  cpk <- min(cpl, cpu); d <- (center - target) / sd
  cpm <- (usl - lsl) / (2 * k * sqrt(sd^2 + (center - target)^2))
  nu <- n * (1 + d^2)^2 / (1 + 2 * d^2)
  b <- function(e) e + c(-1, 1) * z * sqrt(1 / (9 * n) + e^2 / (2 * (n - 1)))
  b2 <- function(e) e * (1 + c(-1, 1) * z * sqrt(1 / (9 * n * e^2) + 1 / (2 * (n - 1))))
  list(cp = c(cp, cp * sqrt(qchisq(c(a / 2, 1 - a / 2), n - 1) / (n - 1))), cpl = c(cpl, b(cpl)), cpu = c(cpu, b(cpu)),
       cpk = c(cpk, b(cpk)), cpm = c(cpm, cpm * sqrt(qchisq(c(a / 2, 1 - a / 2), nu) / nu)),
       cpl_b2 = b2(cpl), cpk_b2 = b2(cpk), nu = nu)
}
pc2 <- process.capability(qx, spec.limits = c(7, 12.5), target = 10.2, print = FALSE)
pc4 <- process.capability(qx, spec.limits = c(7, 13), std.dev = 1.2, nsigmas = 2, confidence.level = 0.9, print = FALSE)
qo <- qcc(x, type = "xbar.one", plot = FALSE)
pc6 <- process.capability(qo, spec.limits = c(2, 9), print = FALSE)
out$cap <- list(
  pc2 = unname(pc2$indices), pc2_cand = cap_cand(qx$center, qx$std.dev, 7, 12.5, 10.2, 125, 3, 0.95),
  pc4 = unname(pc4$indices), pc4_cand = cap_cand(qx$center, 1.2, 7, 13, 10, 125, 2, 0.9),
  pc6 = unname(pc6$indices), pc6_nobs = pc6$nobs, pc6_cand = cap_cand(qo$center, qo$std.dev, 2, 9, 5.5, 25, 3, 0.95),
  pc6_exp = pc6$exp, pc6_exp_cand = c(pnorm(2, qo$center, qo$std.dev), 1 - pnorm(9, qo$center, qo$std.dev)),
  pc2_exp_cand = c(pnorm(7, qx$center, qx$std.dev), 1 - pnorm(12.5, qx$center, qx$std.dev)),
  pc7 = tryCatch(unname(process.capability(qx, spec.limits = c(7, NA), print = FALSE)$indices),
                 error = function(e) conditionMessage(e)),
  pc8_target = process.capability(qx, spec.limits = c(7, 12.5), print = FALSE)$target,
  pc9 = tryCatch(process.capability(qx, spec.limits = c(13, 7), print = FALSE)$indices, error = function(e) conditionMessage(e))
)

# OC
sdR <- qR$std.dev; limR <- qR$limits; sdS <- qS$std.dev; limS <- qS$limits
cR <- c(1, 1.5, 3); nR <- c(3, 5)
out$oc <- list(
  R2 = unname(oc.curves.R(qR, n = nR, c = cR)),
  R2_cand = outer(cR, nR, function(c, n) ptukey(limR[2] / (c * sdR), n, Inf) - ptukey(limR[1] / (c * sdR), n, Inf)),
  R2_cand_own = outer(cR, nR, function(c, n) {
    d2 <- qcc.options("exp.R.unscaled")[n]; d3 <- qcc.options("se.R.unscaled")[n]
    ucl <- d2 * sdR + 3 * d3 * sdR; lcl <- pmax(0, d2 * sdR - 3 * d3 * sdR)
    ptukey(ucl / (c * sdR), n, Inf) - ptukey(lcl / (c * sdR), n, Inf) }),
  R2_cand_own_lam = outer(cR, nR, function(c, n) {
    d2 <- qcc.options("exp.R.unscaled")[n]; d3 <- qcc.options("se.R.unscaled")[n]
    ptukey((d2 + 3 * d3) / c, n, Inf) - ptukey(pmax(0, d2 - 3 * d3) / c, n, Inf) }),
  S2 = unname(oc.curves.S(qS, n = nR, c = cR)),
  S2_cand_own = outer(cR, nR, function(c, n) {
    c4 <- sqrt(2 / (n - 1)) * exp(lgamma(n / 2) - lgamma((n - 1) / 2))
    ucl <- c4 + 3 * sqrt(1 - c4^2); lcl <- pmax(0, c4 - 3 * sqrt(1 - c4^2))
    pchisq((n - 1) * (ucl / c)^2, n - 1) - pchisq((n - 1) * (lcl / c)^2, n - 1) }),
  S2_cand_obj = outer(cR, nR, function(c, n)
    pchisq((n - 1) * (limS[2] / (c * sdS))^2, n - 1) - pchisq((n - 1) * (limS[1] / (c * sdS))^2, n - 1)),
  p = unname(suppressWarnings(oc.curves(qp))), p_limits = unname(qp$limits[1, ]),
  p_cand = { pp <- seq(0, 1, length = 101); pbinom(floor(50 * qp$limits[1, 2]), 50, pp) -
               pbinom(ceiling(50 * qp$limits[1, 1]) - 1, 50, pp) },
  c = unname(suppressWarnings(oc.curves(qc))), c_names = names(suppressWarnings(oc.curves(qc))),
  c_limits = unname(qc$limits[1, ]),
  c_cand = { lam <- 0:24; ppois(floor(qc$limits[1, 2]), lam) - ppois(ceiling(qc$limits[1, 1]) - 1, lam) },
  c_big = names(suppressWarnings(oc.curves(qcc(rpois(20, 20), type = "c", plot = FALSE))))
)

# overdispersion with unequal sizes
xb <- c(12, 11, 18, 11, 10, 16, 9, 11, 14, 15, 11, 9, 10, 13, 12, 8, 12, 13, 10, 12, 13, 16, 12, 18, 16, 10, 16, 10, 12, 14)
set.seed(20261129); invisible(rnorm(25)); szv <- sample(40:60, 30, TRUE)   # not the same szv as in misc; recomputed
od <- qcc.overdispersion.test(xb, szv)
pbar <- sum(xb) / sum(szv); pm <- mean(xb / szv)
cands <- c(
  a = var(xb) / (mean(szv) * pbar * (1 - pbar)), b = var(xb) / (mean(szv) * pm * (1 - pm)),
  c = var(xb / szv) / (pbar * (1 - pbar) / mean(szv)), d = var(xb / szv) / (pm * (1 - pm) / mean(szv)),
  e = var(xb) / mean(szv * pbar * (1 - pbar)), f = var(xb) / mean(szv * pm * (1 - pm)),
  g = var(xb / szv) / mean(pm * (1 - pm) / szv), h = var(xb) / (mean(xb) * (1 - mean(xb) / mean(szv))),
  i = var(xb) / (mean(xb) * (1 - pm)), j = var(xb) / (mean(xb) * (1 - pbar))
)
out$od <- list(od = unname(od), cand_ratio = as.list(cands), szv = szv)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
