# tsmeta120-autoarima2.R: forecast's auto.arima, second experiment (1.20.0). Each model of the trace (parsed from the
# printed lines) refitted with Arima to find what the printed criterion is, with candidates written for this
# experiment from Hyndman and Khandakar (2008, J. Statistical Software 27(3)):
#   the printed value = aicc of Arima(order, seasonal, include.constant) with method "CSS-ML" (C1) or "ML" (C2);
#   "Inf" = the fit failed or a root of the AR / MA polynomials (seasonal ones multiplied out) lies within 1.01 of
#     the unit circle (R1: |root| < 1.01 for AR or MA; R2: AR only), or (R3) the fitted variance is degenerate;
#   with approximation: the CSS fit (method "CSS"); recorded for each model: its loglik, sigma2, nobs and the
#     criterion printed, to find the offset outside R.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
parseLine <- function(line, m) {
  g <- regmatches(line, regexec("ARIMA\\((\\d+),(\\d+),(\\d+)\\)(\\((\\d+),(\\d+),(\\d+)\\)\\[\\d+\\])?(.*):\\s*(\\S+)\\s*$", line))[[1]]
  if (!length(g)) return(NULL)
  rest <- g[9]; val <- suppressWarnings(as.numeric(g[10]))
  list(order = as.integer(g[2:4]), seasonal = if (nzchar(g[6])) as.integer(g[6:8]) else c(0L, 0L, 0L),
       constant = grepl("non-zero mean|drift", rest), drift = grepl("drift", rest), printed = if (g[10] == "Inf") Inf else val)
}
rootsMin <- function(fit, m) {
  cf <- coef(fit); arC <- cf[grep("^ar", names(cf))]; maC <- cf[grep("^ma", names(cf))]
  sar <- cf[grep("^sar", names(cf))]; sma <- cf[grep("^sma", names(cf))]
  poly <- function(ns, s, sign) { p <- 1; if (length(ns)) p <- c(1, sign * ns); if (length(s)) { q <- numeric(m * length(s) + 1); q[1] <- 1; q[m * seq_along(s) + 1] <- sign * s; p <- convolve(p, rev(q), type = "open") }; p }
  arp <- poly(arC, sar, -1); map <- poly(maC, sma, 1)
  r <- function(p) { p <- p[seq_len(max(which(abs(p) > 0)))]; if (length(p) <= 1) Inf else min(Mod(polyroot(p))) }
  c(ar = r(arp), ma = r(map))
}
for (cs in list(list("usacc", USAccDeaths, FALSE), list("lh", lh, FALSE), list("wwwusage", WWWusage, FALSE),
                list("air", AirPassengers, FALSE), list("air_approx", AirPassengers, TRUE), list("lakehuron", LakeHuron, FALSE))) {
  tr <- capture.output(fit <- auto.arima(cs[[2]], approximation = cs[[3]], trace = TRUE))
  m <- frequency(cs[[2]]); rows <- list()
  for (line in tr) {
    p <- parseLine(line, m); if (is.null(p)) next
    fitC <- function(method) tryCatch(Arima(cs[[2]], order = p$order, seasonal = p$seasonal, include.constant = p$constant, method = method),
                                      error = function(e) NULL)
    a <- fitC("CSS-ML"); b <- fitC("ML"); cc <- fitC("CSS")
    rows[[length(rows) + 1]] <- list(line = line, order = p$order, seasonal = p$seasonal, constant = p$constant, printed = p$printed,
      C1 = if (is.null(a)) "fail" else a$aicc, C2 = if (is.null(b)) "fail" else b$aicc,
      roots = if (is.null(a)) NA else rootsMin(a, m),
      css = if (is.null(cc)) "fail" else list(loglik = cc$loglik, sigma2 = cc$sigma2, nobs = cc$nobs, aic = cc$aic, ncoef = length(coef(cc)),
                                              n_cond = cc$n.cond))
  }
  out[[cs[[1]]]] <- list(rows = rows, n = length(cs[[2]]))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
