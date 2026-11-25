# qccbt118-rest.R: the remaining open points of the qcc and qvcalc experiments (1.18.0):
# (a) d2 / d3 for group sizes 26 to 50 (the tables have 25 entries): sd.xbar and limits.R with such sizes, against
#     candidates d2(n) by numerical integration of the expected range, int_{-Inf}^{Inf} 1 - (1 - F)^n - F^n, and
#     d2 = sqrt(...)-type approximations;
# (b) NA in beyond.limits (from qccbt118-shewhart.R) with an NA statistic;
# (c) the given `limits` argument, `labels`, `data.name`;
# (d) the OC curve of a u chart (it came back equal to the c chart's of the same counts);
# (e) worstErrors: candidate the extreme generalized eigenvalues over contrasts, sqrt(range of c'Qc / c'Vc) - 1.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(qcc); library(BradleyTerry2); library(qvcalc) })
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261203)
pdf(NULL)
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))
d2_int <- function(n) integrate(function(x) 1 - (1 - pnorm(x))^n - pnorm(x)^n, -Inf, Inf, rel.tol = 1e-12)$value
# (a)
big <- matrix(rnorm(10 * 30), 10, 30)
rr <- apply(big, 1, function(v) diff(range(v)))
out$a <- list(
  sd30 = try1(sd.xbar(big)), sd30_SD = try1(sd.xbar(big, std.dev = "UWAVE-SD")),
  q30 = try1(qcc(big, type = "xbar", plot = FALSE)$std.dev),
  qR30 = try1(unname(qcc(big, type = "R", plot = FALSE)$limits)),
  lim_R_30 = try1(limits.R(center = 4, std.dev = 1, sizes = 30, conf = 3)),
  lim_R_26 = try1(limits.R(center = 4, std.dev = 1, sizes = 26, conf = 3)),
  lim_R_50 = try1(limits.R(center = 4, std.dev = 1, sizes = 50, conf = 3)),
  mean_R = mean(rr), d2_int = sapply(c(2, 5, 25, 26, 30, 50), d2_int),
  table_d2 = qcc.options("exp.R.unscaled")[c(2, 5, 25)]
)
out$a$ratio_30 <- mean(rr) / out$a$sd30
# (b)
st <- c(1, NA, 4, -4, 2)
out$b <- try1(lapply(qcc(st, type = "xbar.one", center = 0, std.dev = 1, plot = FALSE)$violations, function(v) v))
mm <- matrix(rnorm(15), 5, 3); mm[2, 2:3] <- NA
out$b2 <- try1(lapply(qcc(mm, type = "S", center = 1, std.dev = 1, plot = FALSE)$violations, function(v) v))
# (c)
qq <- qcc(c(1, 2, 3, 10, 2), type = "xbar.one", limits = c(0, 5), labels = c("a", "b", "c", "d", "e"), plot = FALSE)
out$c <- list(limits = unname(qq$limits), center = qq$center, std.dev = qq$std.dev, viol = qq$violations,
              names_stats = names(qq$statistics), data.name = qq$data.name, labels_field = qq$labels,
              names = names(qq))
# (d)
cc <- rpois(20, 5)
qc <- qcc(cc, type = "c", plot = FALSE)
qu <- qcc(cc, sizes = 2, type = "u", plot = FALSE)
qu3 <- qcc(cc, sizes = c(rep(2, 10), rep(3, 10)), type = "u", plot = FALSE)
ocu <- suppressWarnings(oc.curves(qu)); occ <- suppressWarnings(oc.curves(qc)); ocu3 <- try1(suppressWarnings(oc.curves(qu3)))
out$d <- list(u = unname(ocu), u_names = names(ocu), c = unname(occ), c_names = names(occ), u_center = qu$center,
              u_limits = unname(qu$limits[1, ]), c_limits = unname(qc$limits[1, ]),
              u3 = if (is.list(ocu3)) ocu3 else list(len = length(ocu3), names = head(names(ocu3), 3), head = unname(head(ocu3, 3))))
# (e)
lev <- c("A", "B", "C", "D", "E")
pairs <- t(combn(5, 2))
nn <- sample(5:15, nrow(pairs), TRUE)
w1 <- rbinom(nrow(pairs), nn, plogis(c(0, 0.5, -0.3, 1.2, 0.2)[pairs[, 1]] - c(0, 0.5, -0.3, 1.2, 0.2)[pairs[, 2]]))
agg <- data.frame(player1 = factor(lev[pairs[, 1]], levels = lev), player2 = factor(lev[pairs[, 2]], levels = lev),
                  win1 = w1, win2 = nn - w1)
abil <- BTabilities(BTm(cbind(win1, win2), player1, player2, data = agg))
qv <- qvcalc(abil)
V <- attr(abil, "vcov"); Q <- diag(qv$qvframe$quasiVar)
C <- rbind(diag(4), rep(-1, 4))       # contrasts basis (5 x 4)
ev <- Re(eigen(solve(t(C) %*% V %*% C) %*% t(C) %*% Q %*% C)$values)
out$e <- list(worst = worstErrors(qv), cand = sqrt(range(ev)) - 1, relerrs_range = range(qv$relerrs))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
