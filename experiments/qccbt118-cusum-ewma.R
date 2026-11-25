# qccbt118-cusum-ewma.R: cusum, ewma and ewmaSmooth of qcc (1.18.0).
# Candidates written for this experiment (textbook tabular CUSUM on standardized statistics; EWMA with exact
# variance):
#   z_i = (xbar_i - center) / (sd / sqrt(n_i)), k = se.shift / 2, h = decision.interval
#   C+_i = max(0, C+_{i-1} + z_i - k), C-_i = max(0, C-_{i-1} - z_i - k), C+_0 = C-_0 = head.start
#   EWMA: y_i = lambda x_i + (1 - lambda) y_{i-1}, y_0 = center;
#         var_i = sd^2 * sum_j lambda^2 (1 - lambda)^(2 (i - j)) / n_j  (= sd^2/n lambda/(2-lambda) (1-(1-lambda)^(2i)))
# Data: grouped (equal and unequal sizes), individual values, head.start, newdata, given center / std.dev.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261128)
m <- matrix(rnorm(20 * 4, 10, 1), 20, 4); m[13:20, ] <- m[13:20, ] + 0.8
mu <- matrix(rnorm(20 * 5, 10, 1), 20, 5); mu[3, 4:5] <- NA; mu[8, 5] <- NA; mu[15, 3:5] <- NA
x <- c(rnorm(15, 5, 1), rnorm(10, 5.9, 1))

cand_cusum <- function(st, n, center, sd, k, h0) {
  z <- (st - center) / (sd / sqrt(n)); p <- q <- numeric(length(z)); a <- b <- h0
  for (i in seq_along(z)) { a <- max(0, a + z[i] - k); b <- max(0, b - z[i] - k); p[i] <- a; q[i] <- b }
  list(z = z, pos = p, neg = q)
}
cand_ewma <- function(st, n, center, sd, lambda) {
  y <- numeric(length(st)); v <- numeric(length(st)); a <- center; w <- 0
  for (i in seq_along(st)) {
    a <- lambda * st[i] + (1 - lambda) * a; y[i] <- a
    w <- (1 - lambda)^2 * w + lambda^2 / n[i]; v[i] <- sd * sqrt(w)
  }
  list(y = y, sigma = v, sigma_eq = sd / sqrt(n) * sqrt(lambda / (2 - lambda) * (1 - (1 - lambda)^(2 * seq_along(st)))))
}
takec <- function(q) list(class = class(q), names = names(q), statistics = unname(q$statistics), sizes = unname(q$sizes),
                          center = q$center, std.dev = q$std.dev, pos = unname(q$pos), neg = unname(q$neg),
                          head.start = q$head.start, decision.interval = q$decision.interval, se.shift = q$se.shift,
                          violations = lapply(q$violations, unname), newstats = unname(q$newstats))
takee <- function(q) list(class = class(q), names = names(q), statistics = unname(q$statistics), sizes = unname(q$sizes),
                          center = q$center, std.dev = q$std.dev, x = unname(q$x), y = unname(q$y),
                          sigma = unname(q$sigma), lambda = q$lambda, nsigmas = q$nsigmas,
                          limits = unname(q$limits), violations = lapply(q$violations, unname),
                          newstats = unname(q$newstats))
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))

g <- qcc(m, type = "xbar", plot = FALSE)
gu <- qcc(mu, type = "xbar", plot = FALSE)
one <- qcc(x, type = "xbar.one", plot = FALSE)
out$base <- list(g = list(center = g$center, sd = g$std.dev, stats = unname(g$statistics)),
                 gu = list(center = gu$center, sd = gu$std.dev, stats = unname(gu$statistics), n = unname(gu$sizes)),
                 one = list(center = one$center, sd = one$std.dev))
out$cusum <- list(
  g = takec(cusum(m, plot = FALSE)),
  g_cand = cand_cusum(g$statistics, 4, g$center, g$std.dev, 0.5, 0),
  g_h4_s2 = takec(cusum(m, decision.interval = 4, se.shift = 2, plot = FALSE)),
  g_h4_s2_cand = cand_cusum(g$statistics, 4, g$center, g$std.dev, 1, 0),
  g_head = takec(cusum(m, head.start = 2, plot = FALSE)),
  g_head_cand = cand_cusum(g$statistics, 4, g$center, g$std.dev, 0.5, 2),
  gu = takec(cusum(mu, plot = FALSE)),
  gu_cand = cand_cusum(gu$statistics, gu$sizes, gu$center, gu$std.dev, 0.5, 0),
  one = takec(cusum(x, plot = FALSE)),
  one_cand = cand_cusum(x, 1, one$center, one$std.dev, 0.5, 0),
  given = takec(cusum(x, center = 5, std.dev = 1, plot = FALSE)),
  given_cand = cand_cusum(x, 1, 5, 1, 0.5, 0),
  newdata = takec(cusum(x[1:15], newdata = x[16:25], plot = FALSE)),
  sd_method = try1(takec(cusum(m, std.dev = "UWAVE-SD", plot = FALSE))),
  sd_one_SD = try1(takec(cusum(x, std.dev = "SD", plot = FALSE))),
  head_big = try1(takec(cusum(m, head.start = 6, plot = FALSE)))
)
nd <- cusum(x[1:15], newdata = x[16:25], plot = FALSE)
out$cusum$newdata_cand <- cand_cusum(x, 1, nd$center, nd$std.dev, 0.5, 0)

out$ewma <- list(
  g = takee(ewma(m, plot = FALSE)),
  g_cand = cand_ewma(g$statistics, rep(4, 20), g$center, g$std.dev, 0.2),
  g_l5_n2 = takee(ewma(m, lambda = 0.5, nsigmas = 2.7, plot = FALSE)),
  g_l5_cand = cand_ewma(g$statistics, rep(4, 20), g$center, g$std.dev, 0.5),
  gu = takee(ewma(mu, plot = FALSE)),
  gu_cand = cand_ewma(gu$statistics, gu$sizes, gu$center, gu$std.dev, 0.2),
  one = takee(ewma(x, plot = FALSE)),
  one_cand = cand_ewma(x, rep(1, 25), one$center, one$std.dev, 0.2),
  given = takee(ewma(x, center = 5, std.dev = 1, lambda = 0.3, plot = FALSE)),
  given_cand = cand_ewma(x, rep(1, 25), 5, 1, 0.3),
  newdata = takee(ewma(x[1:15], newdata = x[16:25], plot = FALSE)),
  lambda1 = takee(ewma(x, lambda = 1, plot = FALSE)),
  lambda0 = try1(takee(ewma(x, lambda = 0, plot = FALSE))),
  sd_method = try1(takee(ewma(m, std.dev = "RMSDF", plot = FALSE)))
)
nde <- ewma(x[1:15], newdata = x[16:25], plot = FALSE)
out$ewma$newdata_cand <- cand_ewma(x, rep(1, 25), nde$center, nde$std.dev, 0.2)

xs <- c(3, 1, 2, 5, 4); ys <- c(10, 12, 9, 15, 11)
out$smooth <- list(
  def = ewmaSmooth(xs, ys),
  start = ewmaSmooth(xs, ys, lambda = 0.4, start = 0),
  sorted = ewmaSmooth(1:5, ys),
  cand_first = Reduce(function(a, v) 0.2 * v + 0.8 * a, ys[order(xs)], accumulate = TRUE),
  cand_start_mean = Reduce(function(a, v) 0.2 * v + 0.8 * a, ys[order(xs)], accumulate = TRUE, mean(ys))
)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
