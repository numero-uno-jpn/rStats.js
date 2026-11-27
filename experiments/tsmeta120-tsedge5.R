# tsmeta120-tsedge5.R: ets on short series (1.20.0, session 42; follow-up of tsmeta120-tsedge3). At n = 2, 3 R's ets
# reports no log-likelihood and its smoothing parameters equal HoltWinters' with simple starting values (n = 3: alpha
# 0.0876803551609 for ANN), damping is dropped with a warning; at n = 12 = m the seasonal component is dropped. Designed
# probes of where these switches happen: for each length, the method, the log-likelihood (NA for the simple fit) and
# the parameters of ANN, AAN, AAdN, MNN and of the seasonal AAA, ANA, MNM (m = 12: n = 12..26 of USAccDeaths; m = 4: n =
# 4..14 of UKgas), and whether hw() fits.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
grab <- function(expr) {
  w <- character(0)
  r <- tryCatch(withCallingHandlers(expr, warning = function(c) { w <<- c(w, conditionMessage(c)); invokeRestart("muffleWarning") }),
                error = function(e) list(error = conditionMessage(e)))
  if (length(w)) r$warnings <- unique(w)
  r
}
info <- function(f) list(method = f$method, loglik = f$loglik, par = unname(f$par), names = names(f$par),
                         mean = as.numeric(forecast(f, h = 2)$mean))
y0 <- as.numeric(USAccDeaths)
ns <- list()
for (n in 2:10) {
  x <- y0[1:n]
  ns[[as.character(n)]] <- list(ANN = grab(info(ets(x, model = "ANN"))), AAN = grab(info(ets(x, model = "AAN", damped = FALSE))),
    AAdN = grab(info(ets(x, model = "AAN", damped = TRUE))), MNN = grab(info(ets(x, model = "MNN"))), ZZZ = grab(info(ets(x))))
}
out$nonseasonal <- ns
s12 <- list()
for (n in 12:26) {
  x <- ts(y0[1:n], frequency = 12)
  s12[[as.character(n)]] <- list(AAA = grab(info(ets(x, model = "AAA", damped = FALSE))), ANA = grab(info(ets(x, model = "ANA"))),
    MNM = grab(info(ets(x, model = "MNM"))), ZZZ = grab(info(ets(x))), hw = grab(list(mean = as.numeric(hw(x, h = 2)$mean))))
}
out$seasonal12 <- s12
g0 <- as.numeric(UKgas)
s4 <- list()
for (n in 4:14) {
  x <- ts(g0[1:n], frequency = 4)
  s4[[as.character(n)]] <- list(AAA = grab(info(ets(x, model = "AAA", damped = FALSE))), ANA = grab(info(ets(x, model = "ANA"))),
    MNM = grab(info(ets(x, model = "MNM"))), ZZZ = grab(info(ets(x))), hw = grab(list(mean = as.numeric(hw(x, h = 2)$mean))))
}
out$seasonal4 <- s4
# HoltWinters with the simple starts on the same short series, for comparison with the simple ets fits
hwc <- list()
for (n in 2:6) {
  x <- y0[1:n]
  hwc[[as.character(n)]] <- list(level = grab({ f <- HoltWinters(x, beta = FALSE, gamma = FALSE); list(alpha = unname(f$alpha)) }),
    trend = grab({ f <- HoltWinters(x, gamma = FALSE); list(alpha = unname(f$alpha), beta = unname(f$beta)) }))
}
out$holtwinters <- hwc
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), na = "null", null = "null"))
