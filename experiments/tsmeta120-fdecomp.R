# tsmeta120-fdecomp.R: forecast's mstl, seasonal / trendcycle / remainder / seasadj, stlf, thetaf, croston and tslm
# (1.20.0), first experiment. Candidates written for this experiment from the help pages and the papers they cite:
#   mstl (Bandara, Hyndman and Bergmeir 2021) for one seasonal period: seasonal S = 0; repeat `iterate` times:
#     S = stl(x - S + S, s.window)$seasonal ... i.e. stl of (x minus the other seasonal components) with s.window[1]
#     (default 11); the trend and remainder from the last stl (C1), or the trend from the last stl and
#     remainder = x - S - trend (C2);
#   seasadj: x - seasonal (x / seasonal for a multiplicative decompose);
#   stlf: mstl(y) (default windows), the seasonally adjusted series forecast by ets(sa, "ZZN"), plus the last cycle
#     of the seasonal component repeated (seasonal naive);
#   thetaf (Hyndman and Billah 2003): if m > 1 and |r_m| > qnorm(0.95) sqrt((1 + 2 sum_{i<m} r_i^2) / n), classical
#     multiplicative decomposition first; ses on the (adjusted) series by ets "ANN"; mean = ses mean + b/2 * (h - 1 +
#     1/alpha - (1 - alpha)^n / alpha) with b the slope of lm(y ~ t) (candidate T1), reseasonalised;
#   croston (Shenstone and Hyndman 2005): non-zero demands z and inter-demand intervals p, each smoothed by SES with
#     alpha, starting at the first value; forecast z / p ("croston"), (1 - alpha/2) z / p ("sba"),
#     (1 - alpha/(2 - alpha)) z / p ("sbj");
#   tslm: lm with trend = 1..n and season = factor(cycle).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
mx <- function(a, b) max(abs(as.numeric(a) - as.numeric(b)), na.rm = TRUE)

mstlC <- function(x, iterate = 2, sw = 11) {
  S <- rep(0, length(x)); st <- NULL
  for (i in 1:iterate) { st <- stl(ts(as.numeric(x) - 0 * S, frequency = frequency(x)) , s.window = sw); S <- as.numeric(st$time.series[, 1]) }
  list(S = S, trend = as.numeric(st$time.series[, 2]), rem1 = as.numeric(st$time.series[, 3]))
}
mm <- list()
for (cs in list(list("usacc", USAccDeaths), list("co2", co2), list("air", AirPassengers), list("nottem", nottem), list("q", UKgas))) {
  r <- mstl(cs[[2]]); c1 <- mstlC(cs[[2]])
  # candidate C3: iterate twice on the deseasonalised series: stl(x - S_other + S_this): with one period, stl(x)
  # twice gives the same; so also try stl(deseas + S) where deseas uses the previous S
  S <- rep(0, length(cs[[2]])); x <- as.numeric(cs[[2]]); f <- frequency(cs[[2]])
  for (i in 1:2) { ds <- x - S; st <- stl(ts(ds + S, frequency = f), s.window = 11); S <- as.numeric(st$time.series[, 1]) }
  mm[[cs[[1]]]] <- list(cols = colnames(r), seasonal = mx(seasonal(r), c1$S), trend = mx(trendcycle(r), c1$trend),
                        rem_C1 = mx(remainder(r), c1$rem1), rem_C2 = mx(remainder(r), x - c1$S - c1$trend),
                        seasadj = mx(seasadj(r), x - c1$S), robust_diff = mx(seasonal(mstl(cs[[2]], robust = TRUE)), c1$S),
                        s7 = mx(seasonal(mstl(cs[[2]], s.window = 7)), mstlC(cs[[2]], sw = 7)$S),
                        it1 = mx(seasonal(mstl(cs[[2]], iterate = 1)), mstlC(cs[[2]], iterate = 1)$S))
}
out$mstl <- mm
d <- decompose(AirPassengers, "multiplicative")
out$seasadj_decompose <- c(mult = mx(seasadj(d), AirPassengers / d$seasonal),
                           add = mx(seasadj(decompose(AirPassengers)), AirPassengers - decompose(AirPassengers)$seasonal),
                           stl = mx(seasadj(stl(co2, "periodic")), co2 - stl(co2, "periodic")$time.series[, 1]))
# nonseasonal mstl
rn <- mstl(Nile)
out$mstl_nonseasonal <- list(cols = colnames(rn), trend_vs_supsmu = mx(trendcycle(rn), supsmu(seq_along(Nile), as.numeric(Nile))$y))

# stlf
sl <- list()
for (cs in list(list("usacc", USAccDeaths), list("air", AirPassengers), list("co2", co2))) {
  y <- cs[[2]]; f <- frequency(y); h <- 2 * f
  r <- stlf(y, h = h)
  dec <- mstl(y); sa <- seasadj(dec); S <- as.numeric(seasonal(dec))
  fe <- forecast(ets(sa, model = "ZZN"), h = h)
  sn <- rep(tail(S, f), length.out = h)
  sl[[cs[[1]]]] <- list(mean = mx(r$mean, as.numeric(fe$mean) + sn), upper = mx(r$upper, fe$upper + sn),
                        method = r$method, ets_method = fe$method)
}
out$stlf <- sl

# thetaf
th <- list()
for (cs in list(list("nile", Nile), list("air", AirPassengers), list("usacc", USAccDeaths), list("lynx", lynx), list("uspop", uspop))) {
  y <- cs[[2]]; n <- length(y); m <- frequency(y); h <- 2 * max(m, 5)
  r <- thetaf(y, h = h)
  seas <- FALSE
  if (m > 1 && n >= 2 * m) {
    rr <- acf(as.numeric(y), lag.max = m, plot = FALSE)$acf[-1]
    seas <- abs(rr[m]) > qnorm(0.95) * sqrt((1 + 2 * sum(rr[-m]^2)) / n)
  }
  yy <- y; sfac <- rep(1, n + h)
  if (seas) { dd <- decompose(y, "multiplicative"); yy <- seasadj(dd); sfac <- rep(as.numeric(dd$figure), length.out = n + h) }
  fe <- forecast(ets(yy, model = "ANN", opt.crit = "mse"), h = h)
  al <- unname(fe$model$par["alpha"]); b <- unname(coef(lm(as.numeric(yy) ~ seq_len(n)))[2])
  hh <- 1:h
  mean1 <- (as.numeric(fe$mean) + b / 2 * (hh - 1 + 1 / al - (1 - al)^n / al)) * sfac[n + hh]
  fe2 <- forecast(ets(yy, model = "ANN"), h = h); al2 <- unname(fe2$model$par["alpha"])
  mean2 <- (as.numeric(fe2$mean) + b / 2 * (hh - 1 + 1 / al2 - (1 - al2)^n / al2)) * sfac[n + hh]
  th[[cs[[1]]]] <- list(seasonal = seas, mean_mse = mx(r$mean, mean1), mean_lik = mx(r$mean, mean2), method = r$method,
                        model_names = names(r$model), alpha_R = r$model$alpha, drift_R = r$model$drift)
}
out$thetaf <- th

# croston
set.seed(9)
y <- ts(rbinom(60, 1, 0.3) * rpois(60, 4))
cr <- list()
crC <- function(y, alpha, type) {
  y <- as.numeric(y); nz <- which(y != 0); z <- y[nz]; p <- diff(c(0, nz))
  ses1 <- function(v) { l <- v[1]; f <- numeric(length(v) + 1); f[1] <- v[1]; for (i in seq_along(v)) { f[i + 1] <- l + alpha * (v[i] - l); l <- f[i + 1] }; f }
  fz <- ses1(z); fp <- ses1(p)
  k <- switch(type, default = 1, sba = 1 - alpha / 2, sbj = 1 - alpha / (2 - alpha))
  list(final = k * tail(fz, 1) / tail(fp, 1), fz = fz, fp = fp)
}
for (type in c("default", "sba", "sbj")) for (a in c(0.1, 0.3)) {   # "default" = Croston's own (the first type)
  r <- if (type == "default") croston(y, h = 5, alpha = a) else croston(y, h = 5, alpha = a, type = type); c1 <- crC(y, a, type)
  cr[[paste(type, a)]] <- c(R = as.numeric(r$mean)[1], cand = c1$final, flat = max(abs(diff(as.numeric(r$mean)))))
}
out$croston <- list(cases = cr, fitted_R = as.numeric(fitted(croston(y, h = 5))), y = as.numeric(y))

# tslm
fit <- tslm(AirPassengers ~ trend + season); tt <- seq_along(AirPassengers); ss <- factor(cycle(AirPassengers))
lmf <- lm(as.numeric(AirPassengers) ~ tt + ss)
fcl <- forecast(fit, h = 12)
nd <- data.frame(tt = length(AirPassengers) + 1:12, ss = factor(((length(AirPassengers) + 0:11) %% 12) + 1, levels = levels(ss)))
pl <- predict(lmf, newdata = nd, interval = "prediction", level = 0.95)
out$tslm <- list(coef = mx(coef(fit), coef(lmf)), names = names(coef(fit)), mean = mx(fcl$mean, pl[, "fit"]), upper95 = mx(fcl$upper[, 2], pl[, "upr"]))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
