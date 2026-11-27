# issue: 570
# oracle-platform: amd64
# Public outputs of forecast 9.0.2's simple methods (meanf, naive, rwf, snaive, ses, holt, hw, thetaf, croston, stlf,
# tslm) and small functions (accuracy, ma, fourier, seasonaldummy, monthdays, easter, bizdays, dm.test, CV,
# checkresiduals, tsCV, arimaorder, findfrequency, na.interp, tsoutliers, tsclean, seasonal / trendcycle / remainder)
# for test/fixtures/forecastSimple.json (1.20.0). The behaviour is in oracle/tsmeta-behaviour.md; the experiments behind
# it in experiments/tsmeta120-log.md items 28-35, 47, 51-60.
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list()
fc <- function(f) list(mean = as.numeric(f$mean), lower = unname(as.matrix(f$lower)), upper = unname(as.matrix(f$upper)),
                       level = as.numeric(f$level), fitted = as.numeric(fitted(f)), residuals = as.numeric(residuals(f)), method = f$method,
                       model = if (is.list(f$model) && !is.null(f$model$par)) list(par = as.list(f$model$par), loglik = f$model$loglik, mse = f$model$mse, method = f$model$method) else NULL)
nile <- as.numeric(Nile); usacc <- USAccDeaths; air <- AirPassengers; ukgas <- ts(as.numeric(UKgas), frequency = 4, start = c(1960, 1))
set.seed(31); rw <- cumsum(rnorm(60)) + 50
out$data <- list(nile = nile, usacc = as.numeric(usacc), air = as.numeric(air), ukgas = as.numeric(ukgas), rw = rw)
ns <- ts(nile); rws <- ts(rw)
out$basic <- list(
  meanf = fc(meanf(ns, h = 7)), meanf_lvl = fc(meanf(ns, h = 3, level = c(50, 90, 99))),
  naive = fc(naive(ns, h = 6)), rwf = fc(rwf(rws, h = 8)), rwf_drift = fc(rwf(rws, h = 8, drift = TRUE)),
  snaive_usacc = fc(snaive(usacc)), snaive_ukgas = fc(snaive(ukgas, h = 11)))
out$ets_based <- list(
  ses = fc(ses(ns, h = 5)), ses_simple = fc(ses(ns, h = 5, initial = "simple")), ses_alpha = fc(ses(ns, h = 5, alpha = 0.3)),
  holt = fc(holt(rws, h = 6)), holt_damped = fc(holt(rws, h = 6, damped = TRUE)), holt_simple = fc(holt(rws, h = 6, initial = "simple")),
  holt_exp = fc(holt(ns, h = 6, exponential = TRUE)),
  hw_add = fc(hw(usacc)), hw_add_damped = fc(hw(usacc, damped = TRUE)), hw_add_simple = fc(hw(usacc, initial = "simple")),
  hw_mult_simple = fc(hw(air, seasonal = "multiplicative", initial = "simple")))
out$theta <- list(nile = fc(thetaf(ns, h = 5)), air = fc(thetaf(air)), usacc = fc(thetaf(usacc, h = 6)), rw = fc(thetaf(rws)))
set.seed(32); inter <- rpois(60, 0.4) * rpois(60, 3)
out$croston <- list(y = inter, croston = list(mean = as.numeric(croston(inter, h = 4)$mean), fitted = as.numeric(fitted(croston(inter)))),
  sba = as.numeric(croston(inter, h = 4, type = "sba")$mean), sbj = as.numeric(croston(inter, h = 4, type = "sbj", alpha = 0.2)$mean))
out$stlf <- list(usacc = fc(stlf(usacc)), ukgas = fc(stlf(ukgas, h = 6)))
tl <- tslm(usacc ~ trend + season); tlf <- forecast(tl, h = 14)
tl2 <- tslm(ns ~ trend); tlf2 <- forecast(tl2, h = 4, level = 90)
out$tslm <- list(usacc = list(coef = unname(coef(tl)), names = names(coef(tl)), fitted = as.numeric(fitted(tl)), fc = fc(tlf)),
                 nile = list(coef = unname(coef(tl2)), fc = fc(tlf2)))
# accuracy
tr <- window(usacc, end = c(1977, 12)); te <- window(usacc, start = c(1978, 1))
fa <- forecast(ets(tr, model = "AAA"), h = 12)
acc <- accuracy(fa, te)
fn <- naive(window(ns, end = 90), h = 10)
out$accuracy <- list(usacc = list(train = as.numeric(window(usacc, end = c(1977, 12))), fitted = as.numeric(fitted(fa)), test = as.numeric(te), forecast = as.numeric(fa$mean),
                                  rows = unname(acc), cols = colnames(acc)),
                     nile = list(train = nile[1:90], fitted = as.numeric(fitted(fn)), test = nile[91:100], forecast = as.numeric(fn$mean), rows = unname(accuracy(fn, nile[91:100])), cols = colnames(accuracy(fn, nile[91:100]))))
# ma, fourier, seasonaldummy
out$ma <- list(o5 = as.numeric(ma(ns, 5)), o4 = as.numeric(ma(ns, 4)), o4nc = as.numeric(ma(ns, 4, centre = FALSE)), o12 = as.numeric(ma(usacc, 12)), o3nc = as.numeric(ma(ns, 3, centre = FALSE)))
f1 <- fourier(usacc, K = 6); f2 <- fourier(usacc, K = 3, h = 10); f3 <- fourier(ukgas, K = 2)
out$fourier <- list(k6 = list(names = colnames(f1), cols = unname(f1)), k3h = list(names = colnames(f2), cols = unname(f2)), q2 = list(names = colnames(f3), cols = unname(f3)))
out$seasonaldummy <- list(usacc = unname(seasonaldummy(usacc)), usacc_h = unname(seasonaldummy(usacc, h = 15)),
                          ukgas_q3 = unname(seasonaldummy(ts(1:10, frequency = 4, start = c(2000, 3)))))
# calendars
cal <- list()
for (cs in list(list("m2000", 2000, 1, 12, 60), list("m1999_7", 1999, 7, 12, 40), list("q2010_2", 2010, 2, 4, 30), list("m1994", 1994, 1, 12, 240))) {
  x <- ts(rep(0, cs[[5]]), start = c(cs[[2]], cs[[3]]), frequency = cs[[4]])
  biz <- list(); for (fc_ in c("New York", "London", "NERC", "Toronto", "Zurich")) biz[[fc_]] <- as.numeric(bizdays(x, FinCenter = fc_))
  cal[[cs[[1]]]] <- list(startYear = cs[[2]], startPeriod = cs[[3]], frequency = cs[[4]], n = cs[[5]], monthdays = as.numeric(monthdays(x)),
                         easter = as.numeric(easter(x)), easter_mon = as.numeric(easter(x, easter.mon = TRUE)), bizdays = biz)
}
out$calendar <- cal
# dm.test, CV, checkresiduals
set.seed(33); e1 <- rnorm(80); e2 <- rnorm(80) * 1.2 + 0.1 * e1
dm <- list()
for (cs in list(list("two", "two.sided", 1, 2), list("less_h3", "less", 3, 2), list("greater_p1", "greater", 1, 1), list("two_h5", "two.sided", 5, 1)))
  { r <- dm.test(e1, e2, alternative = cs[[2]], h = cs[[3]], power = cs[[4]]); dm[[cs[[1]]]] <- list(alternative = cs[[2]], h = cs[[3]], power = cs[[4]], statistic = unname(r$statistic), parameter = unname(r$parameter), p = r$p.value) }
out$dm <- list(e1 = e1, e2 = e2, cases = dm)
cv1 <- CV(tl); cv2 <- CV(tslm(ns ~ trend))
out$cv <- list(usacc = as.list(cv1), nile = as.list(cv2))
fa1 <- Arima(usacc, order = c(1, 0, 1), seasonal = c(0, 1, 1)); cr1 <- checkresiduals(fa1, plot = FALSE)
fa2 <- Arima(ns, order = c(1, 1, 1)); cr2 <- checkresiduals(fa2, plot = FALSE)
cr3 <- checkresiduals(naive(ns), plot = FALSE)
cr4 <- checkresiduals(ets(usacc, model = "AAA"), plot = FALSE)
cr <- function(r, res, freq, df) list(residuals = as.numeric(res), frequency = freq, df = df, statistic = unname(r$statistic), parameter = unname(r$parameter), p = r$p.value)
out$checkresiduals <- list(arima_s = cr(cr1, residuals(fa1), 12, 3), arima = cr(cr2, residuals(fa2), 1, 2), naive = cr(cr3, residuals(naive(ns)), 1, 0),
                           ets = cr(cr4, residuals(ets(usacc, model = "AAA")), 12, 0))
out$arimaorder <- list(s = as.list(arimaorder(fa1)), ns = as.list(arimaorder(fa2)))
# tsCV
out$tscv <- list(naive_h1 = unname(as.matrix(tsCV(ns, function(x, h) naive(x, h = h), h = 1))), rwf_h3 = unname(as.matrix(tsCV(rws, function(x, h) rwf(x, drift = TRUE, h = h), h = 3))))
# findfrequency
set.seed(34)
ff <- lapply(list(as.numeric(usacc), as.numeric(air), nile, rw, sin(2 * pi * (1:120) / 7) * 3 + rnorm(120), rnorm(100), as.numeric(ldeaths), as.numeric(sunspot.year)),
             function(x) list(x = x, f = findfrequency(x)))
out$findfrequency <- ff
# na.interp, tsoutliers, tsclean
nl <- nile; nl[c(5, 6, 40, 77, 100)] <- NA
ua <- as.numeric(usacc); ua[c(3, 20, 21, 50, 71)] <- NA
ol <- as.numeric(usacc); ol[c(10, 40)] <- ol[c(10, 40)] * c(1.6, 0.5)
on <- nile; on[c(20, 60)] <- c(2500, 200)
to1 <- tsoutliers(ts(ol, frequency = 12)); to2 <- tsoutliers(ts(on))
out$clean <- list(
  nainterp_ns = list(x = nl, frequency = 1, r = as.numeric(na.interp(ts(nl)))),
  nainterp_s = list(x = ua, frequency = 12, r = as.numeric(na.interp(ts(ua, frequency = 12)))),
  tsout_s = list(x = ol, frequency = 12, index = as.numeric(to1$index), replacements = as.numeric(to1$replacements)),
  tsout_ns = list(x = on, frequency = 1, index = as.numeric(to2$index), replacements = as.numeric(to2$replacements)),
  tsclean_s = list(x = { z <- ol; z[c(30, 31)] <- NA; z }, frequency = 12, r = as.numeric(tsclean(ts({ z <- ol; z[c(30, 31)] <- NA; z }, frequency = 12)))),
  tsclean_ns = list(x = on, frequency = 1, r = as.numeric(tsclean(ts(on)))))
dec <- mstl(usacc)
out$components <- list(seasonal = as.numeric(seasonal(dec)), trendcycle = as.numeric(trendcycle(dec)), remainder = as.numeric(remainder(dec)))
writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE), file.path("/out", "forecastSimple.json"))
