# tsmeta120-autoarima3.R: forecast's auto.arima with approximation = TRUE, third experiment (1.20.0).
# tsmeta120-autoarima2 found the printed criterion = the AICc of the CSS fit (npar = coefficients + 1, nobs =
# n - d - sD) plus an offset that is constant within a series (-65.2725 for AirPassengers). Here, for several series
# (lengths, scales, d, D), the offset is computed from one traced model and recorded beside candidate ingredients
# written for this experiment: n, nobs, the CSS and the ML (CSS-ML) log-likelihoods of ARIMA(0,d,0)(0,D,0) and of the
# selected model, log(var(differenced series)), log(2 pi); and whether the "Inf" rejections follow the roots of the
# CSS fits (|root| < 1.01).
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
set.seed(4)
series <- list(air = AirPassengers, logair = log(AirPassengers), usacc = USAccDeaths, co2 = co2, nottem = nottem,
               long = ts(cumsum(rnorm(400)) + 10, frequency = 1), uk = UKgas, sun = ts(as.numeric(sunspot.month)[1:600], frequency = 12))
for (nm in names(series)) {
  y <- series[[nm]]; m <- frequency(y)
  tr <- capture.output(fit <- auto.arima(y, approximation = TRUE, trace = TRUE))
  rows <- list()
  for (line in tr) {
    p <- parseLine(line); if (is.null(p)) next
    cs <- tryCatch(Arima(y, order = p$order, seasonal = p$seasonal, include.constant = p$constant, method = "CSS"), error = function(e) NULL)
    if (is.null(cs)) { rows[[length(rows) + 1]] <- list(line = line, printed = p$printed, css = "fail"); next }
    k <- length(coef(cs)); npar <- k + 1; nobs <- cs$nobs
    aiccC <- -2 * cs$loglik + 2 * npar + 2 * npar * (npar + 1) / (nobs - npar - 1)
    rows[[length(rows) + 1]] <- list(line = line, printed = p$printed, offset = p$printed - aiccC, root = minRoot(cs, m), d = p$order[2], D = p$seasonal[2])
  }
  d <- arimaorder(fit)[2]; D <- if (m > 1) arimaorder(fit)[5] else 0
  base <- Arima(y, order = c(0, d, 0), seasonal = c(0, D, 0), include.constant = FALSE, method = "CSS")
  baseML <- Arima(y, order = c(0, d, 0), seasonal = c(0, D, 0), include.constant = FALSE, method = "CSS-ML")
  w <- as.numeric(y); if (d) w <- diff(w, differences = d); if (D) w <- diff(w, lag = m, differences = D)
  out[[nm]] <- list(rows = rows, n = length(y), m = m, d = d, D = D, nobs_w = length(w), var_w = var(w), mean_sq_w = mean(w^2),
                    base_css_loglik = base$loglik, base_ml_loglik = baseML$loglik, base_css_sigma2 = base$sigma2, base_ml_sigma2 = baseML$sigma2)
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
