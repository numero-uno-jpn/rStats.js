# qccbt118-shewhart2.R: open questions of qccbt118-shewhart.R (1.18.0).
# (a) unbalanced groups with every size >= 2: each std.dev method against the candidates (UWAVE, MVLUE, RMSDF), the
#     center of xbar (weighted grand mean or mean of means), of R and S (mean statistic or weighted), the limits per size;
# (b) R chart probability limits: candidate qtukey(p, n, Inf) * sd (the range of n normal values);
# (c) attribute probability limits: candidates qbinom / qpois / qgeom at (1 - conf) / 2 and (1 + conf) / 2;
# (d) the order of beyond.limits (above first, then below?) and ties with a limit;
# (e) the violating.runs rule on constructed series with a given center: equal to center, runs of 6 / 7 / 8,
#     alternating sides, a run that continues into newdata, run.length changed.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261127)
d2tab <- qcc.options("exp.R.unscaled"); d3tab <- qcc.options("se.R.unscaled")
c4 <- function(n) sqrt(2 / (n - 1)) * exp(lgamma(n / 2) - lgamma((n - 1) / 2))
take <- function(q) list(statistics = unname(q$statistics), sizes = unname(q$sizes), center = q$center,
                         std.dev = q$std.dev, limits = unname(q$limits), violations = lapply(q$violations, unname))
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))

# (a)
m <- matrix(rnorm(18 * 6, 3, 0.5), 18, 6)
m[2, 3:6] <- NA; m[5, 5:6] <- NA; m[9, 4:6] <- NA; m[13, 6] <- NA; m[17, 2:6] <- NA   # sizes 2, 4, 3, 5, 1 -> fix 17
m[17, 2] <- 3.4                                                                          # size 2
n <- rowSums(!is.na(m))
mu <- rowMeans(m, na.rm = TRUE)
r <- apply(m, 1, function(v) diff(range(v, na.rm = TRUE)))
s <- apply(m, 1, sd, na.rm = TRUE)
d2 <- d2tab[n]; d3 <- d3tab[n]; cc <- c4(n)
f <- d2^2 / d3^2; h <- cc^2 / (1 - cc^2)
out$a <- list(
  n = n,
  cand = list(UWAVE_R = mean(r / d2), MVLUE_R = sum(f * r / d2) / sum(f), UWAVE_SD = mean(s / cc),
              MVLUE_SD = sum(h * s / cc) / sum(h),
              RMSDF = sqrt(sum((n - 1) * s^2) / sum(n - 1)) / c4(sum(n - 1) + 1),
              xbar_w = sum(mu * n) / sum(n), xbar_u = mean(mu), Rbar = mean(r), Rbar_w = sum(r * n) / sum(n),
              Sbar = mean(s), Sbar_w = sum(s * n) / sum(n), Sbar_df = sum(s * (n - 1)) / sum(n - 1)),
  stats = list(xbar = stats.xbar(m), R = stats.R(m), S = stats.S(m)),
  sd = list(xbar_UWAVE_R = sd.xbar(m), xbar_UWAVE_SD = sd.xbar(m, std.dev = "UWAVE-SD"),
            xbar_MVLUE_R = sd.xbar(m, std.dev = "MVLUE-R"), xbar_MVLUE_SD = sd.xbar(m, std.dev = "MVLUE-SD"),
            xbar_RMSDF = sd.xbar(m, std.dev = "RMSDF"), R_MVLUE_R = sd.R(m, std.dev = "MVLUE-R"),
            S_RMSDF = sd.S(m, std.dev = "RMSDF")),
  xbar = take(qcc(m, type = "xbar", plot = FALSE)),
  R = take(qcc(m, type = "R", plot = FALSE)),
  S = take(qcc(m, type = "S", plot = FALSE)),
  R_conf = take(qcc(m, type = "R", confidence.level = 0.9, plot = FALSE)),
  S_conf = take(qcc(m, type = "S", confidence.level = 0.9, plot = FALSE)),
  xbar_conf = take(qcc(m, type = "xbar", confidence.level = 0.9, plot = FALSE))
)
sdv <- out$a$R$std.dev
out$a$cand_limits <- list(
  R_k = cbind(pmax(0, d2 * sdv - 3 * d3 * sdv), d2 * sdv + 3 * d3 * sdv),
  R_k_center = cbind(pmax(0, mean(r) - 3 * d3 * sdv), mean(r) + 3 * d3 * sdv),
  R_tukey = cbind(qtukey(0.05, n, Inf) * sdv, qtukey(0.95, n, Inf) * sdv)
)
sds <- out$a$S$std.dev
out$a$cand_limits$S_k <- cbind(pmax(0, cc * sds - 3 * sds * sqrt(1 - cc^2)), cc * sds + 3 * sds * sqrt(1 - cc^2))
out$a$cand_limits$S_chi <- cbind(sds * sqrt(qchisq(0.05, n - 1) / (n - 1)), sds * sqrt(qchisq(0.95, n - 1) / (n - 1)))
out$a$cand_limits$S_chi_c4 <- cbind(cc * sds * sqrt(qchisq(0.05, n - 1) / (n - 1)), cc * sds * sqrt(qchisq(0.95, n - 1) / (n - 1)))

# (b) the balanced case of the first experiment, conf 0.99, n = 5, sd 1.8221364891631484
out$b <- list(tukey = qtukey(c(0.005, 0.995), 5, Inf) * 1.8221364891631484,
              limits_R = limits.R(center = 4.2382894737934835, std.dev = 1.8221364891631484, sizes = 5, conf = 0.99),
              limits_R_k = limits.R(center = 4.2382894737934835, std.dev = 1.8221364891631484, sizes = 5, conf = 3),
              limits_R_sizes = limits.R(center = 4, std.dev = 2, sizes = c(2, 3, 10, 25), conf = 0.99),
              tukey_sizes = rbind(qtukey(0.005, c(2, 3, 10, 25), Inf), qtukey(0.995, c(2, 3, 10, 25), Inf)) * 2,
              limits_R_big = try1(limits.R(center = 4, std.dev = 2, sizes = c(25, 26, 30, 50, 51, 60), conf = 3)),
              d2_len = length(d2tab))

# (c)
pb <- 0.11; nn <- c(10, 47, 52, 200)
lim_p <- limits.p(center = pb, std.dev = sqrt(pb * (1 - pb)), sizes = nn, conf = 0.99)
lim_np <- limits.np(center = pb * 50, std.dev = sqrt(50 * pb * (1 - pb)), sizes = 50, conf = 0.99)
lim_c <- limits.c(center = 3.92, std.dev = sqrt(3.92), sizes = 1, conf = 0.99)
lim_u <- limits.u(center = 2.9, std.dev = sqrt(2.9), sizes = c(1, 1.5, 2, 2.5), conf = 0.99)
lim_g <- limits.g(center = 16.1666666666667, std.dev = 15.6586859105241, sizes = 1, conf = 0.99)
out$c <- list(
  p = lim_p, p_cand = cbind(qbinom(0.005, nn, pb) / nn, qbinom(0.995, nn, pb) / nn),
  np = lim_np, np_cand = c(qbinom(0.005, 50, pb), qbinom(0.995, 50, pb)),
  c = lim_c, c_cand = c(qpois(0.005, 3.92), qpois(0.995, 3.92)),
  u = lim_u, u_cand = cbind(qpois(0.005, 2.9 * c(1, 1.5, 2, 2.5)) / c(1, 1.5, 2, 2.5),
                            qpois(0.995, 2.9 * c(1, 1.5, 2, 2.5)) / c(1, 1.5, 2, 2.5)),
  g = lim_g, g_cand1 = qgeom(c(0.005, 0.995), 1 / 16.1666666666667),
  g_cand2 = qgeom(c(0.005, 0.995), 1 / (16.1666666666667 + 1)),
  g_k = suppressWarnings(limits.g(center = 16.1666666666667, std.dev = 15.6586859105241, sizes = 1, conf = 3)),
  p_k_clip = limits.p(center = 0.95, std.dev = sqrt(0.95 * 0.05), sizes = 10, conf = 3),
  c_conf_9 = limits.c(center = 3.92, std.dev = sqrt(3.92), sizes = 1, conf = 0.9),
  c_cand_9 = c(qpois(0.05, 3.92), qpois(0.95, 3.92))
)

# (d) and (e): xbar.one with a given center and std.dev, so the limits are center +- 3
runs <- list(
  order = c(0, 4, 0, -4, 0, 5, -5, 3, -3, 0),
  six = c(1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1),
  eight = c(1, 1, 1, 1, 1, 1, 1, 1, -1, 1),
  zero_inside = c(1, 1, 1, 0, 1, 1, 1, 1, -1, -1),
  alternate = rep(c(1, -1), 8),
  long = rep(1, 12)
)
out$e <- list()
for (nm in names(runs)) {
  out$e[[nm]] <- take(qcc(runs[[nm]], type = "xbar.one", center = 0, std.dev = 1, plot = FALSE))
}
out$e$rl4 <- shewhart.rules(qcc(runs$six, type = "xbar.one", center = 0, std.dev = 1, plot = FALSE), run.length = 4)
out$e$newdata <- take(qcc(rep(1, 5), type = "xbar.one", center = 0, std.dev = 1, newdata = rep(1, 4), plot = FALSE))
out$e$tie_limit <- take(qcc(c(3, -3, 2, 3.0000001), type = "xbar.one", center = 0, std.dev = 1, plot = FALSE))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
