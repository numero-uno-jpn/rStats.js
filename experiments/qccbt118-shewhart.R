# qccbt118-shewhart.R: the Shewhart charts of qcc (1.18.0), first experiment.
# For each type (xbar, R, S, xbar.one, p, np, c, u, g) and each std.dev method: the fields of the qcc object
# (statistics, center, std.dev, limits, violations, sizes) next to candidate formulas written for this experiment from
# the documentation and the textbook definitions (Montgomery; SAS/QC for the std.dev methods):
#   d2(n) = qcc.options("exp.R.unscaled")[n], d3(n) = qcc.options("se.R.unscaled")[n],
#   c4(n) = sqrt(2 / (n - 1)) * gamma(n / 2) / gamma((n - 1) / 2)
#   UWAVE-R  = mean(R_i / d2(n_i));  MVLUE-R  = sum(f_i R_i / d2(n_i)) / sum(f_i), f_i = d2^2 / d3^2
#   UWAVE-SD = mean(s_i / c4(n_i));  MVLUE-SD = sum(h_i s_i / c4(n_i)) / sum(h_i), h_i = c4^2 / (1 - c4^2)
#   RMSDF    = sqrt(sum((n_i - 1) s_i^2) / sum(n_i - 1)), and the same divided by c4(sum(n_i - 1) + 1)
# Limits: center +- k sd / sqrt(n) (xbar), d2 sd +- k d3 sd (R), c4 sd +- k sd sqrt(1 - c4^2) (S), clipped at 0;
# p +- k sqrt(p (1 - p) / n) clipped to [0, 1], etc. Data: balanced and unbalanced (NA) groups.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261125)
d2tab <- qcc.options("exp.R.unscaled"); d3tab <- qcc.options("se.R.unscaled")
out$d2 <- d2tab; out$d3 <- d3tab; out$run_length <- qcc.options("run.length")
c4 <- function(n) sqrt(2 / (n - 1)) * exp(lgamma(n / 2) - lgamma((n - 1) / 2))

bal <- matrix(rnorm(20 * 5, 10, 2), 20, 5)
bal[7, ] <- bal[7, ] + 4          # a point beyond the limits
unb <- bal; unb[2, 4:5] <- NA; unb[5, 5] <- NA; unb[11, 3:5] <- NA; unb[16, 2:5] <- NA   # sizes 3, 4, 2, 1

grp <- function(m) {
  n <- rowSums(!is.na(m))
  mu <- rowMeans(m, na.rm = TRUE)
  r <- apply(m, 1, function(v) { v <- v[!is.na(v)]; max(v) - min(v) })
  s <- apply(m, 1, function(v) { v <- v[!is.na(v)]; if (length(v) > 1) sd(v) else NA })
  list(n = n, mu = mu, r = r, s = s)
}
cand_sd <- function(m) {
  g <- grp(m); n <- g$n; ok <- n > 1
  d2 <- d2tab[n]; d3 <- d3tab[n]; cc <- c4(n)
  f <- d2^2 / d3^2; h <- cc^2 / (1 - cc^2)
  list(UWAVE_R = mean((g$r / d2)[ok]), MVLUE_R = sum((f * g$r / d2)[ok]) / sum(f[ok]),
       UWAVE_SD = mean((g$s / cc)[ok]), MVLUE_SD = sum((h * g$s / cc)[ok]) / sum(h[ok]),
       RMSDF_raw = sqrt(sum(((n - 1) * g$s^2)[ok]) / sum((n - 1)[ok])),
       RMSDF_c4 = sqrt(sum(((n - 1) * g$s^2)[ok]) / sum((n - 1)[ok])) / c4(sum((n - 1)[ok]) + 1),
       UWAVE_R_all = mean(g$r / d2), center_w = sum(g$mu * n) / sum(n), center_u = mean(g$mu),
       Rbar = mean(g$r), Sbar = mean(g$s, na.rm = TRUE), n = n)
}
take <- function(q) list(class = class(q), names = names(q), type = q$type, statistics = unname(q$statistics),
                         sizes = unname(q$sizes), center = q$center, std.dev = q$std.dev,
                         limits = unname(q$limits), limits_dimnames = dimnames(q$limits),
                         violations = lapply(q$violations, unname), nsigmas = q$nsigmas,
                         confidence.level = q$confidence.level, newstats = unname(q$newstats),
                         newsizes = unname(q$newsizes), newdata_dim = dim(q$newdata))
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)),
                                warning = function(w) list(warning = conditionMessage(w)))

res <- list()
mats <- list(bal = bal, unb = unb)
for (dn in names(mats)) {
  m <- mats[[dn]]
  res[[dn]] <- list(cand = cand_sd(m), grp = grp(m))
  for (ty in c("xbar", "R", "S")) {
    for (sdm in c("default", "UWAVE-R", "UWAVE-SD", "MVLUE-R", "MVLUE-SD", "RMSDF")) {
      key <- paste(ty, sdm, sep = "|")
      res[[dn]][[key]] <- try1(if (sdm == "default") take(qcc(m, type = ty, plot = FALSE))
                               else take(qcc(m, type = ty, std.dev = sdm, plot = FALSE)))
    }
    res[[dn]][[paste(ty, "nsigmas2", sep = "|")]] <- try1(take(qcc(m, type = ty, nsigmas = 2, plot = FALSE)))
    res[[dn]][[paste(ty, "conf99", sep = "|")]] <- try1(take(qcc(m, type = ty, confidence.level = 0.99, plot = FALSE)))
    res[[dn]][[paste(ty, "given", sep = "|")]] <- try1(take(qcc(m, type = ty, center = 10, std.dev = 2, plot = FALSE)))
    res[[dn]][[paste(ty, "newdata", sep = "|")]] <- try1(take(qcc(m[1:15, ], type = ty, newdata = m[16:20, ], plot = FALSE)))
  }
}
out$grouped <- res

# one-at-a-time data
x1 <- c(rnorm(25, 5, 1), 9, rnorm(4, 5, 1))
mr <- abs(diff(x1))
out$xbar_one <- list(
  x = x1,
  cand = list(MR = mean(mr) / d2tab[2], SD_raw = sd(x1), SD_c4 = sd(x1) / c4(length(x1)),
              MR3 = mean(apply(embed(x1, 3), 1, function(v) max(v) - min(v))) / d2tab[3]),
  default = take(qcc(x1, type = "xbar.one", plot = FALSE)),
  SD = take(qcc(x1, type = "xbar.one", std.dev = "SD", plot = FALSE)),
  conf99 = take(qcc(x1, type = "xbar.one", confidence.level = 0.99, plot = FALSE)),
  newdata = take(qcc(x1[1:20], type = "xbar.one", newdata = x1[21:30], plot = FALSE)),
  sd_k3 = sd.xbar.one(x1, k = 3), sd_k2 = sd.xbar.one(x1), sd_SD = sd.xbar.one(x1, std.dev = "SD")
)

# attribute charts
sz <- sample(40:60, 25, TRUE)
D <- rbinom(25, sz, 0.1); D[9] <- 18
szc <- rep(50, 25); Dc <- rbinom(25, 50, 0.1)
cnt <- rpois(25, 4); cnt[14] <- 13
u_sz <- sample(c(1, 1.5, 2, 2.5), 25, TRUE); u_x <- rpois(25, 3 * u_sz)
gg <- rgeom(30, 0.05)
out$attr <- list(
  D = D, sz = sz, Dc = Dc, cnt = cnt, u_sz = u_sz, u_x = u_x, gg = gg,
  p = take(qcc(D, sizes = sz, type = "p", plot = FALSE)),
  p_const = take(qcc(Dc, sizes = szc, type = "p", plot = FALSE)),
  p_conf = take(qcc(D, sizes = sz, type = "p", confidence.level = 0.99, plot = FALSE)),
  p_center = take(qcc(D, sizes = sz, type = "p", center = 0.1, plot = FALSE)),
  np = take(qcc(Dc, sizes = szc, type = "np", plot = FALSE)),
  np_var = try1(take(qcc(D, sizes = sz, type = "np", plot = FALSE))),
  np_conf = take(qcc(Dc, sizes = szc, type = "np", confidence.level = 0.99, plot = FALSE)),
  c = take(qcc(cnt, type = "c", plot = FALSE)),
  c_sizes = try1(take(qcc(cnt, sizes = u_sz, type = "c", plot = FALSE))),
  c_conf = take(qcc(cnt, type = "c", confidence.level = 0.99, plot = FALSE)),
  u = take(qcc(u_x, sizes = u_sz, type = "u", plot = FALSE)),
  u_conf = take(qcc(u_x, sizes = u_sz, type = "u", confidence.level = 0.99, plot = FALSE)),
  g = take(qcc(gg, type = "g", plot = FALSE)),
  g_conf = take(qcc(gg, type = "g", confidence.level = 0.99, plot = FALSE)),
  g_sizes = try1(take(qcc(gg, sizes = 2, type = "g", plot = FALSE))),
  cand = list(pbar = sum(D) / sum(sz), pbar_const = sum(Dc) / sum(szc), cbar = mean(cnt),
              ubar = sum(u_x) / sum(u_sz), gbar = mean(gg), g_sd_1 = sqrt(mean(gg) * (mean(gg) + 1)),
              g_p = 1 / (mean(gg) + 1))
)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
