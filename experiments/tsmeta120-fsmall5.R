# tsmeta120-fsmall5.R: forecast's findfrequency and bizdays, fifth experiment (1.20.0): the rules read off
# tsmeta120-fsmall4, checked on fresh series / the full calendar range:
#   findfrequency: 1 unless max(spec.ar of the detrended series) > 10; then the period round(1 / f) at the maximum;
#     when the maximum is at the lowest frequency (period Inf), the largest value after the spectrum first rises
#     (candidate G1: after the first index where diff(spec) > 0; G2: after the first local minimum), and 1 if none;
#   bizdays: the calendars of tsmeta120-fsmall4 with the corrections it showed: NYSE closes on Martin Luther King Jr.
#     Day only from 1998 and not on the 2018 / 2025 days of mourning; London and Toronto move a Saturday Boxing Day
#     (Christmas on Friday) to Monday 28; Toronto with Christmas on Saturday has one weekday holiday (Monday 27).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
set.seed(12)
ffC <- function(x, g) {
  tt <- seq_along(x); sp <- spec.ar(residuals(lm(x ~ tt)), plot = FALSE); s <- sp$spec; fr <- sp$freq
  if (max(s) <= 10) return(1)
  jm <- which.max(s); if (jm > 1) return(round(1 / fr[jm]))
  st <- if (g == "G1") which(diff(s) > 0)[1] else which(diff(sign(diff(s))) > 0)[1] + 1
  if (is.na(st)) return(1)
  j <- st + which.max(s[(st + 1):length(s)]); if (j < length(s)) round(1 / fr[j]) else 1
}
rows <- NULL
for (it in 1:800) {
  n <- sample(40:300, 1); kind <- sample(1:4, 1)
  x <- switch(kind, runif(1, 0, 2) * sin(2 * pi * (1:n) / sample(3:30, 1)) + arima.sim(list(ar = runif(1, -0.5, 0.9)), n),
              arima.sim(list(ar = runif(1, -0.9, 0.95)), n), arima.sim(list(ma = runif(1, -0.9, 0.9)), n),
              cumsum(rnorm(n)) * 0.3 + runif(1, 0, 3) * sin(2 * pi * (1:n) / sample(4:24, 1)))
  x <- as.numeric(x)
  rows <- rbind(rows, c(R = findfrequency(ts(x)), G1 = ffC(x, "G1"), G2 = ffC(x, "G2")))
}
out$ff <- list(n = nrow(rows), G1_agree = sum(rows[, 1] == rows[, 2]), G2_agree = sum(rows[, 1] == rows[, 3]),
               G1_off = head(rows[rows[, 1] != rows[, 2], , drop = FALSE], 10), G2_off = head(rows[rows[, 1] != rows[, 3], , drop = FALSE], 10))

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
xmasPair <- function(Y, toronto = FALSE) { c25 <- D(Y, 12, 25); w <- wday(c25)
  if (w == 5) c(c25, c25 + 3) else if (w == 6) { if (toronto) c25 + 2 else c(c25 + 2, c25 + 3) }
  else if (w == 7) c(c25 + 1, c25 + 2) else c(c25, c25 + 1) }
london <- function(Y) {
  em <- if (Y %in% c(1995, 2020)) D(Y, 5, 8) else nthDow(Y, 5, 1, 1)
  sp <- if (Y %in% c(2002, 2012)) D(Y, 6, 4) else if (Y == 2022) D(Y, 6, 2) else lastDow(Y, 5, 1)
  ex <- list(`1999` = D(1999, 12, 31), `2002` = D(2002, 6, 3), `2011` = D(2011, 4, 29), `2012` = D(2012, 6, 5),
             `2022` = c(D(2022, 6, 3), D(2022, 9, 19)), `2023` = D(2023, 5, 8))[[as.character(Y)]]
  c(wkMon(D(Y, 1, 1)), easterSunday(Y) - 2, easterSunday(Y) + 1, em, sp, lastDow(Y, 8, 1), xmasPair(Y), ex)
}
toronto <- function(Y) {
  vic <- { d <- D(Y, 5, 24) - 0:6; d[wday(d) == 1][1] }
  c(wkMon(D(Y, 1, 1)), if (Y >= 2008) nthDow(Y, 2, 1, 3), easterSunday(Y) - 2, vic, wkMon(D(Y, 7, 1)), nthDow(Y, 8, 1, 1),
    nthDow(Y, 9, 1, 1), nthDow(Y, 10, 1, 2), xmasPair(Y, toronto = TRUE))
}
zurich <- function(Y) c(D(Y, 1, 1), D(Y, 1, 2), easterSunday(Y) - 2, easterSunday(Y) + 1, D(Y, 5, 1), easterSunday(Y) + 39,
                        easterSunday(Y) + 50, D(Y, 8, 1), D(Y, 12, 25), D(Y, 12, 26), nthDow(Y, 4, 1, 3), nthDow(Y, 9, 1, 2))
nyse <- function(Y) {
  obsSF <- function(d) if (wday(d) == 6) d - 1 else if (wday(d) == 7) d + 1 else d
  h <- c(if (wday(D(Y, 1, 1)) == 7) D(Y, 1, 2) else D(Y, 1, 1), if (Y >= 1998) nthDow(Y, 1, 1, 3), nthDow(Y, 2, 1, 3),
         easterSunday(Y) - 2, lastDow(Y, 5, 1), obsSF(D(Y, 7, 4)), nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4), obsSF(D(Y, 12, 25)))
  if (Y >= 2022) h <- c(h, obsSF(D(Y, 6, 19)))
  c(h, list(`2001` = D(2001, 9, 11) + 0:3, `2004` = D(2004, 6, 11), `2007` = D(2007, 1, 2), `2012` = D(2012, 10, 29) + 0:1)[[as.character(Y)]])
}
nerc <- function(Y) { obs <- function(d) if (wday(d) == 7) d + 1 else d
  c(obs(D(Y, 1, 1)), lastDow(Y, 5, 1), obs(D(Y, 7, 4)), nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4), obs(D(Y, 12, 25))) }
countBiz <- function(hol, y0, nm, q = FALSE) {
  firsts <- seq(D(y0, 1, 1), by = if (q) "quarter" else "month", length.out = nm + 1)
  H <- do.call(c, lapply(y0:(y0 + nm / (if (q) 4 else 12) + 1), hol))
  sapply(1:nm, function(k) { d <- seq(firsts[k], firsts[k + 1] - 1, by = "day"); sum(wday(d) <= 5 & !(d %in% H)) })
}
y0 <- 1990; nm <- 12 * 41
mon <- format(seq(D(y0, 1, 1), by = "month", length.out = nm), "%Y-%m")
bz <- list()
for (fc in list(list("New York", nyse), list("London", london), list("NERC", nerc), list("Toronto", toronto), list("Zurich", zurich))) {
  r <- as.numeric(bizdays(ts(rep(1, nm), start = c(y0, 1), frequency = 12), FinCenter = fc[[1]])); cc <- countBiz(fc[[2]], y0, nm)
  rQ <- as.numeric(bizdays(ts(rep(1, 4 * 41), start = c(y0, 1), frequency = 4), FinCenter = fc[[1]])); cq <- countBiz(fc[[2]], y0, 4 * 41, TRUE)
  bz[[fc[[1]]]] <- list(n_diff = sum(r != cc), months = head(mon[r != cc], 20), R = head(r[r != cc], 20), cand = head(cc[r != cc], 20),
                        q_diff = sum(rQ != cq))
}
out$bizdays <- bz
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
