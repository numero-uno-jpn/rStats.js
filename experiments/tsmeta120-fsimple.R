# tsmeta120-fsimple.R: forecast's simple methods and small functions (1.20.0), first experiment. Candidates written for
# this experiment from the help pages and Hyndman and Athanasopoulos (Forecasting: Principles and Practice, 2nd ed.,
# sections 3.1, 3.4, 3.5, 5.5):
#   meanf: mean, se = s sqrt(1 + 1/n) with s = sd(y), quantile qt(., n - 1);
#   naive / rwf: fitted y_{t-1} (plus the drift b = (y_n - y_1)/(n - 1)); sigma candidates S1 = sqrt(mean(res^2)),
#     S2 = sd(res); se_h = sigma sqrt(h) (naive), sigma sqrt(h (1 + h / (n - 1))) (drift); quantile qnorm;
#   snaive: fitted y_{t-m}, se_h = sigma sqrt(floor((h - 1) / m) + 1);
#   accuracy (training): ME, RMSE, MAE, MPE, MAPE, MASE (scale = mean |y_t - y_{t-m}| over the training data, m = 1
#     for non-seasonal), ACF1 = lag-1 autocorrelation of the residuals; with a test set, Theil's U;
#   ma: the moving average of the help page (centred for even orders);
#   fourier: S_k = sin(2 pi k t / m), C_k = cos(2 pi k t / m), t = 1..n (t = n + 1.. with h), sin dropped at k = m/2;
#   seasonaldummy: m - 1 indicator columns (candidate: the last period omitted);
#   monthdays: days in each month; easter: the share of Good Friday .. Easter Sunday (.. Monday) in each month or
#     quarter, Easter by the anonymous Gregorian algorithm;
#   dm.test (Harvey, Leybourne and Newbold 1997): d = |e1|^p - |e2|^p, V = gamma_0 + 2 sum_{k<h} gamma_k
#     (autocovariances over n), DM = mean(d) / sqrt(V / n), HLN = DM sqrt((n + 1 - 2h + h (h - 1) / n) / n),
#     p from t(n - 1);
#   CV (lm): CV = mean((e / (1 - hat))^2), AIC = n log(SSE / n) + 2 (k + 2), AICc, BIC, AdjR2 (k = predictors);
#   checkresiduals: Ljung-Box with lag min(10, n/5) (2m for seasonal) and at least df + 3, df = the model's
#     ARMA coefficients.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
mx <- function(a, b) max(abs(as.numeric(a) - as.numeric(b)), na.rm = TRUE)

# meanf
y <- as.numeric(Nile); n <- length(y)
f <- meanf(Nile, h = 5, level = c(80, 95))
seM <- sd(y) * sqrt(1 + 1 / n)
out$meanf <- list(mean = mx(f$mean, rep(mean(y), 5)),
  lower = mx(f$lower, cbind(mean(y) - qt(0.9, n - 1) * seM, mean(y) - qt(0.975, n - 1) * seM)[rep(1, 5), ]),
  fitted = mx(fitted(f), rep(mean(y), n)), residuals = mx(residuals(f), y - mean(y)))

# naive, rwf with drift, snaive
for (cs in list(list("m_naive", Nile, FALSE, 1), list("m_drift", Nile, TRUE, 1), list("m_snaive", AirPassengers, FALSE, 12))) {
  x <- as.numeric(cs[[2]]); n <- length(x); m <- cs[[4]]; h <- 30
  fc <- if (cs[[1]] == "m_snaive") snaive(cs[[2]], h = h) else rwf(cs[[2]], h = h, drift = cs[[3]])
  b <- if (cs[[3]]) (x[n] - x[1]) / (n - 1) else 0
  fit <- c(rep(NA, m), x[1:(n - m)] + b); res <- x - fit
  S1 <- sqrt(mean(res^2, na.rm = TRUE)); S2 <- sd(res, na.rm = TRUE)
  hh <- 1:h
  mult <- if (cs[[1]] == "m_snaive") sqrt(floor((hh - 1) / m) + 1) else if (cs[[3]]) sqrt(hh * (1 + hh / (n - 1))) else sqrt(hh)
  pt <- if (cs[[1]] == "m_snaive") x[n - m + ((hh - 1) %% m) + 1] else x[n] + b * hh
  half <- (as.numeric(fc$upper[, 2]) - as.numeric(fc$mean)) / qnorm(0.975)
  out[[cs[[1]]]] <- list(mean = mx(fc$mean, pt), fitted = mx(fitted(fc), fit), ratio_S1 = half / (S1 * mult),
                         ratio_S2 = half / (S2 * mult), sigma_model = fc$model$sigma, S1 = S1, S2 = S2)
}

# accuracy
tr <- window(AirPassengers, end = c(1958, 12)); te <- window(AirPassengers, start = c(1959, 1))
fcA <- forecast(Arima(tr, order = c(0, 1, 1), seasonal = c(0, 1, 1), lambda = 0), h = 24)
acc <- accuracy(fcA, te)
e <- as.numeric(tr) - as.numeric(fitted(fcA)); yt <- as.numeric(tr)
scale <- mean(abs(diff(yt, lag = 12)))
et <- as.numeric(te) - as.numeric(fcA$mean); ytest <- as.numeric(te)
row <- function(e, y) c(ME = mean(e), RMSE = sqrt(mean(e^2)), MAE = mean(abs(e)), MPE = 100 * mean(e / y),
                        MAPE = 100 * mean(abs(e / y)), MASE = mean(abs(e)) / scale,
                        ACF1 = acf(e, plot = FALSE, lag.max = 1)$acf[2])
fpe <- (ytest[-1] - as.numeric(fcA$mean)[-1]) / ytest[-length(ytest)]
ape <- (ytest[-1] - ytest[-length(ytest)]) / ytest[-length(ytest)]
theil <- sqrt(sum(fpe^2) / sum(ape^2))
out$accuracy <- list(R = unname(acc), cols = colnames(acc), rows = rownames(acc), cand_train = row(e, yt),
                     cand_test = c(row(et, ytest), Theil = theil))

# ma
out$ma <- list(odd = mx(ma(Nile, 5), stats::filter(Nile, rep(1 / 5, 5))),
               even_centre = mx(ma(Nile, 4), stats::filter(Nile, c(0.5, 1, 1, 1, 0.5) / 4)),
               even_nocentre = mx(ma(Nile, 4, centre = FALSE), stats::filter(Nile, rep(1 / 4, 4))))

# fourier, seasonaldummy
F1 <- fourier(AirPassengers, K = 6); t1 <- seq_len(length(AirPassengers))
cand <- NULL; nm <- NULL
for (k in 1:6) {
  if (k < 6) { cand <- cbind(cand, sin(2 * pi * k * t1 / 12)); nm <- c(nm, paste0("S", k, "-12")) }
  cand <- cbind(cand, cos(2 * pi * k * t1 / 12)); nm <- c(nm, paste0("C", k, "-12"))
}
Fh <- fourier(AirPassengers, K = 2, h = 5); th <- length(AirPassengers) + 1:5
out$fourier <- list(names = colnames(F1), cand_names = nm, d = if (ncol(F1) == ncol(cand)) mx(F1, cand) else "ncol",
                    names_h = colnames(Fh), d_h = mx(Fh, cbind(sin(2 * pi * th / 12), cos(2 * pi * th / 12),
                                                                sin(4 * pi * th / 12), cos(4 * pi * th / 12))))
D <- seasonaldummy(window(AirPassengers, start = c(1949, 3)))
out$seasonaldummy <- list(names = colnames(D), first_rows = unname(D[1:3, ]), ncol = ncol(D))

# monthdays, easter
md <- monthdays(ts(1:30, start = c(1999, 1), frequency = 12))
out$monthdays <- list(R = as.numeric(md), feb = as.numeric(md)[c(2, 14, 26)])
out$easter <- list(monthly = as.numeric(easter(ts(1:60, start = c(2000, 1), frequency = 12))),
                   monthly_mon = as.numeric(easter(ts(1:60, start = c(2000, 1), frequency = 12), easter.mon = TRUE)),
                   quarterly = as.numeric(easter(ts(1:20, start = c(2000, 1), frequency = 4))))

# dm.test
set.seed(1); e1 <- rnorm(80); e2 <- rnorm(80, sd = 1.2) + 0.3 * c(0, e1[-80])
dmres <- list()
for (h in c(1, 3)) for (p in c(1, 2)) for (alt in c("two.sided", "less", "greater")) {
  r <- dm.test(e1, e2, h = h, power = p, alternative = alt)
  d <- abs(e1)^p - abs(e2)^p; n <- length(d)
  g <- acf(d, lag.max = h - 1, type = "covariance", plot = FALSE)$acf[, 1, 1]
  V <- g[1] + 2 * sum(g[-1]); DM <- mean(d) / sqrt(V / n); HLN <- DM * sqrt((n + 1 - 2 * h + h * (h - 1) / n) / n)
  pc <- switch(alt, two.sided = 2 * pt(-abs(HLN), n - 1), less = pt(HLN, n - 1), greater = pt(HLN, n - 1, lower.tail = FALSE))
  dmres[[paste(h, p, alt)]] <- c(stat = unname(r$statistic), cand = HLN, p = r$p.value, cand_p = pc)
}
out$dm <- dmres

# CV
fitL <- tslm(AirPassengers ~ trend + season)
cvR <- CV(fitL)
e <- residuals(fitL); hat <- hatvalues(fitL); n <- length(e); k <- length(coef(fitL)) - 1; sse <- sum(e^2)
aic <- n * log(sse / n) + 2 * (k + 2)
out$CV <- list(R = unname(cvR), names = names(cvR),
  cand = c(CV = mean((e / (1 - hat))^2), AIC = aic, AICc = aic + 2 * (k + 2) * (k + 3) / (n - k - 3),
           BIC = n * log(sse / n) + (k + 2) * log(n), AdjR2 = summary(fitL)$adj.r.squared))

# checkresiduals
fitA <- Arima(AirPassengers, order = c(1, 1, 1), seasonal = c(0, 1, 1), lambda = 0)
printed <- capture.output(cr <- checkresiduals(fitA, plot = FALSE))   # it prints the test; kept below
rr <- residuals(fitA); lagc <- max(3 + 3, min(24, length(rr) / 5))
bt <- Box.test(rr, lag = lagc, type = "Ljung-Box", fitdf = 3)
out$checkresiduals <- list(stat = unname(cr$statistic), df = unname(cr$parameter), p = cr$p.value,
                           method = cr$method, cand_stat = unname(bt$statistic), cand_lag = lagc, printed = printed)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
