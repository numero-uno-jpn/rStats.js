# tsmeta120-fsmall4.R: forecast's findfrequency, na.interp (seasonal) and bizdays (London, Toronto, Zurich, NYSE's
# special closings), fourth experiment (1.20.0). Candidates written for this experiment:
#   findfrequency: the help page's "large (possibly local) maximum": over 600 series (sinusoids of random period and
#     amplitude in AR noise, pure AR / MA series), R's result against the period at the global maximum (F2 of
#     tsmeta120-fsmall3), with max(spec) recorded, to see whether R = F2 exactly when max(spec) exceeds one constant,
#     and what R returns otherwise;
#   na.interp (seasonal): a grid of first fillings (linear; lm on Fourier terms K = 1..6 with a polynomial trend of
#     degree 1..3) and decompositions (stl periodic / 7 / 13, robust; mstl), the seasonal component removed, linear
#     interpolation, added back;
#   bizdays: weekdays minus the public holidays of each exchange (London: New Year's Day (weekend to Monday), Good
#     Friday, Easter Monday, Early May (1st Monday; 8 May 1995 and 2020), Spring (last Monday of May; 4 June 2002 and
#     2012, 2 June 2022), Summer (last Monday of August), Christmas and Boxing Day (weekend to Monday / Tuesday),
#     special days 31 Dec 1999, 3 Jun 2002, 29 Apr 2011, 5 Jun 2012, 3 Jun 2022, 19 Sep 2022, 8 May 2023; Toronto: New
#     Year's (weekend to Monday), Family Day (3rd Monday of February from 2008), Good Friday, Victoria Day (the Monday
#     before 25 May), Canada Day (weekend to Monday), Civic Holiday (1st Monday of August), Labour Day, Thanksgiving
#     (2nd Monday of October), Christmas and Boxing Day (as London); Zurich: 1 and 2 January, Good Friday, Easter
#     Monday, 1 May, Ascension, Whit Monday, 1 August, 25 and 26 December, Sechselaeuten (3rd Monday of April) and
#     Knabenschiessen (2nd Monday of September), not moved); NYSE's special closings 11-14 Sep 2001, 11 Jun 2004,
#     2 Jan 2007, 29-30 Oct 2012 (and 5 Dec 2018, 9 Jan 2025 as national days of mourning).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))

# findfrequency scan
set.seed(11)
rows <- NULL
for (it in 1:600) {
  n <- sample(40:300, 1); kind <- sample(1:3, 1)
  x <- if (kind == 1) { per <- sample(3:30, 1); runif(1, 0, 2) * sin(2 * pi * (1:n) / per) + arima.sim(list(ar = runif(1, -0.5, 0.9)), n) }
       else if (kind == 2) arima.sim(list(ar = runif(1, -0.9, 0.95)), n) else arima.sim(list(ma = runif(1, -0.9, 0.9)), n)
  x <- as.numeric(x); tt <- seq_along(x); res <- residuals(lm(x ~ tt)); sp <- spec.ar(res, plot = FALSE)
  jm <- which.max(sp$spec)
  rows <- rbind(rows, c(R = findfrequency(ts(x)), F2 = if (jm == 1) 1 else round(1 / sp$freq[jm]), maxspec = max(sp$spec),
                        jm = jm, n = n))
}
out$ff <- rows

# na.interp seasonal grid
xs <- as.numeric(AirPassengers); miss <- c(5, 30, 31, 32, 77, 140); xs[miss] <- NA; xts <- ts(xs, frequency = 12)
Rv <- as.numeric(na.interp(xts))[miss]; ok <- !is.na(xs); tt <- seq_along(xs)
fills <- list(linear = approx(tt, xs, tt, rule = 2)$y)
for (K in 1:6) for (dg in 1:3) {
  X <- cbind(1, fourier(xts, K = K), poly(tt, dg, raw = TRUE)); b <- lm.fit(X[ok, ], xs[ok])$coefficients
  f <- xs; f[!ok] <- X[!ok, ] %*% b; fills[[paste0("lm_K", K, "_d", dg)]] <- f
}
grid <- list()
for (fn in names(fills)) for (dc in c("stlP", "stl7", "stl13", "mstlD")) {
  z <- ts(fills[[fn]], frequency = 12)
  seas <- switch(dc, stlP = stl(z, "periodic", robust = TRUE)$time.series[, 1], stl7 = stl(z, 7, robust = TRUE)$time.series[, 1],
                 stl13 = stl(z, 13, robust = TRUE)$time.series[, 1], mstlD = seasonal(mstl(z, robust = TRUE)))
  seas <- as.numeric(seas); sa <- approx(tt, xs - seas, tt, rule = 2)$y
  grid[[paste(fn, dc)]] <- max(abs((sa + seas)[miss] - Rv))
}
g <- unlist(grid); out$na_interp <- list(best = head(sort(g), 5), R = Rv)

# bizdays
easterSunday <- function(Y) {
  a <- Y %% 19; b <- Y %/% 100; c <- Y %% 100; d <- b %/% 4; e <- b %% 4; f <- (b + 8) %/% 25; g <- (b - f + 1) %/% 3
  h <- (19 * a + b - d - g + 15) %% 30; i <- c %/% 4; k <- c %% 4; l <- (32 + 2 * e + 2 * i - h - k) %% 7
  m <- (a + 11 * h + 22 * l) %/% 451; month <- (h + l - 7 * m + 114) %/% 31; day <- ((h + l - 7 * m + 114) %% 31) + 1
  as.Date(sprintf("%04d-%02d-%02d", Y, month, day))
}
D <- function(Y, m, d) as.Date(sprintf("%04d-%02d-%02d", Y, m, d))
wday <- function(d) as.integer(format(d, "%u"))
nthDow <- function(Y, m, dow, k) { d <- D(Y, m, 1) + 0:30; d <- d[as.integer(format(d, "%m")) == m]; d[wday(d) == dow][k] }
lastDow <- function(Y, m, dow) { d <- D(Y, m, 1) + 0:30; d <- d[as.integer(format(d, "%m")) == m]; tail(d[wday(d) == dow], 1) }
wkMon <- function(d) if (wday(d) == 6) d + 2 else if (wday(d) == 7) d + 1 else d
xmasPair <- function(Y) { c25 <- D(Y, 12, 25); w <- wday(c25)
  if (w == 5) c(c25, c25 + 1) else if (w == 6) c(c25 + 2, c25 + 3) else if (w == 7) c(c25 + 1, c25 + 2) else c(c25, c25 + 1) }
london <- function(Y) {
  em <- if (Y %in% c(1995, 2020)) D(Y, 5, 8) else nthDow(Y, 5, 1, 1)
  sp <- if (Y %in% c(2002, 2012)) D(Y, 6, 4) else if (Y == 2022) D(Y, 6, 2) else lastDow(Y, 5, 1)
  sp_extra <- list(`1999` = D(1999, 12, 31), `2002` = D(2002, 6, 3), `2011` = D(2011, 4, 29), `2012` = D(2012, 6, 5),
                   `2022` = c(D(2022, 6, 3), D(2022, 9, 19)), `2023` = D(2023, 5, 8))[[as.character(Y)]]
  c(wkMon(D(Y, 1, 1)), easterSunday(Y) - 2, easterSunday(Y) + 1, em, sp, lastDow(Y, 8, 1), xmasPair(Y), sp_extra)
}
toronto <- function(Y) {
  vic <- { d <- D(Y, 5, 24) - 0:6; d[wday(d) == 1][1] }
  c(wkMon(D(Y, 1, 1)), if (Y >= 2008) nthDow(Y, 2, 1, 3), easterSunday(Y) - 2, vic, wkMon(D(Y, 7, 1)), nthDow(Y, 8, 1, 1),
    nthDow(Y, 9, 1, 1), nthDow(Y, 10, 1, 2), xmasPair(Y))
}
zurich <- function(Y) c(D(Y, 1, 1), D(Y, 1, 2), easterSunday(Y) - 2, easterSunday(Y) + 1, D(Y, 5, 1), easterSunday(Y) + 39,
                        easterSunday(Y) + 50, D(Y, 8, 1), D(Y, 12, 25), D(Y, 12, 26), nthDow(Y, 4, 1, 3), nthDow(Y, 9, 1, 2))
nyse <- function(Y) {
  obsSF <- function(d) if (wday(d) == 6) d - 1 else if (wday(d) == 7) d + 1 else d
  h <- c(if (wday(D(Y, 1, 1)) == 7) D(Y, 1, 2) else D(Y, 1, 1), nthDow(Y, 1, 1, 3), nthDow(Y, 2, 1, 3), easterSunday(Y) - 2,
         lastDow(Y, 5, 1), obsSF(D(Y, 7, 4)), nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4), obsSF(D(Y, 12, 25)))
  if (Y >= 2022) h <- c(h, obsSF(D(Y, 6, 19)))
  c(h, list(`2001` = D(2001, 9, 11) + 0:3, `2004` = D(2004, 6, 11), `2007` = D(2007, 1, 2), `2012` = D(2012, 10, 29) + 0:1,
            `2018` = D(2018, 12, 5), `2025` = D(2025, 1, 9))[[as.character(Y)]])
}
countBiz <- function(hol, y0, nm) {
  firsts <- seq(D(y0, 1, 1), by = "month", length.out = nm + 1)
  H <- do.call(c, lapply(y0:(y0 + nm / 12), hol))
  sapply(1:nm, function(k) { d <- seq(firsts[k], firsts[k + 1] - 1, by = "day"); sum(wday(d) <= 5 & !(d %in% H)) })
}
y0 <- 1995; nm <- 12 * 31
mon <- format(seq(D(y0, 1, 1), by = "month", length.out = nm), "%Y-%m")
bz <- list()
for (fc in list(list("New York", nyse), list("London", london), list("Toronto", toronto), list("Zurich", zurich))) {
  r <- as.numeric(bizdays(ts(rep(1, nm), start = c(y0, 1), frequency = 12), FinCenter = fc[[1]])); cc <- countBiz(fc[[2]], y0, nm)
  bz[[fc[[1]]]] <- list(n_diff = sum(r != cc), months = head(mon[r != cc], 30), R = head(r[r != cc], 30), cand = head(cc[r != cc], 30))
}
out$bizdays <- bz
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
