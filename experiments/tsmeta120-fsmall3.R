# tsmeta120-fsmall3.R: forecast's small functions, third experiment (1.20.0): the open points of tsmeta120-fsmall2.
# Candidates written for this experiment:
#   easter without Easter Monday: the shares rounded to two decimals (round(., 2));
#   tsCV with h = 1: the error of origin t in position t (y[t + 1] - f), NA where the forecast function fails;
#   BoxCox.lambda "guerrero": optimize over [lower, upper] with the default tolerance (exact equality sought);
#   findfrequency: candidates for "no dominant frequency": (F1) 1 when the AR order is 0; (F2) 1 when the maximum is
#     at the lowest frequency, otherwise the period at the maximum; (F3) like F2 but searching the local maxima after
#     the first trough; printed for series with and without a peak;
#   na.interp for seasonal series (Hyndman and Athanasopoulos: "a robust STL decomposition ... linear interpolation of
#     the seasonally adjusted series ... the seasonal component added back"): the STL fitted to a first filling
#     (V1: linear interpolation; V2: lm on Fourier terms and a trend), s.window "periodic" (P) or 7 (7), robust;
#   bizdays New York: weekdays minus NYSE holidays (New Year's Day (Saturday not moved, Sunday to Monday), Martin Luther
#     King Jr. Day (3rd Monday of January), Washington's Birthday (3rd Monday of February), Good Friday, Memorial Day
#     (last Monday of May), Juneteenth (from 2022, Saturday to Friday, Sunday to Monday), Independence Day, Labor Day
#     (1st Monday of September), Thanksgiving (4th Thursday of November), Christmas (Saturday to Friday, Sunday to
#     Monday)); NERC: New Year's, Memorial, Independence, Labor, Thanksgiving, Christmas (Sunday to Monday).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
mx <- function(a, b) max(abs(as.numeric(a) - as.numeric(b)), na.rm = TRUE)
easterSunday <- function(Y) {
  a <- Y %% 19; b <- Y %/% 100; c <- Y %% 100; d <- b %/% 4; e <- b %% 4; f <- (b + 8) %/% 25; g <- (b - f + 1) %/% 3
  h <- (19 * a + b - d - g + 15) %% 30; i <- c %/% 4; k <- c %% 4; l <- (32 + 2 * e + 2 * i - h - k) %% 7
  m <- (a + 11 * h + 22 * l) %/% 451; month <- (h + l - 7 * m + 114) %/% 31; day <- ((h + l - 7 * m + 114) %% 31) + 1
  as.Date(sprintf("%04d-%02d-%02d", Y, month, day))
}
easterC <- function(years, freq, mon) {
  v <- matrix(0, length(years), freq)
  for (yi in seq_along(years)) {
    days <- easterSunday(years[yi]) + (-2:(if (mon) 1 else 0))
    mm <- as.integer(format(days, "%m")); per <- if (freq == 12) mm else (mm - 1) %/% 3 + 1
    for (p in per) v[yi, p] <- v[yi, p] + 1 / length(days)
  }
  as.numeric(t(v))
}
yrs <- 1990:2035
em <- easter(ts(rep(1, 12 * length(yrs)), start = c(1990, 1), frequency = 12))
eq <- easter(ts(rep(1, 4 * length(yrs)), start = c(1990, 1), frequency = 4))
emm <- easter(ts(rep(1, 12 * length(yrs)), start = c(1990, 1), frequency = 12), easter.mon = TRUE)
out$easter <- list(rounded = mx(em, round(easterC(yrs, 12, FALSE), 2)), q_rounded = mx(eq, round(easterC(yrs, 4, FALSE), 2)),
                   mon = mx(emm, easterC(yrs, 12, TRUE)), mon_rounded = mx(emm, round(easterC(yrs, 12, TRUE), 2)))

# tsCV h = 1
rwfCall <- function(y, h, ...) rwf(y, h = h, ...)
e1 <- tsCV(Nile, rwfCall, h = 1); y <- as.numeric(Nile); n <- length(y)
out$tscv_h1 <- list(d = mx(e1, c(y[-1] - y[-n], NA)), na = which(is.na(e1)))

# BoxCox.lambda guerrero with the default tolerance
guer <- function(x, f) {
  len <- max(2, f); ng <- floor(length(x) / len); M <- matrix(tail(x, ng * len), nrow = len)
  mu <- colMeans(M); s <- apply(M, 2, sd); function(l) { r <- s / mu^(1 - l); sd(r) / mean(r) }
}
gl <- list()
for (cs in list(list("air", AirPassengers), list("usacc", USAccDeaths), list("nile", Nile), list("lynx", lynx),
                list("odd_len", ts(as.numeric(AirPassengers)[1:137], frequency = 12)))) {
  g <- guer(as.numeric(cs[[2]]), frequency(cs[[2]]))
  gl[[cs[[1]]]] <- c(R = BoxCox.lambda(cs[[2]]), cand = optimize(g, c(-1, 2))$minimum,
                     R_lim = BoxCox.lambda(cs[[2]], lower = 0, upper = 1), cand_lim = optimize(g, c(0, 1))$minimum)
}
out$guerrero <- gl

# findfrequency
set.seed(5)
ffl <- list()
mk <- list(noise = rnorm(120), ar09 = arima.sim(list(ar = 0.9), 200), ar_neg = arima.sim(list(ar = -0.8), 150),
           seas4 = sin(2 * pi * (1:100) / 4) * 0.5 + rnorm(100), weak12 = 0.3 * sin(2 * pi * (1:240) / 12) + arima.sim(list(ar = 0.7), 240),
           trendonly = 1:80 + rnorm(80), ma1 = arima.sim(list(ma = 0.8), 150), long = sin(2 * pi * (1:300) / 50) + rnorm(300, sd = 0.2))
for (nm in names(mk)) {
  x <- as.numeric(mk[[nm]]); tt <- seq_along(x); res <- residuals(lm(x ~ tt)); sp <- spec.ar(res, plot = FALSE)
  s <- sp$spec; fr <- sp$freq; jm <- which.max(s)
  tr <- which(diff(sign(diff(s))) > 0)[1] + 1
  f3 <- if (is.na(tr)) 1 else { j <- tr - 1 + which.max(s[tr:length(s)]); round(1 / fr[j]) }
  ffl[[nm]] <- list(R = findfrequency(ts(x)), F1 = if (grepl("\\(0\\)", sp$method)) 1 else round(1 / fr[jm]),
                    F2 = if (jm == 1) 1 else round(1 / fr[jm]), F3 = f3, method = sp$method, n = length(x))
}
out$findfrequency <- ffl

# na.interp seasonal
xs <- as.numeric(AirPassengers); miss <- c(5, 30, 31, 32, 77, 140); xs[miss] <- NA; xts <- ts(xs, frequency = 12)
R <- as.numeric(na.interp(xts))
first1 <- approx(seq_along(xs), xs, seq_along(xs), rule = 2)$y
tt <- seq_along(xs); X <- cbind(fourier(xts, K = 6), tt); ok <- !is.na(xs)
first2 <- xs
fl <- lm.fit(cbind(1, X[ok, ]), xs[ok]); first2[!ok] <- cbind(1, X[!ok, ]) %*% fl$coefficients
ni <- list()
for (fv in c("V1", "V2")) for (sw in c("P", "7")) {
  first <- if (fv == "V1") first1 else first2
  st <- stl(ts(first, frequency = 12), s.window = if (sw == "P") "periodic" else 7, robust = TRUE)
  seas <- as.numeric(st$time.series[, 1]); sa <- xs - seas
  sa <- approx(seq_along(sa), sa, seq_along(sa), rule = 2)$y
  ni[[paste(fv, sw)]] <- max(abs(R[miss] - (sa + seas)[miss]))
}
out$na_interp_seasonal <- list(variants = ni, R_at_missing = R[miss], observed_kept = mx(R[-miss], xs[-miss]))

# bizdays
nthDow <- function(Y, m, dow, k) { d <- seq(as.Date(sprintf("%04d-%02d-01", Y, m)), by = "day", length.out = 31)
  d <- d[as.integer(format(d, "%m")) == m]; d[as.integer(format(d, "%u")) == dow][k] }
lastDow <- function(Y, m, dow) { d <- seq(as.Date(sprintf("%04d-%02d-01", Y, m)), by = "day", length.out = 31)
  d <- d[as.integer(format(d, "%m")) == m]; tail(d[as.integer(format(d, "%u")) == dow], 1) }
obsSatFri <- function(d) { w <- as.integer(format(d, "%u")); if (w == 6) d - 1 else if (w == 7) d + 1 else d }
obsSunMon <- function(d) { w <- as.integer(format(d, "%u")); if (w == 7) d + 1 else d }
nyse <- function(Y) {
  h <- c(obsSunMon(as.Date(sprintf("%04d-01-01", Y))), nthDow(Y, 1, 1, 3), nthDow(Y, 2, 1, 3), easterSunday(Y) - 2,
         lastDow(Y, 5, 1), obsSatFri(as.Date(sprintf("%04d-07-04", Y))), nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4),
         obsSatFri(as.Date(sprintf("%04d-12-25", Y))))
  if (Y >= 2022) h <- c(h, obsSatFri(as.Date(sprintf("%04d-06-19", Y))))
  h
}
nerc <- function(Y) c(obsSunMon(as.Date(sprintf("%04d-01-01", Y))), lastDow(Y, 5, 1), obsSunMon(as.Date(sprintf("%04d-07-04", Y))),
                      nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4), obsSunMon(as.Date(sprintf("%04d-12-25", Y))))
countBiz <- function(hol, y0, nm) {
  firsts <- seq(as.Date(sprintf("%04d-01-01", y0)), by = "month", length.out = nm + 1)
  H <- do.call(c, lapply(y0:(y0 + nm / 12), hol))
  sapply(1:nm, function(k) { d <- seq(firsts[k], firsts[k + 1] - 1, by = "day")
    sum(!format(d, "%u") %in% c("6", "7") & !(d %in% H)) })
}
y0 <- 2000; nm <- 12 * 26
bNY <- as.numeric(bizdays(ts(rep(1, nm), start = c(y0, 1), frequency = 12), FinCenter = "New York"))
bNE <- as.numeric(bizdays(ts(rep(1, nm), start = c(y0, 1), frequency = 12), FinCenter = "NERC"))
cNY <- countBiz(nyse, y0, nm); cNE <- countBiz(nerc, y0, nm)
mon <- format(seq(as.Date("2000-01-01"), by = "month", length.out = nm), "%Y-%m")
out$bizdays <- list(NY_diff = mon[bNY != cNY], NY_R = bNY[bNY != cNY], NY_c = cNY[bNY != cNY],
                    NERC_diff = mon[bNE != cNE], NERC_R = bNE[bNE != cNE], NERC_c = cNE[bNE != cNE])
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
