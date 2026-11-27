# tsmeta120-ets2.R: forecast's forecast.ets (point forecasts and intervals), ses, holt and hw (1.20.0), second ets
# experiment. Candidates written for this experiment from Hyndman, Koehler, Ord and Snyder (2008, chapter 6) and
# Hyndman and Athanasopoulos (2014, sections 7.1-7.5):
#   point forecasts: the state recursions with zero errors (mu_{n+h});
#   class 1 (ANN, AAN, AAdN, ANA, AAA, AAdA): var_h = sigma2 (1 + sum_{j<h} c_j^2), c_j = alpha + beta phi_j +
#     gamma [j mod m = 0], phi_j = phi + ... + phi^j (j for undamped, 0 without a trend);
#   class 2 (MNN, MAN, MAdN, MNA, MAA, MAdA): theta_1 = mu_1^2, theta_h = mu_h^2 + sigma2 sum_{j<h} c_j^2 theta_{h-j},
#     var_h = (1 + sigma2) theta_h - mu_h^2;
#   intervals mu_h +- qnorm(0.5 + level/200) sqrt(var_h);
#   class 3 (MNM, MAM, MAdM) and multiplicative trends: recorded, and forecast() called under two seeds to see
#     whether R simulates;
#   ses / holt / hw (initial = "optimal") = ets with ANN / AAN (AAdN damped, MMN exponential) / AAA or MAM and the
#     same fixed parameters; initial = "simple" (Hyndman and Athanasopoulos): ses l0 = y1; holt l0 = y1,
#     b0 = y2 - y1; hw l0 = mean(y[1:m]), b0 = (mean(y[m + 1:m]) - mean(y[1:m])) / m, s = y[1:m] - l0 (or / l0).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
pars <- function(fit, nm, d) if (nm %in% names(fit$par)) unname(fit$par[nm]) else d

meanPath <- function(fit, h) {
  cmp <- fit$components; tr <- cmp[2]; sea <- cmp[3]; damped <- cmp[4] == "TRUE"; m <- frequency(fit$x)
  st <- fit$states[nrow(fit$states), ]; l <- unname(st["l"]); b <- if (tr != "N") unname(st["b"]) else 0
  s <- if (sea != "N") unname(st[grep("^s", names(st))]) else numeric(0)
  ph <- if (damped) pars(fit, "phi", 1) else 1
  sapply(1:h, function(k) {
    phk <- if (tr == "N") 0 else sum(ph^(1:k))
    Tk <- switch(tr, N = l, A = l + phk * b, M = l * b^phk)
    sk <- if (sea == "N") NA else s[m - ((k - 1) %% m)]   # second run: s1 is the most recent (log item 34)
    switch(sea, N = Tk, A = Tk + sk, M = Tk * sk)
  })
}
cvec <- function(fit, h) {
  cmp <- fit$components; m <- frequency(fit$x); damped <- cmp[4] == "TRUE"
  al <- pars(fit, "alpha", 0); be <- pars(fit, "beta", 0); ga <- pars(fit, "gamma", 0); ph <- if (damped) pars(fit, "phi", 1) else 1
  sapply(seq_len(h - 1), function(j) al + (if (cmp[2] == "N") 0 else be * sum(ph^(1:j))) + (if (cmp[3] == "N") 0 else ga * (j %% m == 0)))
}
cases <- list(list("ANN", Nile, "ANN", FALSE), list("AAN", uspop, "AAN", FALSE), list("AAdN", uspop, "AAN", TRUE),
              list("ANA", USAccDeaths, "ANA", FALSE), list("AAA", USAccDeaths, "AAA", FALSE), list("AAdA", USAccDeaths, "AAA", TRUE),
              list("MNN", Nile, "MNN", FALSE), list("MAN", uspop, "MAN", FALSE), list("MAdN", uspop, "MAN", TRUE),
              list("MNA", USAccDeaths, "MNA", FALSE), list("MAA", USAccDeaths, "MAA", FALSE), list("MAdA", USAccDeaths, "MAA", TRUE),
              list("MNM", AirPassengers, "MNM", FALSE), list("MAM", AirPassengers, "MAM", FALSE), list("MAdM", AirPassengers, "MAM", TRUE),
              list("MMN", uspop, "MMN", FALSE), list("MMdM", AirPassengers, "MMM", TRUE))
for (cs in cases) {
  fit <- ets(cs[[2]], model = cs[[3]], damped = cs[[4]]); h <- 24
  set.seed(1); f1 <- forecast(fit, h = h, level = c(80, 95)); set.seed(2); f2 <- forecast(fit, h = h, level = c(80, 95))
  mu <- meanPath(fit, h); cc <- cvec(fit, h); s2 <- fit$sigma2
  v1 <- s2 * cumsum(c(1, cc^2))
  th <- numeric(h); th[1] <- mu[1]^2
  if (h > 1) for (k in 2:h) th[k] <- mu[k]^2 + s2 * sum(cc[1:(k - 1)]^2 * th[k - (1:(k - 1))])
  v2 <- (1 + s2) * th - mu^2
  half <- (as.numeric(f1$upper[, 2]) - as.numeric(f1$mean)) / qnorm(0.975)
  # second run: class 3 (Hyndman et al. 2008, section 6.3): mu~_h and theta_h of the non-seasonal part (c_j without
  # gamma), k = floor((h - 1) / m), var_h = s_h^2 (theta_h (1 + sigma2) (1 + gamma^2 sigma2)^k - mu~_h^2)
  v3 <- NA
  if (fit$components[3] == "M" && fit$components[2] != "M") {
    m <- frequency(fit$x); st <- fit$states[nrow(fit$states), ]; sv <- unname(st[grep("^s", names(st))])
    sh <- sv[m - ((1:h - 1) %% m)]; mt <- mu / sh
    ga <- pars(fit, "gamma", 0); al <- pars(fit, "alpha", 0); be <- pars(fit, "beta", 0)
    ph <- if (fit$components[4] == "TRUE") pars(fit, "phi", 1) else 1
    c3 <- sapply(seq_len(h - 1), function(j) al + (if (fit$components[2] == "N") 0 else be * sum(ph^(1:j))))
    t3 <- numeric(h); t3[1] <- mt[1]^2
    for (k in 2:h) t3[k] <- mt[k]^2 + s2 * sum(c3[1:(k - 1)]^2 * t3[k - (1:(k - 1))])
    kk <- floor((1:h - 1) / m)
    v3 <- sh^2 * (t3 * (1 + s2) * (1 + ga^2 * s2)^kk - mt^2)
  }
  out[[cs[[1]]]] <- list(mean = max(abs(as.numeric(f1$mean) - mu)), same_seed = max(abs(f1$upper - f2$upper)),
                         class1 = max(abs(half / sqrt(v1) - 1)), class2 = max(abs(half / sqrt(v2) - 1)),
                         class3 = if (length(v3) > 1) max(abs(half / sqrt(v3) - 1)) else NA,
                         lower_sym = max(abs((as.numeric(f1$mean) - as.numeric(f1$lower[, 2])) / qnorm(0.975) - half)),
                         half = half, mu = mu, method = f1$method)
}
# ses / holt / hw
y <- Nile; ya <- AirPassengers; yu <- USAccDeaths
sh <- list()
f <- ses(y, h = 5); e <- forecast(ets(y, "ANN"), h = 5)
sh$ses_par <- list(ses = f$model$par, ets = e$model$par, ses_loglik = f$model$loglik, ets_loglik = e$model$loglik)
sh$ses_opt <- c(mean = max(abs(f$mean - e$mean)), upper = max(abs(f$upper - e$upper)), method = f$method)
f <- holt(uspop, h = 5); e <- forecast(ets(uspop, "AAN", damped = FALSE), h = 5)
sh$holt_par <- list(holt = f$model$par, ets = e$model$par, holt_loglik = f$model$loglik, ets_loglik = e$model$loglik)
sh$holt_opt <- c(mean = max(abs(f$mean - e$mean)), upper = max(abs(f$upper - e$upper)), method = f$method)
f <- holt(uspop, h = 5, damped = TRUE); e <- forecast(ets(uspop, "AAN", damped = TRUE), h = 5)
sh$holt_damped <- c(mean = max(abs(f$mean - e$mean)), method = f$method)
f <- holt(uspop, h = 5, exponential = TRUE); e <- forecast(ets(uspop, "MMN", damped = FALSE), h = 5)
sh$holt_exp <- c(mean = max(abs(f$mean - e$mean)), method = f$method, model = f$model$method)
f <- hw(yu, h = 5); e <- forecast(ets(yu, "AAA", damped = FALSE), h = 5)
sh$hw_add <- c(mean = max(abs(f$mean - e$mean)), method = f$method)
f <- hw(ya, h = 5, seasonal = "multiplicative"); e <- forecast(ets(ya, "MAM", damped = FALSE), h = 5)
sh$hwm_par <- list(hw = f$model$par, ets = e$model$par, hw_loglik = f$model$loglik, ets_loglik = e$model$loglik)
sh$hw_mult <- c(mean = max(abs(f$mean - e$mean)), method = f$method)
fs <- ses(y, h = 5, initial = "simple")
fh <- holt(uspop, h = 5, initial = "simple"); fw <- hw(yu, h = 5, initial = "simple")
sh$simple <- list(ses = list(method = fs$method, model = class(fs$model), names = names(fs$model), par = fs$model$par,
                             l_first = as.numeric(fs$model$fitted)[1:3], y_first = as.numeric(y)[1:3], sse = fs$model$SSE),
                  holt = list(method = fh$method, par = fh$model$par, fitted_first = as.numeric(fh$model$fitted)[1:3]),
                  hw = list(method = fw$method, par = fw$model$par, initstate = fw$model$initstate, fitted_first = as.numeric(fw$model$fitted)[1:3]))
out$wrappers <- sh
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
