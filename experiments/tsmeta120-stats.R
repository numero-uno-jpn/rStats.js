# tsmeta120-stats.R: stats' filter, Box.test, diffinv, decompose, ar (yule-walker, burg, ols, mle) and predict.ar
# (1.20.0), first experiment. Candidates written for this experiment from the help pages and Brockwell and Davis
# (1991, 1996):
#   filter: convolution y[i] = sum_j f[j] x[i + o - (j - 1)] with o = 0 (sides = 1) or floor(p / 2) (sides = 2), NA
#     outside (or wrapped when circular); recursive y[i] = x[i] + sum_j f[j] y[i - j] with init (reverse time order);
#   Box.test: r_k = acf (mean removed, divided by n); Box-Pierce n sum r_k^2, Ljung-Box n (n + 2) sum r_k^2 / (n - k);
#     chi-squared with lag - fitdf;
#   diffinv: the cumulative sums with xi, lag and differences;
#   decompose: trend = filter with weights (0.5, 1, ..., 1, 0.5) / f (even f) or rep(1 / f, f) (odd f); figure =
#     the mean of x - trend (or x / trend) for each position in the cycle, then centred (minus its mean, or divided
#     by its mean); random = x - trend - seasonal (or x / (trend seasonal));
#   ar.yw: autocovariances c_k (divided by n) of x - mean; Levinson-Durbin to order.max = min(n - 1,
#     floor(10 log10 n)); v_k = c_0 prod (1 - phi_kk^2); aic_k = n log(v_k) + 2 k, reported minus its minimum;
#     var.pred candidates v_p and v_p n / (n - (p + 1));
#   ar.burg: Burg's recursion; var.method 1 = the Levinson-Durbin update, 2 = the mean of the forward and backward
#     squared errors;
#   ar.ols: x_t - mean on the p lags and an intercept, var.pred = RSS / (n - p) candidates;
#   predict.ar: the AR recursion, se = sqrt(var.pred cumsum(psi^2)).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
mx <- function(a, b) max(abs(a - b), na.rm = TRUE)
naSame <- function(a, b) identical(is.na(a), is.na(b))

# filter
x <- c(3.1, -1.2, 4.5, 0.7, 2.2, NA, 5.9, -2.4, 1.1, 0.3, 6.6, -0.8)
convC <- function(x, f, sides, circular) {
  n <- length(x); p <- length(f); o <- if (sides == 1) 0 else p %/% 2
  sapply(1:n, function(i) {
    idx <- i + o - (0:(p - 1))
    if (circular) idx <- ((idx - 1) %% n) + 1 else if (any(idx < 1 | idx > n)) return(NA)
    sum(f * x[idx])
  })
}
recC <- function(x, f, init) {
  p <- length(f); y <- numeric(length(x)); prev <- if (missing(init)) numeric(p) else init
  for (i in seq_along(x)) { y[i] <- x[i] + sum(f * prev); prev <- c(y[i], prev)[1:p] }
  y
}
fl <- list()
for (f in list(c(0.25, 0.5, 0.25), rep(1, 4) / 4, c(1, -2, 3, 0.5, 0.1))) for (sd in 1:2) for (cc in c(FALSE, TRUE)) {
  r <- as.numeric(stats::filter(x, f, sides = sd, circular = cc)); cnd <- convC(x, f, sd, cc)
  fl[[length(fl) + 1]] <- list(p = length(f), sides = sd, circular = cc, d = mx(r, cnd), na = naSame(r, cnd))
}
xr <- c(1, 2, 0.5, -1, 3, 2.2, 0.1)
for (f in list(0.5, c(0.6, -0.3))) {
  r <- as.numeric(stats::filter(xr, f, method = "recursive")); fl[[length(fl) + 1]] <- list(rec = TRUE, d = mx(r, recC(xr, f)))
  r <- as.numeric(stats::filter(xr, f, method = "recursive", init = rev(seq_along(f)) + 0.5))
  fl[[length(fl) + 1]] <- list(rec_init = TRUE, d = mx(r, recC(xr, f, rev(seq_along(f)) + 0.5)))
}
out$filter <- fl

# Box.test
bt <- list()
for (s in list(as.numeric(lh), as.numeric(LakeHuron), as.numeric(diff(log(AirPassengers))))) for (lag in c(1, 5, 12))
  for (ty in c("Box-Pierce", "Ljung-Box")) for (fd in c(0, 2)) {
    if (lag <= fd) next
    r <- Box.test(s, lag = lag, type = ty, fitdf = fd)
    n <- length(s); rk <- as.numeric(acf(s, lag.max = lag, plot = FALSE)$acf)[-1]
    st <- if (ty == "Box-Pierce") n * sum(rk^2) else n * (n + 2) * sum(rk^2 / (n - 1:lag))
    bt[[length(bt) + 1]] <- list(stat = unname(r$statistic), cand = st, df = unname(r$parameter), p = r$p.value,
                                 cand_p = pchisq(st, lag - fd, lower.tail = FALSE))
  }
out$box <- bt

# diffinv
d1 <- diffinv(c(1, 4, 2, 7)); d2 <- diffinv(c(1, 4, 2, 7, 3, 3), lag = 2, differences = 2, xi = c(1, 2, 3, 4))
out$diffinv <- list(d1 = as.numeric(d1), d2 = as.numeric(d2), d2_back = as.numeric(diff(d2, lag = 2, differences = 2)))

# decompose
decC <- function(x, type) {
  f <- frequency(x); n <- length(x)
  w <- if (f %% 2 == 0) c(0.5, rep(1, f - 1), 0.5) / f else rep(1, f) / f
  tr <- convC(as.numeric(x), w, 2, FALSE)
  det <- if (type == "additive") as.numeric(x) - tr else as.numeric(x) / tr
  pos <- (cycle(x) - 1) %% f + 1
  fig <- sapply(1:f, function(k) mean(det[pos == k], na.rm = TRUE))
  fig <- if (type == "additive") fig - mean(fig) else fig / mean(fig)
  seas <- fig[pos]
  list(trend = tr, figure = fig, seasonal = seas,
       random = if (type == "additive") as.numeric(x) - tr - seas else as.numeric(x) / (tr * seas))
}
dc <- list()
for (cs in list(list("co2", co2), list("usacc", USAccDeaths), list("air_partial", window(AirPassengers, start = c(1949, 4))),
                list("quarterly", presidents[1:120] |> (\(v) ts(ifelse(is.na(v), 50, v), frequency = 4, start = c(1945, 1)))()),
                list("odd5", ts(sin(1:40) + 1:40 / 10 + 5, frequency = 5)))) {
  for (ty in c("additive", "multiplicative")) {
    r <- decompose(cs[[2]], type = ty); cnd <- decC(cs[[2]], ty)
    dc[[paste(cs[[1]], ty, sep = "_")]] <- list(trend = mx(r$trend, cnd$trend), figure = mx(r$figure, cnd$figure),
      seasonal = mx(r$seasonal, cnd$seasonal), random = mx(r$random, cnd$random), figure_R = r$figure)
  }
}
out$decompose <- dc

# ar
levDur <- function(cv, pmax) {
  v <- numeric(pmax + 1); v[1] <- cv[1]; phi <- numeric(0); pac <- numeric(pmax); coefs <- list()
  for (k in 1:pmax) {
    a <- (cv[k + 1] - sum(phi * cv[k:2])) / v[k]
    phi <- c(phi - a * rev(phi), a); pac[k] <- a; v[k + 1] <- v[k] * (1 - a^2); coefs[[k]] <- phi
  }
  list(v = v, pac = pac, coefs = coefs)
}
arr <- list()
for (cs in list(list("lh", lh), list("lakehuron", LakeHuron), list("sunspot", sunspot.year), list("logair_diff", diff(log(AirPassengers))))) {
  xx <- as.numeric(cs[[2]]); n <- length(xx); pm <- min(n - 1, floor(10 * log10(n))); xm <- xx - mean(xx)
  cv <- sapply(0:pm, function(k) sum(xm[1:(n - k)] * xm[(k + 1):n]) / n)
  ld <- levDur(cv, pm)
  aic <- n * log(ld$v) + 2 * (0:pm); aic <- aic - min(aic); p <- which.min(aic) - 1
  r <- ar.yw(cs[[2]])
  pr <- predict(r, n.ahead = 6)
  phi <- if (p) ld$coefs[[p]] else numeric(0)
  psi <- c(1, if (p) ARMAtoMA(phi, numeric(0), 5) else numeric(5))
  fut <- xx; for (h in 1:6) fut <- c(fut, mean(xx) + sum(phi * (rev(fut)[seq_len(p)] - mean(xx))))
  yw <- list(order = r$order, cand_order = p, aic = mx(r$aic, aic), ar = if (p) mx(r$ar, phi) else 0,
             pacf = mx(as.numeric(r$partialacf), ld$pac), var_pred = r$var.pred, v_p = ld$v[p + 1],
             v_p_adj = ld$v[p + 1] * n / (n - (p + 1)),
             pred = mx(as.numeric(pr$pred), tail(fut, 6)),
             se_ratio = as.numeric(pr$se) / sqrt(r$var.pred * cumsum(psi^2)),
             asy_var = r$asy.var.coef, resid_head = as.numeric(r$resid)[1:(p + 1)])
  bu <- list()
  for (vm in 1:2) {
    rb <- ar.burg(cs[[2]], var.method = vm)
    bu[[vm]] <- list(order = rb$order, ar = as.numeric(rb$ar), var_pred = rb$var.pred, aic = as.numeric(rb$aic),
                     pacf = as.numeric(rb$partialacf))
  }
  ro <- ar.ols(cs[[2]])
  po <- ro$order
  ols <- list(order = po, ar = as.numeric(ro$ar), var_pred = as.numeric(ro$var.pred), x_intercept = ro$x.intercept,
              asy_se = as.numeric(ro$asy.se.coef$ar), aic = as.numeric(ro$aic))
  if (po > 0) {
    Z <- embed(xm, po + 1); fo <- lm.fit(cbind(1, Z[, -1, drop = FALSE]), Z[, 1])
    ols$cand_ar <- unname(fo$coefficients[-1]); ols$cand_int <- unname(fo$coefficients[1])
    ols$rss <- sum(fo$residuals^2); ols$nrow <- nrow(Z)
  }
  rm <- ar.mle(cs[[2]])
  mle <- list(order = rm$order, ar = as.numeric(rm$ar), var_pred = rm$var.pred, x_mean = rm$x.mean,
              aic = as.numeric(rm$aic))
  arr[[cs[[1]]]] <- list(n = n, order_max = pm, yw = yw, burg = bu, ols = ols, mle = mle)
}
out$ar <- arr
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
