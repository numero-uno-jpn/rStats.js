# tsmeta120-simple3.R: tsCV's first origin (1.20.0, log item 91). Designed: naive / meanf / rwf on one observation
# (error or value?), and tsCV with a function that returns a constant whatever the length (does tsCV skip origin 1?),
# and with initial = 0 / 1.
# Output: JSON on stdout. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
tc <- function(expr) tryCatch(expr, error = function(err) paste("error:", conditionMessage(err)))
one <- ts(5)
res <- list(naive1 = tc(as.numeric(naive(one, h = 1)$mean)), meanf1 = tc(as.numeric(meanf(one, h = 1)$mean)), rwf1 = tc(as.numeric(rwf(one, h = 1)$mean)),
  const_cv = as.numeric(tsCV(ts(c(1, 2, 4, 8)), function(x, h) structure(list(mean = ts(rep(0, h), start = length(x) + 1)), class = "forecast"), h = 1)),
  const_cv_init1 = as.numeric(tsCV(ts(c(1, 2, 4, 8)), function(x, h) structure(list(mean = ts(rep(0, h), start = length(x) + 1)), class = "forecast"), h = 1, initial = 1)))
cat(toJSON(res, digits = I(17), auto_unbox = TRUE, na = "null"))
