# demo120-ets.R: which ets models on the first 48 values of USAccDeaths R fits to the same optimum as rStats.js (the
# demo example; session 42): the log-likelihood of each.
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
y <- ts(as.numeric(USAccDeaths)[1:48], frequency = 12)
out <- list()
for (m in c("ANA", "AAA", "MAM", "MNA", "MNM", "ANN", "MNN")) out[[m]] <- tryCatch({ f <- ets(y, model = m, damped = FALSE); list(loglik = f$loglik, mean = as.numeric(forecast(f, h = 2)$mean)) }, error = function(e) list(error = conditionMessage(e)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE))
