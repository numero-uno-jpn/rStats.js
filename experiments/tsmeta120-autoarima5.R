# tsmeta120-autoarima5.R: forecast's auto.arima stepwise search (1.20.0, log item 81). In the autoArima fixture R's
# LakeHuron trace stops after one model once ARIMA(0,1,0) without drift (the fifth initial model) is the best; the
# hypothesis: the search then takes the neighbours of the best orders with the constant flag of the earlier best (with
# drift). Designed: series for which the model without the constant is likely the best after the initial models:
# random walks without drift (d = 1) and zero-mean noise (d = 0), with AR or MA structure so that the search goes on.
# The traces are recorded and compared outside R with the search replayed under each hypothesis.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
set.seed(20261131)
rows <- list()
for (it in 1:16) {
  n <- sample(60:140, 1); kind <- it %% 2
  e <- as.numeric(arima.sim(list(ar = runif(1, 0.2, 0.6), ma = runif(1, -0.5, 0.5)), n))
  y <- if (kind == 0) cumsum(e) else e
  lines <- capture.output(fit <- auto.arima(y, trace = TRUE))
  rows[[it]] <- list(y = y, kind = kind, trace = lines, order = unname(arimaorder(fit)))
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
