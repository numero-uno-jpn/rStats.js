# tsmeta120-tsedge4.R: auto.arima on short series (1.20.0, session 42; follow-up of tsmeta120-tsedge3). Designed
# probes of three things seen in the traces of tsedge3: (1) the criterion printed in the trace for very short series
# (the AIC at n = 2, 3, the AICc at n = 12): the lengths 2..14 of a non-seasonal series, the trace's value of the
# ARIMA(0,0,0) models with f$aic / f$aicc of the same fits; (2) the largest non-seasonal orders the search starts from
# (2,0,2 at n = 12, 1,0,1 at n = 3): the first trace line for n = 2..14; (3) the seasonal orders (none at n = 25, P = Q = 1
# at n = 36 with m = 12): the first trace lines for n = 25..49 of USAccDeaths, and for m = 4 (UKgas) n = 9..17.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
grab <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)))
set.seed(7)
w <- round(100 + cumsum(rnorm(14)) * 3, 2)
out$w <- w
ns <- list()
for (n in 2:14) {
  x <- w[1:n]
  ns[[as.character(n)]] <- grab({
    tr <- capture.output(f <- auto.arima(x, trace = TRUE, d = 0))
    z <- Arima(x, order = c(0, 0, 0), include.mean = FALSE)
    m <- Arima(x, order = c(0, 0, 0), include.mean = TRUE)
    list(trace = tr, arma = f$arma, zero = c(z$aic, z$aicc, z$loglik), mean = c(m$aic, m$aicc, m$loglik))
  })
}
out$nonseasonal <- ns
y0 <- as.numeric(USAccDeaths)
s12 <- list()
for (n in c(25, 26, 30, 35, 36, 37, 47, 48, 49, 60, 71, 72)) {
  s12[[as.character(n)]] <- grab({
    tr <- capture.output(f <- auto.arima(ts(y0[1:n], frequency = 12), trace = TRUE, D = 1, d = 1))
    list(trace = tr[1:min(4, length(tr))], arma = f$arma)
  })
}
out$seasonal12 <- s12
g0 <- as.numeric(UKgas)
out$ukgas <- g0
sq <- list()
for (n in 9:17) {
  sq[[as.character(n)]] <- grab({
    tr <- capture.output(f <- auto.arima(ts(g0[1:n], frequency = 4), trace = TRUE, D = 1, d = 1))
    list(trace = tr[1:min(4, length(tr))], arma = f$arma)
  })
}
out$seasonal4 <- sq
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
