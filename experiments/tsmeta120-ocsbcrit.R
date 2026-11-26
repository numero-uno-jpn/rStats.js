# tsmeta120-ocsbcrit.R: the critical values that forecast's ocsb.test reports, read off its output for m = 2..400 and
# a few larger periods (1.20.0). The help page says they "are based on simulations, which have been smoothed over to
# produce critical values for all seasonal periods"; the smoothing function is not shown, so the values themselves
# are recorded as data (as the Phillips-Ouliaris table in tsmeta120-po). The value does not depend on the data:
# checked by two different series for each m.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
ms <- c(2:400, 500, 730, 1000, 8766)
crit <- sapply(ms, function(m) { set.seed(m); unname(ocsb.test(ts(rnorm(m * 4 + 10), frequency = m))$critical) })
crit2 <- sapply(ms, function(m) { set.seed(m + 1e5); unname(ocsb.test(ts(cumsum(rnorm(m * 5 + 3)), frequency = m))$critical) })
cat(toJSON(list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")),
                m = ms, critical = crit, same_for_other_data = max(abs(crit - crit2))), digits = I(17), auto_unbox = TRUE))
