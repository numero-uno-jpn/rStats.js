source("/oracle/_htest.R")

# t.test (one-sample, Welch, equal variance, paired)

set.seed(20261020)
# Data sets. Include cancellation (large mean, small spread), small scales, heavy-tailed distributions, NA and repeated values
samples <- list(
  list(x = c(1.2, 3.4, 2.2, 5.1), y = c(2, 4, 6, 9, 11, 3)),
  list(x = rnorm(10), y = rnorm(12, 0.5)),
  list(x = rnorm(30, 10, 2), y = rnorm(25, 11, 5)),
  list(x = rnorm(5), y = rnorm(5, 3)),
  list(x = rnorm(3), y = rnorm(2)),
  list(x = rnorm(2), y = rnorm(3)),
  list(x = rnorm(200), y = rnorm(150, 0.1, 3)),
  list(x = rnorm(1000), y = rnorm(1000, 0.05)),
  list(x = 1e8 + rnorm(20, 0, 1e-3), y = 1e8 + rnorm(20, 1e-3, 1e-3)),
  list(x = rnorm(15, 0, 1e-200), y = rnorm(15, 1e-200, 1e-200)),
  list(x = rnorm(15, 0, 1e200), y = rnorm(15, 1e200, 1e200)),
  list(x = rcauchy(40), y = rcauchy(35, 1)),
  list(x = rexp(25), y = rexp(30, 3)),
  list(x = c(rnorm(8), NA, NA), y = c(NA, rnorm(9, 1))),
  list(x = c(1, 2, 2, 2, 3, 3), y = c(5, 5, 5, 6, 6, 7)),
  list(x = rnorm(50, 5), y = rnorm(50, -5)),
  list(x = rnorm(300, 4), y = rnorm(300, -4)),
  list(x = c(0, 0, 0), y = c(0, 0, 0, 0)),
  list(x = c(-3, -1, 4, 2), y = c(2.5, 2.5))
)

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
alts <- c("two.sided", "less", "greater")
for (s in samples) {
  for (alt in alts) {
    # one sample
    for (mu in c(0, 0.5, -2)) add(x = s$x, alternative = alt, mu = mu)
    # two samples
    for (ve in c(FALSE, TRUE)) for (mu in c(0, 1)) add(x = s$x, y = s$y, alternative = alt, mu = mu, varEqual = ve)
    # paired (truncated to the shorter one)
    n <- min(length(s$x), length(s$y))
    add(x = s$x[seq_len(n)], y = s$y[seq_len(n)], alternative = alt, paired = TRUE, mu = 0.25)
  }
  for (cl in c(0, 0.5, 0.9, 0.99, 0.999999, 1)) {
    add(x = s$x, confLevel = cl)
    add(x = s$x, y = s$y, confLevel = cl)
    add(x = s$x, y = s$y, confLevel = cl, varEqual = TRUE, alternative = "less")
  }
}
# Extreme values and inputs that raise errors
add(x = 1)
add(x = c(1, 1, 1))
add(x = c(1, 1), y = c(2, 2))
add(x = c(1, 2, 3), y = 4)
add(x = c(1, 2, 3), y = 4, varEqual = TRUE)
add(x = 1, y = 4, varEqual = TRUE)
add(x = c(1, 2), y = c(3, 4, 5), varEqual = TRUE)
add(x = c(1, 2, 3), y = c(1, 2, 3), paired = TRUE)
add(x = c(1, 2, NA), y = c(1, NA, 5), paired = TRUE)
add(x = c(1, 2, 3), mu = Inf)
add(x = c(1, 2, 3), mu = -1e300)
add(x = c(1e300, 1e300 * (1 + 1e-15), 1e300))
add(x = c(NA, NA, 1))
add(x = c(1, 2, Inf))
add(x = c(1, 2, 3, 4), mu = 1e6)
add(x = c(1, 2, 3, 4) + 1e15)
add(x = c(1, 2, 3, 4), y = c(1, 2, 3, 4) + 1e-10, paired = TRUE)

# Reference: compute the variance, standard error and degrees of freedom with Rmpfr, and get the p-value and quantiles by passing
# them to R's pt / qt (R's var is off by about 1e-11 for data with a large mean and small spread, and for values around 1e200
# the squares overflow and give t = 0). Means are rounded to double before taking the difference. Both R and rStats.js
# use the (rounded) difference of means reported in estimate as the statistic, so that is matched as part of the definition
mp_mean_rounded <- function(v) mp(Rmpfr::asNumeric(mp_mean(v)))
t_ref <- function(a) {
  alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
  mu <- if (is.null(a$mu)) 0 else a$mu
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  x <- a$x; y <- a$y
  if (isTRUE(a$paired)) {
    ok <- !is.na(x) & !is.na(y)
    x <- mp(x[ok]) - mp(y[ok]); y <- NULL
  } else {
    x <- mp(x[!is.na(x)])
    if (!is.null(y)) y <- mp(y[!is.na(y)])
  }
  if (any(!is.finite(x)) || (!is.null(y) && any(!is.finite(y)))) return(NULL)
  nx <- length(x)
  if (is.null(y)) {
    df <- mp(nx - 1); se <- sqrt(mp_var(x) / nx); t <- (mp_mean_rounded(x) - mu) / se
  } else {
    ny <- length(y)
    if (isTRUE(a$varEqual)) {
      df <- mp(nx + ny - 2)
      v <- (if (nx > 1) (nx - 1) * mp_var(x) else 0) + (if (ny > 1) (ny - 1) * mp_var(y) else 0)
      se <- sqrt(v / df * (mp(1) / nx + mp(1) / ny))
    } else {
      sx <- mp_var(x) / nx; sy <- mp_var(y) / ny
      se <- sqrt(sx + sy); df <- (sx + sy)^2 / (sx^2 / (nx - 1) + sy^2 / (ny - 1))
    }
    t <- (mp(Rmpfr::asNumeric(mp_mean_rounded(x) - mp_mean_rounded(y))) - mu) / se
  }
  tn <- Rmpfr::asNumeric(t); dfn <- Rmpfr::asNumeric(df)
  # Interval end points (stay ±Inf if the distance from t is infinite)
  end <- function(d) if (is.infinite(d)) d else Rmpfr::asNumeric(mu + (t + d) * se)
  if (alt == "less") {
    p <- pt(tn, dfn); ci <- c(-Inf, end(qt(cl, dfn)))
  } else if (alt == "greater") {
    p <- pt(tn, dfn, lower.tail = FALSE); ci <- c(end(-qt(cl, dfn)), Inf)
  } else {
    p <- 2 * pt(-abs(tn), dfn); q <- qt(1 - (1 - cl) / 2, dfn); ci <- c(end(-q), end(q))
  }
  list(statistic = num2str(tn), parameter = num2str(dfn), pValue = num2str(p),
       confInt = I(num2str(ci)), stdErr = num2str(Rmpfr::asNumeric(se)))
}

write_htest_fixture("tTest", cases, function(a) {
  r <- t.test(a$x, a$y,
              alternative = if (is.null(a$alternative)) "two.sided" else a$alternative,
              mu = if (is.null(a$mu)) 0 else a$mu,
              paired = isTRUE(a$paired), var.equal = isTRUE(a$varEqual),
              conf.level = if (is.null(a$confLevel)) 0.95 else a$confLevel)
  c(htest_fields(r), list(stdErr = num2str(r$stderr)))
}, t_ref)
