# tsmeta120-hw2.R: predict.HoltWinters's prediction intervals (1.20.0), second experiment. Experiment tsmeta120-hw
# found the half-widths proportional to sqrt(1 + sum_{j<h} psi_j^2) (psi_j = alpha (1 + j beta) + gamma (1 - alpha)
# [j mod p = 0]) but with a variance other than SSE / n. Candidates: var() of the one-step residuals (mean removed,
# divided by n - 1), and SSE / (n - 1).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
cases <- list(list("co2_add", co2, 0.5, 0.01, 0.4, "additive"), list("usacc_add", USAccDeaths, 0.7, 0.1, 0.3, "additive"),
              list("uspop_trend", uspop, 0.8, 0.4, FALSE, "additive"), list("nile_level", Nile, 0.25, FALSE, FALSE, "additive"),
              list("air_mult", AirPassengers, 0.3, 0.05, 0.6, "multiplicative"), list("co2_opt", co2, NULL, NULL, NULL, "additive"))
for (cs in cases) {
  r <- HoltWinters(cs[[2]], alpha = cs[[3]], beta = cs[[4]], gamma = cs[[5]], seasonal = cs[[6]])
  pr <- predict(r, n.ahead = 13, prediction.interval = TRUE, level = 0.9)
  half <- as.numeric(pr[, "upr"] - pr[, "fit"]) / qnorm(0.95)
  res <- as.numeric(residuals(r)); f <- frequency(cs[[2]])
  al <- r$alpha; bt <- if (isFALSE(r$beta)) 0 else r$beta; gm <- if (isFALSE(r$gamma)) 0 else r$gamma
  psi <- sapply(1:12, function(j) al * (1 + j * bt) + gm * (1 - al) * (j %% f == 0))
  v <- sapply(1:13, function(k) 1 + sum(psi[seq_len(k - 1)]^2))
  out[[cs[[1]]]] <- list(ratio_var = half / sqrt(var(res) * v), ratio_n1 = half / sqrt(sum(res^2) / (length(res) - 1) * v),
                         lwr_sym = max(abs(as.numeric(pr[, "fit"] - pr[, "lwr"]) - as.numeric(pr[, "upr"] - pr[, "fit"]))))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
