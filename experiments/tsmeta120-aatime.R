# tsmeta120-aatime.R: the time of R's auto.arima on the first 48 values of USAccDeaths (1.20.0, session 42, log 112:
# rStats.js's autoArima took 12 s there), and the number of models it fits.
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
y <- ts(as.numeric(USAccDeaths)[1:48], frequency = 12)
t1 <- system.time(f <- auto.arima(y))[["elapsed"]]
t2 <- system.time(for (i in 1:10) Arima(y, order = c(0, 1, 1), seasonal = c(0, 1, 1)))[["elapsed"]] / 10
t3 <- system.time(for (i in 1:10) Arima(y, order = c(2, 1, 2), seasonal = c(1, 1, 1)))[["elapsed"]] / 10
tr <- capture.output(auto.arima(y, trace = TRUE))
cat(toJSON(list(auto = t1, airline = t2, big = t3, arma = f$arma, models = length(grep("ARIMA", tr)) - 1), auto_unbox = TRUE))
