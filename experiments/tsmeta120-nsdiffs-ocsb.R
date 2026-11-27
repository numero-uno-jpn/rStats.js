# tsmeta120-nsdiffs-ocsb.R: forecast's nsdiffs(test = "ocsb") (1.20.0, log item 80). The fixture showed 5 of 120
# decisions different from "statistic of ocsb.test(y) (defaults) > its critical value", in both directions, mostly
# for short series. Recorded beside nsdiffs: ocsb.test's statistic and critical value for lag.method "fixed", "AIC",
# "BIC", "AICc" and maxlag 0..3, and the length; the decision rules are applied outside R. Designed: lengths from
# 2m + 1 to 12m, m = 4 and 12, seasonal random walks and stationary seasonal series.
# Run 2 (edited in place; run 1's output kept as -run1.json): the series itself, and for maxlag 3 with "AIC" the
# fitted model's coefficient names, estimates and number of residuals, to see the regression's form.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
set.seed(20261130)
rows <- list()
for (it in 1:300) {
  m <- sample(c(4, 12), 1); n <- sample((2 * m + 1):(12 * m), 1); kind <- it %% 3
  e <- rnorm(n); y <- e
  if (kind == 0) for (t in (m + 1):n) y[t] <- y[t - m] + e[t]
  if (kind == 1) y <- 2 * sin(2 * pi * (1:n) / m) + e
  if (kind == 2) for (t in (m + 1):n) y[t] <- runif(1, 0.3, 0.95) * y[t - m] + e[t]
  yy <- ts(y, frequency = m)
  st <- list()
  for (lm_ in c("fixed", "AIC", "BIC", "AICc")) for (ml in 0:3) {
    o <- tryCatch(ocsb.test(yy, lag.method = lm_, maxlag = ml), error = function(err) NULL)
    st[[paste(lm_, ml, sep = "_")]] <- if (is.null(o)) NA else c(unname(o$statistics), unname(o$critical), unname(o$lag.order))
  }
  o3 <- tryCatch(ocsb.test(yy, lag.method = "AIC", maxlag = 3), error = function(err) conditionMessage(err))
  fm <- if (is.character(o3)) list(error = o3) else list(names = names(coef(o3$fitted.model)), coef = unname(coef(o3$fitted.model)),
                                                         nres = length(residuals(o3$fitted.model)))
  rows[[it]] <- list(m = m, n = n, kind = kind, y = y, D = nsdiffs(yy, test = "ocsb"), stats = st, model = fm)
}
cat(toJSON(list(R = R.version.string, arch = R.version$arch, rows = rows), digits = I(17), auto_unbox = TRUE, na = "null"))
