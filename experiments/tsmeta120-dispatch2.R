# tsmeta120-dispatch2.R: forecast(z24short) chose ETS(A,N,N) in R but ETS(A,Ad,N) in rStats.js (log item 93). Designed:
# the same series (seed 41, as tsmeta120-dispatch.R), each candidate model's AICc, loglik and parameters in R, with
# frequency 24 and as a non-seasonal series.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
set.seed(41)
z24 <- ts(10 + sin(2 * pi * (1:120) / 24) * 3 + rnorm(120), frequency = 24)
z <- ts(as.numeric(z24)[1:40], frequency = 24)
tc <- function(expr) tryCatch(expr, error = function(err) paste("error:", conditionMessage(err)))
one <- function(f) if (is.character(f)) f else list(method = f$method, aicc = f$aicc, loglik = f$loglik, par = as.list(f$par))
cands <- list(ANN = tc(ets(z, model = "ANN")), AAN = tc(ets(z, model = "AAN", damped = FALSE)), AAdN = tc(ets(z, model = "AAN", damped = TRUE)),
              MNN = tc(ets(z, model = "MNN")), MAN = tc(ets(z, model = "MAN", damped = FALSE)), MAdN = tc(ets(z, model = "MAN", damped = TRUE)),
              ZZZ = tc(ets(z)), ZZZ_ns = tc(ets(ts(as.numeric(z)))))
cat(toJSON(list(y = as.numeric(z), cands = lapply(cands, one)), digits = I(17), auto_unbox = TRUE, na = "null"))
