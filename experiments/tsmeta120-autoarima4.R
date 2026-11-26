# tsmeta120-autoarima4.R: forecast's auto.arima with approximation = TRUE, fourth experiment (1.20.0). The offset of
# tsmeta120-autoarima3 is nonzero only with seasonal differencing (D = 1). Candidate, written for this experiment: the
# approximate -2 loglik of a model = nobs log(sigma2_CSS) + offset, with offset = -2 loglik - nobs log(sigma2) of a
# reference fit by maximum likelihood (CSS-ML); so printed - (CSS AICc) = offset - nobs (log(2 pi) + 1). For every
# traced model and for ARIMA(0,d,0)(0,D,0), ARIMA(2,d,2)(1,D,1) and (0,d,1)(0,D,1) the quantity
# q = -2 loglik_ML - nobs log(sigma2_ML) - nobs (log(2 pi) + 1) is recorded beside the series' offset, also with
# sigma2 taken as the CSS-ML fit's sum of squared residuals / nobs.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
parseLine <- function(line) {
  g <- regmatches(line, regexec("ARIMA\\((\\d+),(\\d+),(\\d+)\\)(\\((\\d+),(\\d+),(\\d+)\\)\\[\\d+\\])?(.*):\\s*(\\S+)\\s*$", line))[[1]]
  if (!length(g)) return(NULL)
  list(order = as.integer(g[2:4]), seasonal = if (nzchar(g[6])) as.integer(g[6:8]) else c(0L, 0L, 0L),
       constant = grepl("non-zero mean|drift", g[9]), printed = if (g[10] == "Inf") Inf else as.numeric(g[10]))
}
minRoot <- function(fit, m) {
  cf <- coef(fit); g <- function(pat) cf[grep(pat, names(cf))]
  mk <- function(ns, s, sg) { p <- 1; if (length(ns)) p <- c(1, sg * ns)
    if (length(s)) { q <- numeric(m * length(s) + 1); q[1] <- 1; q[m * seq_along(s) + 1] <- sg * s; p <- convolve(p, rev(q), type = "open") }; p }
  r <- function(p) { p <- p[seq_len(max(which(abs(p) > 0)))]; if (length(p) <= 1) Inf else min(Mod(polyroot(p))) }
  min(r(mk(g("^ar"), g("^sar"), -1)), r(mk(g("^ma"), g("^sma"), 1)))
}
series <- list(air = AirPassengers, logair = log(AirPassengers), usacc = USAccDeaths, nottem = nottem, uk = UKgas, co2 = co2)
for (nm in names(series)) {
  y <- series[[nm]]; m <- frequency(y)
  tr <- capture.output(fit <- auto.arima(y, approximation = TRUE, trace = TRUE))
  specs <- Filter(Negate(is.null), lapply(tr, parseLine))
  d <- specs[[1]]$order[2]; D <- specs[[1]]$seasonal[2]
  extra <- list(list(order = c(0, d, 0), seasonal = c(0, D, 0), constant = FALSE), list(order = c(2, d, 2), seasonal = c(1, D, 1), constant = FALSE),
                list(order = c(0, d, 1), seasonal = c(0, D, 1), constant = FALSE))
  offs <- NULL; qs <- list()
  for (p in c(specs, extra)) {
    cs <- tryCatch(Arima(y, order = p$order, seasonal = p$seasonal, include.constant = p$constant, method = "CSS"), error = function(e) NULL)
    ml <- tryCatch(Arima(y, order = p$order, seasonal = p$seasonal, include.constant = p$constant, method = "CSS-ML"), error = function(e) NULL)
    if (is.null(cs) || is.null(ml)) next
    k <- length(coef(cs)); npar <- k + 1; nobs <- cs$nobs
    aiccC <- -2 * cs$loglik + 2 * npar + 2 * npar * (npar + 1) / (nobs - npar - 1)
    if (!is.null(p$printed) && is.finite(p$printed)) offs <- c(offs, p$printed - aiccC)
    ss <- sum(residuals(ml)^2, na.rm = TRUE)
    qs[[length(qs) + 1]] <- c(p$order, p$seasonal, q1 = -2 * ml$loglik - nobs * log(ml$sigma2) - nobs * (log(2 * pi) + 1),
                              q2 = -2 * ml$loglik - nobs * log(ss / nobs) - nobs * (log(2 * pi) + 1))
  }
  out[[nm]] <- list(offsets = offs, q = do.call(rbind, qs))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
