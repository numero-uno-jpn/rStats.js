# tsmeta120-fsmall2.R: forecast's easter (months that split the holidays), bizdays, findfrequency, BoxCox,
# InvBoxCox, BoxCox.lambda, na.interp, tsCV and arimaorder (1.20.0). Candidates written for this experiment from the
# help pages, Guerrero (1993, J. Forecasting 12, 37-48) and Box and Cox (1964):
#   easter: Easter Sunday by the anonymous Gregorian algorithm; holidays Good Friday, Saturday, Sunday (and Monday
#     with easter.mon); the value of a month / quarter = the share of those days falling in it;
#   bizdays: weekdays (Monday-Friday) in the month as a first look (holidays then show as the differences);
#   findfrequency: x - linear trend, spec.ar of that, period = round(1 / frequency at the maximum) (printed beside R);
#   BoxCox: log(x) for lambda 0, (sign(x) |x|^lambda - 1) / lambda otherwise; InvBoxCox its inverse;
#   BoxCox.lambda "guerrero": subseries of length max(2, frequency) (candidates: complete groups from the start or
#     from the end), ratio_i = sd_i / mean_i^(1 - lambda), minimise sd(ratio) / mean(ratio) over [lower, upper]
#     (R's value beside a tight optimize); "loglik": the profile log-likelihood -n/2 log(SSE(lambda)/n) +
#     (lambda - 1) sum log x of lm on a trend (+ seasonal dummies), maximised (tight optimize and a grid by 0.05);
#   na.interp: linear interpolation for non-seasonal series (printed beside approx with rule = 2);
#   tsCV: errors of forecastfunction applied to y[1:t] for each t (computed directly);
#   arimaorder: the orders as a named vector.
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
    es <- easterSunday(years[yi]); days <- es + (-2:(if (mon) 1 else 0))
    mm <- as.integer(format(days, "%m")); per <- if (freq == 12) mm else (mm - 1) %/% 3 + 1
    for (p in per) v[yi, p] <- v[yi, p] + 1 / length(days)
  }
  as.numeric(t(v))
}
yrs <- 2008:2027
em <- easter(ts(rep(1, 12 * length(yrs)), start = c(2008, 1), frequency = 12))
emm <- easter(ts(rep(1, 12 * length(yrs)), start = c(2008, 1), frequency = 12), easter.mon = TRUE)
eq <- easter(ts(rep(1, 4 * length(yrs)), start = c(2008, 1), frequency = 4))
out$easter <- list(monthly = mx(em, easterC(yrs, 12, FALSE)), monthly_mon = mx(emm, easterC(yrs, 12, TRUE)),
                   quarterly = mx(eq, easterC(yrs, 4, FALSE)), dates = format(easterSunday(yrs)),
                   R_split_2016 = as.numeric(window(em, start = c(2016, 3), end = c(2016, 4))),
                   R_split_2018 = as.numeric(window(emm, start = c(2018, 3), end = c(2018, 4))))

# bizdays
bz <- list()
for (fc in c("New York", "London", "NERC", "Toronto", "Zurich")) {
  b <- bizdays(ts(rep(1, 12 * 6), start = c(2019, 1), frequency = 12), FinCenter = fc)
  bz[[fc]] <- as.numeric(b)
}
wd <- sapply(0:71, function(k) { first <- seq(as.Date("2019-01-01"), by = "month", length.out = 73)
  d <- seq(first[k + 1], first[k + 2] - 1, by = "day"); sum(!format(d, "%u") %in% c("6", "7")) })
out$bizdays <- c(bz, list(weekdays = wd, quarterly_NY = as.numeric(bizdays(ts(rep(1, 8), start = c(2019, 1), frequency = 4)))))

# findfrequency
set.seed(3)
ff <- list()
for (cs in list(list("sin7", ts(sin(2 * pi * (1:140) / 7) + rnorm(140, sd = 0.3))), list("air", AirPassengers),
                list("noise", ts(rnorm(100))), list("lynx", lynx), list("sunspot", sunspot.year),
                list("usacc", USAccDeaths), list("nottem", ts(as.numeric(nottem))))) {
  x <- as.numeric(cs[[2]]); tt <- seq_along(x); res <- residuals(lm(x ~ tt))
  sp <- spec.ar(res, plot = FALSE)
  ff[[cs[[1]]]] <- list(R = findfrequency(cs[[2]]), cand = round(1 / sp$freq[which.max(sp$spec)]),
                        maxspec = max(sp$spec), order = sp$method)
}
out$findfrequency <- ff

# BoxCox, InvBoxCox
x <- as.numeric(AirPassengers)
bcC <- function(x, l) if (l == 0) log(x) else (sign(x) * abs(x)^l - 1) / l
out$boxcox <- list(l0 = mx(BoxCox(x, 0), log(x)), l05 = mx(BoxCox(x, 0.5), bcC(x, 0.5)),
                   lneg = mx(BoxCox(x, -0.7), bcC(x, -0.7)),
                   negx = list(R = as.numeric(BoxCox(c(-2, -0.5, 0, 1.5), 0.5)), cand = bcC(c(-2, -0.5, 0, 1.5), 0.5)),
                   inv = mx(InvBoxCox(BoxCox(x, 0.3), 0.3), x), inv0 = mx(InvBoxCox(log(x), 0), x),
                   inv_neg = as.numeric(InvBoxCox(c(-3, -2.5, 0.1), 0.5)),
                   attr_lambda = attr(BoxCox(x, 0.3), "lambda"))

# BoxCox.lambda
guer <- function(x, f, fromEnd) {
  len <- max(2, f); ng <- floor(length(x) / len)
  xs <- if (fromEnd) tail(x, ng * len) else head(x, ng * len)
  M <- matrix(xs, nrow = len)
  mu <- colMeans(M); s <- apply(M, 2, sd)
  function(l) { r <- s / mu^(1 - l); sd(r) / mean(r) }
}
bl <- list()
for (cs in list(list("air", AirPassengers), list("usacc", USAccDeaths), list("nile", Nile), list("lynx", lynx),
                list("odd_len", ts(as.numeric(AirPassengers)[1:137], frequency = 12)))) {
  x <- as.numeric(cs[[2]]); f <- frequency(cs[[2]])
  g1 <- guer(x, f, FALSE); g2 <- guer(x, f, TRUE)
  o1 <- optimize(g1, c(-1, 2), tol = 1e-12); o2 <- optimize(g2, c(-1, 2), tol = 1e-12)
  tt <- seq_along(x)
  X <- if (f > 1) model.matrix(~ tt + factor(cycle(cs[[2]]))) else cbind(1, tt)
  pll <- function(l) { z <- bcC(x, l); e <- lm.fit(X, z)$residuals; -length(x) / 2 * log(sum(e^2) / length(x)) + (l - 1) * sum(log(x)) }
  o3 <- optimize(pll, c(-1, 2), maximum = TRUE, tol = 1e-12)
  grid <- seq(-1, 2, by = 0.05); gv <- sapply(grid, pll)
  bl[[cs[[1]]]] <- list(guerrero = BoxCox.lambda(cs[[2]]), cand_start = o1$minimum, cand_end = o2$minimum,
                        loglik = BoxCox.lambda(cs[[2]], method = "loglik"), cand_ll = o3$maximum,
                        cand_ll_grid = grid[which.max(gv)])
}
out$boxcox_lambda <- bl

# na.interp (non-seasonal: linear)
xn <- as.numeric(Nile); xn[c(1, 2, 10, 11, 12, 50, 100)] <- NA
ni <- na.interp(ts(xn))
out$na_interp_linear <- list(R = as.numeric(ni), approx_rule2 = approx(seq_along(xn), xn, seq_along(xn), rule = 2)$y)
xs <- as.numeric(AirPassengers); xs[c(5, 30, 31, 32, 77, 140)] <- NA
out$na_interp_seasonal <- list(R = as.numeric(na.interp(ts(xs, frequency = 12))), idx = c(5, 30, 31, 32, 77, 140))

# tsCV
rwfCall <- function(y, h, ...) rwf(y, h = h, ...)   # a wrapper that calls rwf (tsCV takes a function)
e1 <- tsCV(Nile, rwfCall, h = 1); e3 <- tsCV(Nile, rwfCall, drift = TRUE, h = 3)
y <- as.numeric(Nile); n <- length(y)
c1 <- c(NA, sapply(1:(n - 1), function(t) y[t + 1] - y[t]))
c3 <- matrix(NA, n, 3)
for (t in 1:(n - 1)) { fc <- tryCatch(rwf(ts(y[1:t]), drift = TRUE, h = 3), error = function(e) NULL)
  if (is.null(fc)) next   # too short for a drift: left NA, as tsCV says it may
  for (hh in 1:3) if (t + hh <= n) c3[t, hh] <- y[t + hh] - as.numeric(fc$mean)[hh] }
out$tscv <- list(h1 = mx(e1, c1), h1_na = which(is.na(e1)), h3 = mx(e3, c3), h3_na_R = sum(is.na(e3)), h3_na_c = sum(is.na(c3)),
                 h3_dim = dim(e3))

# arimaorder
out$arimaorder <- list(a = arimaorder(Arima(lh, c(1, 0, 1))),
                       s = arimaorder(Arima(USAccDeaths, c(0, 1, 1), seasonal = c(0, 1, 1))),
                       names_s = names(arimaorder(Arima(USAccDeaths, c(0, 1, 1), seasonal = c(0, 1, 1)))))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
