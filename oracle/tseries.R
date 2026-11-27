# issue: 570
# oracle-platform: amd64
# Public outputs of tseries 0.10.63's adf.test, kpss.test, pp.test, po.test, jarque.bera.test, runs.test, white.test and
# terasvirta.test for test/fixtures/tseries.json (1.20.0). The behaviour is in oracle/tsmeta-behaviour.md; the
# experiments behind it in experiments/tsmeta120-tseries*.R, -white.R, -po*.R, -tables*.R (log 6-9, 14-15, 17-18, 94).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
q <- function(expr) suppressWarnings(expr)
ht <- function(r) list(statistic = unname(r$statistic), parameter = if (is.null(r$parameter)) NULL else unname(r$parameter), p = r$p.value)
set.seed(51)
series <- list(lh = as.numeric(lh), lake = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30), lair = log(as.numeric(AirPassengers)),
               ar600 = as.numeric(arima.sim(list(ar = 0.6), 600)) + 0.01 * (1:600), expl = cumprod(rep(1.03, 60)) + rnorm(60, 0, 0.1))
uni <- lapply(series, function(y) list(y = y,
  adf = ht(q(adf.test(y))), adf_expl = ht(q(adf.test(y, alternative = "explosive"))), adf_k2 = ht(q(adf.test(y, k = 2))), adf_k0 = ht(q(adf.test(y, k = 0))),
  kpss_level = ht(q(kpss.test(y))), kpss_trend = ht(q(kpss.test(y, null = "Trend"))), kpss_long = ht(q(kpss.test(y, lshort = FALSE))),
  pp_alpha = ht(q(pp.test(y))), pp_tau = ht(q(pp.test(y, type = "Z(t_alpha)"))), pp_long = ht(q(pp.test(y, lshort = FALSE))), pp_expl = ht(q(pp.test(y, alternative = "explosive", type = "Z(t_alpha)"))),
  jb = ht(jarque.bera.test(y)),
  runs = ht(runs.test(factor(y > median(y)))), runs_less = ht(runs.test(factor(y > median(y)), alternative = "less")), runs_greater = ht(runs.test(factor(y > median(y)), alternative = "greater")),
  tera = ht(terasvirta.test(ts(y))), tera_F = ht(terasvirta.test(ts(y), type = "F")), tera_l2 = ht(terasvirta.test(ts(y), lag = 2)), tera_noscale = ht(terasvirta.test(ts(y), scale = FALSE)),
  white = { set.seed(1); ht(white.test(ts(y))) }, white_F = { set.seed(7); ht(white.test(ts(y), type = "F")) },
  white_l2 = { set.seed(3); ht(white.test(ts(y), lag = 2, q = 6, qstar = 3)) }))
set.seed(52)
po <- list()
for (k in 2:4) for (dm in c(TRUE, FALSE)) for (lsh in c(TRUE, FALSE)) {
  n <- 150; X <- apply(matrix(rnorm(n * (k - 1)), n, k - 1), 2, cumsum)
  Y <- cbind(rowSums(X) + as.numeric(arima.sim(list(ar = runif(1, 0.5, 0.98)), n)), X)
  po[[length(po) + 1]] <- list(x = unname(Y), demean = dm, lshort = lsh, r = ht(q(po.test(Y, demean = dm, lshort = lsh))))
}
writeLines(toJSON(list(uni = uni, po = po), digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "tseries.json"))
