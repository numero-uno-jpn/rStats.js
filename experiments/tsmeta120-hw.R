# tsmeta120-hw.R: stats' HoltWinters and predict.HoltWinters (1.20.0), first experiment, and ar.mle against arima0
# (the second and last try for ar.mle). Candidates written for this experiment from the help pages and Hyndman,
# Koehler, Ord and Snyder (2008, Forecasting with Exponential Smoothing, ch. 6, the prediction variances of the
# Holt-Winters methods):
#   start values (help page): seasonal: decompose() of the first start.periods periods; l.start and b.start = the
#     intercept and slope of lm(trend ~ index) on the non-missing trend values (candidates: index 1..k of the
#     non-missing values, or their time positions), s.start = the figure; the filter starts at t = f + 1 (C1) or
#     t = start.periods f + 1 (C2). Trend only: a = x[2], b = x[2] - x[1], from t = 3. Level only: a = x[1], from t = 2.
#   the recursions of the help page; SSE = the sum of the squared one-step errors over the filtered t;
#   coefficients = the last a, b and the last p seasonal values (s1 = the next period's);
#   prediction intervals: var_h = (SSE / (n_used)) (1 + sum_{j<h} psi_j^2), psi_j = alpha (1 + j beta) +
#     gamma (1 - alpha) [j mod p = 0] (additive); candidates for the denominator n_used and n_used - npar;
#   optimisation: R's default fit against a tight refit (optim.control reltol 1e-15) and an exhaustive refinement.
#   ar.mle: arima0(x, c(k, 0, 0)) for each order: aic, coefficients, mean, sigma2.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)

hwC <- function(x, alpha, beta, gamma, stype, startC, idxPos) {
  xx <- as.numeric(x); f <- frequency(x); n <- length(xx)
  if (isFALSE(gamma)) {
    if (isFALSE(beta)) { a <- xx[1]; b <- 0; t0 <- 2 } else { a <- xx[2]; b <- xx[2] - xx[1]; t0 <- 3 }
    s <- numeric(0); sea <- FALSE
  } else {
    st <- decompose(ts(xx[1:(2 * f)], start = start(x), frequency = f), stype)
    tr <- as.numeric(st$trend); ok <- which(!is.na(tr))
    idx <- if (idxPos) ok else seq_along(ok)
    cf <- coef(lm(tr[ok] ~ idx)); a <- unname(cf[1]); b <- unname(cf[2])
    s <- as.numeric(st$figure); sea <- TRUE
    t0 <- if (startC == 1) f + 1 else 2 * f + 1
  }
  bt <- if (isFALSE(beta)) 0 else beta
  fit <- rep(NA, n); sse <- 0
  for (t in t0:n) {
    sp <- if (sea) s[1] else (if (stype == "additive") 0 else 1)
    yhat <- if (stype == "additive" || !sea) a + b + sp else (a + b) * sp
    fit[t] <- yhat; sse <- sse + (xx[t] - yhat)^2
    an <- if (stype == "additive" || !sea) alpha * (xx[t] - sp) + (1 - alpha) * (a + b) else
      alpha * (xx[t] / sp) + (1 - alpha) * (a + b)
    bn <- if (isFALSE(beta)) 0 else bt * (an - a) + (1 - bt) * b
    if (sea) {
      sn <- if (stype == "additive") gamma * (xx[t] - an) + (1 - gamma) * sp else gamma * (xx[t] / an) + (1 - gamma) * sp
      s <- c(s[-1], sn)
    }
    a <- an; b <- bn
  }
  list(fit = fit, sse = sse, a = a, b = b, s = s, t0 = t0)
}

cases <- list(
  list(name = "co2_add", x = co2, alpha = 0.5, beta = 0.01, gamma = 0.4, seasonal = "additive"),
  list(name = "air_mult", x = AirPassengers, alpha = 0.3, beta = 0.05, gamma = 0.6, seasonal = "multiplicative"),
  list(name = "usacc_add", x = USAccDeaths, alpha = 0.7, beta = 0.1, gamma = 0.3, seasonal = "additive"),
  list(name = "uspop_trend", x = uspop, alpha = 0.8, beta = 0.4, gamma = FALSE, seasonal = "additive"),
  list(name = "nile_level", x = Nile, alpha = 0.25, beta = FALSE, gamma = FALSE, seasonal = "additive")
)
for (cs in cases) {
  r <- HoltWinters(cs$x, alpha = cs$alpha, beta = cs$beta, gamma = cs$gamma, seasonal = cs$seasonal)
  fR <- as.numeric(r$fitted[, "xhat"]); n <- length(cs$x)
  vars <- list()
  for (sc in 1:2) for (ip in c(FALSE, TRUE)) {
    cnd <- hwC(cs$x, cs$alpha, cs$beta, cs$gamma, cs$seasonal, sc, ip)
    vars[[paste0("C", sc, "_", ip)]] <- list(sse = r$SSE - cnd$sse,
      fit = if (length(fR) == n - cnd$t0 + 1) max(abs(fR - cnd$fit[cnd$t0:n])) else NA,
      coef = max(abs(unname(r$coefficients) - c(cnd$a, if (!isFALSE(cs$beta)) cnd$b, cnd$s))))
    if (isFALSE(cs$gamma)) break
  }
  pr <- predict(r, n.ahead = 13, prediction.interval = TRUE, level = 0.95)
  half <- (pr[, "upr"] - pr[, "fit"]) / qnorm(0.975)
  out[[cs$name]] <- list(sse = r$SSE, nfit = length(fR), coefficients = unname(r$coefficients),
                         coef_names = names(r$coefficients), vars = vars, fit_pred = as.numeric(pr[, "fit"]),
                         half = as.numeric(half))
}
# prediction variance candidates for the additive co2 case and the trend case
for (nm in c("co2_add", "usacc_add", "uspop_trend", "nile_level")) {
  cs <- Filter(function(z) z$name == nm, cases)[[1]]
  r <- HoltWinters(cs$x, alpha = cs$alpha, beta = cs$beta, gamma = cs$gamma)
  f <- frequency(cs$x); nused <- length(r$fitted[, 1]); h <- 1:13
  bt <- if (isFALSE(cs$beta)) 0 else cs$beta; gm <- if (isFALSE(cs$gamma)) 0 else cs$gamma
  psi <- sapply(1:12, function(j) cs$alpha * (1 + j * bt) + gm * (1 - cs$alpha) * (j %% f == 0 && !isFALSE(cs$gamma)))
  v <- sapply(h, function(k) 1 + sum(psi[seq_len(k - 1)]^2))
  half <- out[[nm]]$half
  out[[paste0("pi_", nm)]] <- list(ratio_n = half / sqrt(r$SSE / nused * v),
                                   s2_implied = half^2 / v, sse_over_n = r$SSE / nused)
}
# optimisation: default against tight
for (cs in list(list("co2", co2, "additive"), list("air", AirPassengers, "multiplicative"), list("nile", Nile, NA))) {
  if (is.na(cs[[3]])) {
    r <- HoltWinters(cs[[2]], beta = FALSE, gamma = FALSE)
    g <- function(a) hwC(cs[[2]], a, FALSE, FALSE, "additive", 1, FALSE)$sse
    o <- optimize(g, c(0, 1), tol = 1e-12)
    out[[paste0("opt_", cs[[1]])]] <- list(alpha = r$alpha, sse = r$SSE, alpha_tight = o$minimum, sse_tight = o$objective)
  } else {
    r <- HoltWinters(cs[[2]], seasonal = cs[[3]])
    rt <- HoltWinters(cs[[2]], seasonal = cs[[3]], optim.control = list(factr = 1, pgtol = 0, maxit = 10000))
    out[[paste0("opt_", cs[[1]])]] <- list(par = c(r$alpha, r$beta, r$gamma), sse = r$SSE,
                                           par_tight = c(rt$alpha, rt$beta, rt$gamma), sse_tight = rt$SSE)
  }
}
# ar.mle against arima0
for (cs in list(list("lh", lh), list("lakehuron", LakeHuron), list("sunspot", sunspot.year))) {
  rm <- ar.mle(cs[[2]]); xx <- as.numeric(cs[[2]]); n <- length(xx); pmm <- min(floor(10 * log10(n)), 12)
  fits <- lapply(0:pmm, function(k) arima0(xx, order = c(k, 0, 0)))
  a0 <- sapply(fits, function(f) f$aic); p <- rm$order
  out[[paste0("armle_", cs[[1]])]] <- list(order = p, aic = as.numeric(rm$aic), d_aic = max(abs(rm$aic - (a0 - min(a0)))),
    d_ar = if (p) max(abs(as.numeric(rm$ar) - coef(fits[[p + 1]])[1:p])) else 0,
    d_mean = rm$x.mean - unname(coef(fits[[p + 1]])[p + 1]), var_pred = rm$var.pred, s2 = fits[[p + 1]]$sigma2,
    d_aic_n = max(abs(rm$aic - ((n * log(sapply(fits, function(f) f$sigma2)) + 2 * (0:pmm)) -
                                min(n * log(sapply(fits, function(f) f$sigma2)) + 2 * (0:pmm))))))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
