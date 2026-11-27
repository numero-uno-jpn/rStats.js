# tsmeta120-tseries2.R: tseries' pp.test and the p-values of adf.test (1.20.0), second experiment. Experiment 1 left
# pp.test's statistics 2e-6 to 3e-4 from the Phillips-Perron candidate, more with longer lags. Here a grid of
# variants of the candidate, each written from Phillips and Perron (1988):
#   su2 = sum(u^2) / D1 with D1 in {nn, nn - 3}; s2 (regression variance in the correction) = sum(u^2) / D2 with
#   D2 in {nn, nn - 3}; the Newey-West autocovariances sum(u_t u_{t-s}) / D3 with D3 in {nn, nn - 3, n};
#   lambda2 = su2' + 2 sum_s w_s gamma_s with su2' = sum(u^2) / D3 and w_s = 1 - s / (l + 1);
#   Z(alpha) = nn (rho - 1) - (nn^2 se^2 / s2) (lambda2 - su2) / 2,
#   Z(t_alpha) = sqrt(su2 / lambda2) t - (lambda2 - su2) nn se / (2 sqrt(lambda2 s2)).
# And the p-value of adf.test with the table interpolated at n - 1 (experiment 1) printed with 17 digits, and with
# alternative = "explosive" (candidate 1 - p).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))

tauTable <- rbind(c(-4.38, -3.95, -3.60, -3.24, -1.14, -0.80, -0.50, -0.15),
                  c(-4.15, -3.80, -3.50, -3.18, -1.19, -0.87, -0.58, -0.24),
                  c(-4.04, -3.73, -3.45, -3.15, -1.22, -0.90, -0.62, -0.28),
                  c(-3.99, -3.69, -3.43, -3.13, -1.23, -0.92, -0.64, -0.31),
                  c(-3.98, -3.68, -3.42, -3.13, -1.24, -0.93, -0.65, -0.32),
                  c(-3.96, -3.66, -3.41, -3.12, -1.25, -0.94, -0.66, -0.33))
rhoTable <- rbind(c(-22.5, -19.9, -17.9, -15.6, -3.66, -2.51, -1.53, -0.43),
                  c(-25.7, -22.4, -19.8, -16.8, -3.71, -2.60, -1.66, -0.65),
                  c(-27.4, -23.6, -20.7, -17.5, -3.74, -2.62, -1.73, -0.75),
                  c(-28.4, -24.4, -21.3, -18.0, -3.75, -2.64, -1.78, -0.82),
                  c(-28.9, -24.8, -21.5, -18.1, -3.76, -2.65, -1.78, -0.84),
                  c(-29.5, -25.1, -21.8, -18.3, -3.77, -2.66, -1.79, -0.87))
tableN <- c(25, 50, 100, 250, 500, 1e5)
tableP <- c(0.01, 0.025, 0.05, 0.10, 0.90, 0.95, 0.975, 0.99)
tableInterp <- function(tab, n, stat) {
  crit <- apply(tab, 2, function(col) approx(tableN, col, n, rule = 2)$y)
  approx(crit, tableP, stat, rule = 2)$y
}

ppVariants <- function(y, lshort) {
  n <- length(y); yt <- y[-1]; yl <- y[-n]; nn <- n - 1; tt <- 1:nn
  f <- lm(yt ~ tt + yl); u <- residuals(f)
  rho <- unname(coef(f)[3]); seb <- unname(sqrt(diag(vcov(f)))[3]); tr <- (rho - 1) / seb
  l <- if (lshort) trunc(4 * (nn / 100)^0.25) else trunc(12 * (nn / 100)^0.25)
  ss <- sum(u^2); lagsum <- 0
  for (s in seq_len(l)) lagsum <- lagsum + 2 * (1 - s / (l + 1)) * sum(u[(s + 1):nn] * u[1:(nn - s)])
  res <- list()
  for (D1 in c("nn", "nn3")) for (D2 in c("nn", "nn3")) for (D3 in c("nn", "nn3", "n")) {
    dv <- function(D) switch(D, nn = nn, nn3 = nn - 3, n = n)
    su2 <- ss / dv(D1); s2 <- ss / dv(D2); l2 <- (ss + lagsum) / dv(D3)
    za <- nn * (rho - 1) - (nn^2 * seb^2 / s2) * (l2 - su2) / 2
    zt <- sqrt(su2 / l2) * tr - (l2 - su2) * nn * seb / (2 * sqrt(l2 * s2))
    res[[paste(D1, D2, D3, sep = "_")]] <- c(za = za, zt = zt)
  }
  res
}

set.seed(20261126)
series <- list(lh = as.numeric(lh), lakehuron = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30),
               logair = as.numeric(log(AirPassengers)))
for (nm in names(series)) {
  y <- series[[nm]]; n <- length(y)
  res <- list(n = n)
  for (lsh in c(TRUE, FALSE)) {
    za <- unname(suppressWarnings(pp.test(y, type = "Z(alpha)", lshort = lsh))$statistic)
    zt <- unname(suppressWarnings(pp.test(y, type = "Z(t_alpha)", lshort = lsh))$statistic)
    pza <- suppressWarnings(pp.test(y, type = "Z(alpha)", lshort = lsh))$p.value
    v <- ppVariants(y, lsh)
    res[[paste0("pp_", lsh)]] <- list(za = za, zt = zt, p_za = pza,
      dev = lapply(v, function(c2) c(za = c2[["za"]] - za, zt = c2[["zt"]] - zt)),
      p_cand = lapply(v, function(c2) tableInterp(rhoTable, n - 1, c2[["za"]])))
  }
  a <- suppressWarnings(adf.test(y)); ae <- suppressWarnings(adf.test(y, alternative = "explosive"))
  res$adf <- list(stat = unname(a$statistic), p = a$p.value, p_cand = tableInterp(tauTable, n - 1, a$statistic),
                  p_explosive = ae$p.value, p_explosive_cand = 1 - tableInterp(tauTable, n - 1, a$statistic))
  out[[nm]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
