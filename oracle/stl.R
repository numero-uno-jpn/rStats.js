# issue: 570
# oracle-platform: amd64
# Public outputs of stats' stl and supsmu (R 4.6.2) and forecast 9.0.2's mstl, seasadj, nsdiffs and ocsb.test for
# test/fixtures/stl.json (1.20.0). The behaviour is in oracle/tsmeta-behaviour.md; the experiments behind it in
# experiments/tsmeta120-stl*.R, -supsmu.R, -outliers.R, -fdecomp.R, -ndiffs*.R. stl's robust configurations are the
# ones whose robustness scale is R's true median (R bug 19370 takes a wrong order statistic for some even n; log 27).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list()
sc <- list(
  list("co2_periodic", co2, list(s.window = "periodic")), list("co2_s7", co2, list(s.window = 7)),
  list("co2_s35", co2, list(s.window = 35)), list("nottem_s9_robust", nottem, list(s.window = 9, robust = TRUE)),
  list("usacc_s13", USAccDeaths, list(s.window = 13)), list("ukgas_s7", ts(as.numeric(UKgas), frequency = 4), list(s.window = 7)),
  list("usacc_sdeg1_tdeg0", USAccDeaths, list(s.window = 7, s.degree = 1, t.degree = 0)),
  list("usacc_even_l", USAccDeaths, list(s.window = 7, l.window = 12)),
  list("usacc_jumps1", USAccDeaths, list(s.window = 7, s.jump = 1, t.jump = 1, l.jump = 1)),
  list("usacc_t31", USAccDeaths, list(s.window = 7, t.window = 31)),
  list("short30", ts(sin(1:30) + (1:30) / 10, frequency = 4), list(s.window = 7)),
  list("usacc_s7_robust_outer2", USAccDeaths, list(s.window = 7, robust = TRUE, inner = 2, outer = 2)),
  list("air_odd_robust", ts(as.numeric(AirPassengers)[1:143], frequency = 12), list(s.window = 7, robust = TRUE))
)
st <- list()
for (cs in sc) {
  r <- do.call("stl", c(list(cs[[2]]), cs[[3]]))
  st[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), args = cs[[3]],
    seasonal = as.numeric(r$time.series[, 1]), trend = as.numeric(r$time.series[, 2]), remainder = as.numeric(r$time.series[, 3]),
    weights = as.numeric(r$weights), win = unname(r$win), deg = unname(r$deg), jump = unname(r$jump), inner = r$inner, outer = r$outer)
}
out$stl <- st
set.seed(21)
xs <- sort(runif(150, 0, 10))
ss <- list(nile = list(seq_along(Nile), as.numeric(Nile)), sinx = list(xs, sin(xs) + rnorm(150, sd = 0.3)),
           lin = list(1:60, 2 + 0.5 * (1:60) + rnorm(60)), big = list(1:400, cumsum(rnorm(400))), n70 = list(1:70, cumsum(rnorm(70))))
sm <- list()
for (nm in names(ss)) {
  x <- ss[[nm]][[1]]; y <- ss[[nm]][[2]]
  sm[[nm]] <- list(x = x, y = y, cv = supsmu(x, y)$y, bass5 = supsmu(x, y, bass = 5)$y, span03 = supsmu(x, y, span = 0.3)$y)
}
out$supsmu <- sm
ms <- list()
for (cs in list(list("usacc", USAccDeaths), list("co2", co2), list("nile", Nile), list("air", AirPassengers))) {
  # robust = TRUE on an odd length (the first observation dropped when n is even): R's robustness scale is then the
  # true median (R bug 19370 only for even n; log 27)
  d <- mstl(cs[[2]]); xo <- if (length(cs[[2]]) %% 2 == 0) ts(as.numeric(cs[[2]])[-1], frequency = frequency(cs[[2]])) else cs[[2]]
  dr <- mstl(xo, robust = TRUE)
  ms[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), frequency = frequency(cs[[2]]), trend = as.numeric(d[, "Trend"]),
    remainder = as.numeric(d[, "Remainder"]), seasadj = as.numeric(seasadj(d)), xodd = as.numeric(xo), robust_trend = as.numeric(dr[, "Trend"]))
}
out$mstl <- ms
set.seed(20261127)
nsd <- list()
for (it in 1:120) {
  m <- sample(c(4, 12), 1); n <- sample((3 * m):(12 * m), 1); amp <- runif(1, 0, 3)
  y <- cumsum(rnorm(n)) * runif(1, 0, 1) + amp * sin(2 * pi * (1:n) / m) + rnorm(n)
  if (runif(1) < 0.3) { e <- rnorm(n); y <- e; for (t in (m + 1):n) y[t] <- y[t - m] + e[t] }
  yy <- ts(y, frequency = m); oc <- ocsb.test(yy); oc2 <- ocsb.test(yy, lag.method = "fixed", maxlag = 2)
  nsd[[it]] <- list(y = y, frequency = m, seas = nsdiffs(yy), ocsb = nsdiffs(yy, test = "ocsb"),
                    ocsb_stat = unname(oc$statistics), ocsb_crit = unname(oc$critical), ocsb2_stat = unname(oc2$statistics))
}
out$nsdiffs <- nsd
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "stl.json"))
