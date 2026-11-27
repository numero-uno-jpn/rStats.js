# tsmeta120-ets.R: forecast's ets (1.20.0), first experiment. The filter, likelihood and information criteria given
# R's own estimates (fit$par: smoothing parameters and initial states), against a candidate written for this experiment
# from Hyndman, Koehler, Ord and Snyder (2008, Forecasting with Exponential Smoothing, tables 2.2 and 2.3, sections 5.1
# and 5.2):
#   one-step mean mu_t = T (season N), T + s_{t-m} (A), T s_{t-m} (M) with T = l (N), l + phi b (A / Ad),
#     l b^phi (M / Md); error e = y - mu (additive) or (y - mu) / mu (multiplicative);
#   the state updates of table 2.3 for every combination (additive and multiplicative errors);
#   the seasonal initial states either as given (s0 the most recent, candidate SA) or reversed (SB);
#   criterion lik = n log(sum e^2) (+ 2 sum log |mu| for multiplicative errors); loglik candidates
#     L1 = -0.5 lik, L2 = -0.5 (n log(2 pi sum e^2 / n) + n) - sum log |mu|;
#   aic = -2 loglik + 2 (p + 1), p = the number of estimated parameters including the initial states;
#     bic = aic + (p + 1) (log n - 2); aicc = aic + 2 (p + 1)(p + 2) / (n - p - 2);
#   sigma2 candidates sum(e^2) / n and sum(e^2) / (n - p); mse = mean((y - mu)^2); amse = the mean over horizons
#     1..nmse of the in-sample h-step squared errors.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))

etsFilter <- function(y, m, err, trend, seas, damped, par, revS) {
  g <- function(nm, d) if (nm %in% names(par)) unname(par[nm]) else d
  al <- g("alpha", 0); be <- g("beta", 0); ga <- g("gamma", 0); ph <- if (damped) g("phi", 1) else 1
  l <- g("l", NA); b <- if (trend != "N") g("b", if (trend == "M") 1 else 0) else (if (trend == "M") 1 else 0)
  s <- if (seas != "N") unname(par[grep("^s[0-9]", names(par))]) else numeric(0)
  if (seas != "N") { if (length(s) == m - 1) s <- c(s, if (seas == "A") -sum(s) else m - sum(s)); if (revS) s <- rev(s) }
  # s[1] = s_{t-1} (most recent) ... s[m] = s_{t-m}
  n <- length(y); e <- mu <- numeric(n); states <- matrix(NA, n + 1, 2 + m)
  states[1, ] <- c(l, b, if (m) c(s, rep(NA, m - length(s)))[1:m] else numeric(0))[1:(2 + m)]
  for (t in 1:n) {
    Tt <- switch(trend, N = l, A = l + ph * b, M = l * b^ph)
    sm <- if (seas == "N") (if (err == "M") 1 else 0) else s[m]
    mu[t] <- switch(seas, N = Tt, A = Tt + sm, M = Tt * sm)
    if (err == "A") {
      ee <- y[t] - mu[t]
      if (seas == "M") { ln <- Tt + al * ee / sm; bn <- switch(trend, N = b, A = ph * b + be * ee / sm, M = b^ph + be * ee / (sm * l)); sn <- sm + ga * ee / Tt }
      else { ln <- Tt + al * ee; bn <- switch(trend, N = b, A = ph * b + be * ee, M = b^ph + be * ee / l); sn <- sm + ga * ee }
    } else {
      ee <- (y[t] - mu[t]) / mu[t]
      if (seas == "A") { ln <- Tt + al * mu[t] * ee; bn <- switch(trend, N = b, A = ph * b + be * mu[t] * ee, M = b^ph + be * mu[t] * ee / l); sn <- sm + ga * mu[t] * ee }
      else { ln <- Tt * (1 + al * ee); bn <- switch(trend, N = b, A = ph * b + be * Tt * ee, M = b^ph * (1 + be * ee)); sn <- if (seas == "M") sm * (1 + ga * ee) else sm }
    }
    e[t] <- ee; l <- ln; b <- bn
    if (seas != "N") s <- c(sn, s[-m])
    states[t + 1, ] <- c(l, b, if (m) s else numeric(0))[1:(2 + m)]
  }
  list(e = e, mu = mu, states = states)
}

cases <- list(
  list("nile_ANN", Nile, "ANN", FALSE), list("nile_MNN", Nile, "MNN", FALSE),
  list("uspop_AAN", uspop, "AAN", FALSE), list("uspop_AAdN", uspop, "AAN", TRUE), list("uspop_MAN", uspop, "MAN", FALSE),
  list("usacc_ANA", USAccDeaths, "ANA", FALSE), list("usacc_AAA", USAccDeaths, "AAA", FALSE), list("usacc_MNA", USAccDeaths, "MNA", FALSE),
  list("air_MAM", AirPassengers, "MAM", FALSE), list("air_MAdM", AirPassengers, "MAM", TRUE), list("air_MNM", AirPassengers, "MNM", FALSE),
  list("air_ANM", AirPassengers, "ANM", FALSE), list("air_AAM", AirPassengers, "AAM", FALSE),
  list("uspop_MMN", uspop, "MMN", FALSE), list("air_MMdM", AirPassengers, "MMM", TRUE)
)
for (cs in cases) {
  fit <- tryCatch(ets(cs[[2]], model = cs[[3]], damped = cs[[4]]), error = function(e) conditionMessage(e))
  if (is.character(fit)) { out[[cs[[1]]]] <- list(error = fit); next }   # second run: forbidden combinations recorded
  y <- as.numeric(cs[[2]]); n <- length(y); m <- if (substr(cs[[3]], 3, 3) == "N") 0 else frequency(cs[[2]])
  err <- substr(cs[[3]], 1, 1); tr <- substr(cs[[3]], 2, 2); sea <- substr(cs[[3]], 3, 3)
  res <- list(par = fit$par, par_names = names(fit$par), loglik = fit$loglik, aic = fit$aic, bic = fit$bic, aicc = fit$aicc,
              sigma2 = fit$sigma2, mse = fit$mse, amse = fit$amse, method = fit$method, states_dim = dim(fit$states),
              initstate = fit$initstate, initstate_names = names(fit$initstate))
  for (rv in c(FALSE, TRUE)) {
    if (m == 0 && rv) next
    c1 <- etsFilter(y, m, err, tr, sea, cs[[4]], fit$par, rv)
    sse <- sum(c1$e^2); lik <- n * log(sse) + if (err == "M") 2 * sum(log(abs(c1$mu))) else 0
    L2 <- -0.5 * (n * log(2 * pi * sse / n) + n) - if (err == "M") sum(log(abs(c1$mu))) else 0
    p <- length(fit$par)
    res[[if (rv) "SB" else "SA"]] <- list(
      resid = max(abs(as.numeric(residuals(fit)) - c1$e)), fitted = max(abs(as.numeric(fitted(fit)) - c1$mu)),
      states = { idx <- c(1, if (tr != "N") 2, if (m) 3:(2 + m)); if (ncol(fit$states) == length(idx)) max(abs(fit$states - c1$states[, idx])) else NA },
      L1 = fit$loglik - (-0.5 * lik), L2 = fit$loglik - L2,
      aic_p1 = fit$aic - (-2 * fit$loglik + 2 * (p + 1)), bic = fit$bic - (fit$aic + (p + 1) * (log(n) - 2)),
      aicc = fit$aicc - (fit$aic + 2 * (p + 1) * (p + 2) / (n - p - 2)),
      s2_n = fit$sigma2 / (sse / n) - 1, s2_np = fit$sigma2 / (sse / (n - p)) - 1,
      mse = fit$mse - mean((y - c1$mu)^2))
  }
  out[[cs[[1]]]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
