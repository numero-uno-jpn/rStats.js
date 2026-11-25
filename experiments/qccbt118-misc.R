# qccbt118-misc.R: oc.curves, process.capability, qcc.overdispersion.test, pareto.chart, qcc.groups (1.18.0), and
# the open forms of 4 (ewma violations, cusum at the decision interval).
# Candidates written for this experiment:
#   OC xbar: beta = pnorm(L - c sqrt(n)) - pnorm(-L - c sqrt(n)), L = nsigmas (c = shift in sigma units)
#   OC R:    beta = ptukey(UCL / (c sd), n, Inf) - ptukey(LCL / (c sd), n, Inf)   (c = ratio of the new sigma)
#   OC S:    beta = pchisq((n - 1) (UCL / (c sd))^2, n - 1) - pchisq((n - 1) (LCL / (c sd))^2, n - 1)
#   OC p:    beta = pbinom(floor(n UCL), n, p) - pbinom(ceiling(n LCL) - 1, n, p); c: ppois likewise
#   Capability (Montgomery; the help names Chou 1990, Bissell 1990, Boyles 1991):
#     Cp = (USL - LSL) / (2 k sd), Cpl = (center - LSL) / (k sd), Cpu = (USL - center) / (k sd), Cpk = min,
#     Cpm = (USL - LSL) / (2 k sqrt(sd^2 + (center - target)^2)), k = nsigmas;
#     Cp CI: Cp sqrt(qchisq(a/2, n - 1) / (n - 1)) .. ; Cpk etc.: est -+ z sqrt(1 / (9 n) + est^2 / (2 (n - 1)));
#     Cpm CI: Cpm sqrt(qchisq(a/2, nu) / nu), nu = n (1 + d^2)^2 / (1 + 2 d^2), d = (center - target) / sd
#   Overdispersion: D = var(x) / (theoretical variance) * (k - 1) on k - 1 df
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261129)
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))
pdf(NULL)   # oc.curves and process.capability draw; the plots are discarded

# open forms of 4
x <- c(rnorm(15, 5, 1), rnorm(10, 7, 1))
e1 <- ewma(x, center = 5, std.dev = 1, plot = FALSE)
c1 <- cusum(c(rep(1, 5), -1, rep(-1, 3)), center = 0, std.dev = 1, decision.interval = 2, plot = FALSE)
out$open <- list(ewma_viol = e1$violations, ewma_viol_class = class(e1$violations), ewma_y = unname(e1$y),
                 ewma_lim = unname(e1$limits),
                 cusum_pos = unname(c1$pos), cusum_neg = unname(c1$neg), cusum_viol = c1$violations)

# oc.curves
m <- matrix(rnorm(25 * 5, 10, 1), 25, 5)
qx <- qcc(m, type = "xbar", plot = FALSE)
qR <- qcc(m, type = "R", plot = FALSE)
qS <- qcc(m, type = "S", plot = FALSE)
D <- rbinom(20, 50, 0.08); qp <- qcc(D, sizes = 50, type = "p", plot = FALSE)
qnp <- qcc(D, sizes = 50, type = "np", plot = FALSE)
cc <- rpois(20, 5); qc <- qcc(cc, type = "c", plot = FALSE)
ocx <- oc.curves(qx); ocx2 <- oc.curves.xbar(qx, n = c(2, 7), c = c(0, 0.5, 1.5), nsigmas = 2)
ocR <- oc.curves(qR); ocR2 <- oc.curves.R(qR, n = c(3, 5), c = c(1, 1.5, 3))
ocS <- oc.curves(qS); ocS2 <- oc.curves.S(qS, n = c(3, 5), c = c(1, 1.5, 3))
ocp <- oc.curves(qp); ocnp <- oc.curves(qnp); occ <- oc.curves(qc)
qxc <- qcc(m, type = "xbar", confidence.level = 0.99, plot = FALSE)
out$oc <- list(
  x = list(dim = dim(ocx), dimnames = dimnames(ocx), head = unname(ocx[c(1, 2, 51, 101), ])),
  x2 = list(val = unname(ocx2), dimnames = dimnames(ocx2),
            cand = outer(c(0, 0.5, 1.5), c(2, 7), function(cc, n) pnorm(2 - cc * sqrt(n)) - pnorm(-2 - cc * sqrt(n)))),
  xconf = unname(oc.curves.xbar(qxc, n = 5, c = c(0, 1))),
  xconf_cand = pnorm(qnorm(0.995) - c(0, 1) * sqrt(5)) - pnorm(-qnorm(0.995) - c(0, 1) * sqrt(5)),
  R = list(dim = dim(ocR), dimnames = dimnames(ocR), head = unname(ocR[c(1, 2, 51, 101), ])),
  R2 = list(val = unname(ocR2), dimnames = dimnames(ocR2), limits = unname(qR$limits), sd = qR$std.dev,
            center = qR$center),
  S = list(dim = dim(ocS), dimnames = dimnames(ocS), head = unname(ocS[c(1, 2, 51, 101), ])),
  S2 = list(val = unname(ocS2), dimnames = dimnames(ocS2), limits = unname(qS$limits), sd = qS$std.dev,
            center = qS$center),
  p = list(len = length(ocp), names = head(names(ocp), 5), head = unname(head(ocp, 5)), dim = dim(ocp),
           limits = unname(qp$limits), sel = unname(ocp[c(1, 11, 51, 101)])),
  np = list(len = length(ocnp), head = unname(head(ocnp, 5)), dim = dim(ocnp), names = head(names(ocnp), 5)),
  c = list(len = length(occ), names = head(names(occ), 5), head = unname(head(occ, 5)), dim = dim(occ),
           limits = unname(qc$limits), center = qc$center),
  u = try1(oc.curves(qcc(cc, sizes = 2, type = "u", plot = FALSE))),
  xone = try1(oc.curves(qcc(rnorm(20), type = "xbar.one", plot = FALSE)))
)
if (!is.null(dimnames(ocp)) || !is.null(names(ocp))) out$oc$p$names_tail <- tail(names(ocp), 3)

# process.capability
pc1 <- process.capability(qx, spec.limits = c(7, 13), print = FALSE)
pc2 <- process.capability(qx, spec.limits = c(7, 12.5), target = 10.2, print = FALSE)
pc3 <- process.capability(qx, spec.limits = c(NA, 12.5), print = FALSE)
pc4 <- process.capability(qx, spec.limits = c(7, 13), std.dev = 1.2, nsigmas = 2, confidence.level = 0.9, print = FALSE)
pc5 <- try1(process.capability(qR, spec.limits = c(7, 13), print = FALSE))
out$cap <- list(
  names = names(pc1), pc1 = pc1, pc1_indices_dimnames = dimnames(pc1$indices),
  pc2 = pc2, pc3 = pc3, pc4 = pc4, pc5 = pc5,
  stats = list(center = qx$center, sd = qx$std.dev, nobs = sum(!is.na(m)), mean_all = mean(m), sd_all = sd(m),
               below = mean(m < 7), above = mean(m > 13), above2 = mean(m > 12.5))
)
out$cap$printed <- capture.output(process.capability(qx, spec.limits = c(7, 12.5), target = 10.2))

# qcc.overdispersion.test
xb <- c(12, 11, 18, 11, 10, 16, 9, 11, 14, 15, 11, 9, 10, 13, 12, 8, 12, 13, 10, 12, 13, 16, 12, 18, 16, 10, 16, 10, 12, 14)
xpz <- c(11, 8, 13, 11, 13, 17, 25, 23, 11, 16, 9, 15, 10, 16, 12, 8, 9, 15, 4, 12, 12, 12, 15, 17, 14, 17, 12, 12, 7, 16)
szv <- sample(40:60, 30, TRUE)
od1 <- qcc.overdispersion.test(xb, rep(50, 30)); od2 <- qcc.overdispersion.test(xpz)
od3 <- qcc.overdispersion.test(xb, szv)
out$od <- list(
  od1 = unname(od1), od1_dimnames = dimnames(od1), od2 = unname(od2), od2_dimnames = dimnames(od2),
  od3 = unname(od3),
  cand1 = var(xb) / (50 * mean(xb / 50) * (1 - mean(xb / 50))) * 29,
  cand2 = var(xpz) / mean(xpz) * 29,
  cand3_a = var(xb / szv) / (mean(sum(xb) / sum(szv) * (1 - sum(xb) / sum(szv)) / szv)) * 29,
  cand3_b = sum((xb - szv * sum(xb) / sum(szv))^2 / (szv * sum(xb) / sum(szv) * (1 - sum(xb) / sum(szv)))),
  cand3_c = var(xb / szv) / (sum(xb) / sum(szv) * (1 - sum(xb) / sum(szv)) / mean(szv)) * 29
)

# pareto.chart
defect <- c(80, 27, 66, 94, 33, 27); names(defect) <- c("a", "b", "c", "d", "e", "f")
pa <- pareto.chart(defect, plot = FALSE)
pa2 <- pareto.chart(c(3, 1, 2), plot = FALSE)
out$pareto <- list(val = as.vector(pa), dim = dim(pa), dimnames = dimnames(pa), class = class(pa),
                   val2 = as.vector(pa2), dimnames2 = dimnames(pa2),
                   tbl = try1(as.vector(pareto.chart(table(c("x", "y", "y", "z", "z", "z")), plot = FALSE))))

# qcc.groups
dv <- c(5, 1, 2, 7, 3, 9, 4); sv <- c(2, 1, 2, 1, 3, 2, 1)
out$groups <- list(g = qcc.groups(dv, sv), dimnames = dimnames(qcc.groups(dv, sv)),
                   g_chr = qcc.groups(dv, c("b", "a", "b", "a", "c", "b", "a")))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
