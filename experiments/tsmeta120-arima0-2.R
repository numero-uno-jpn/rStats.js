# tsmeta120-arima0-2.R: stats' arima0 "fast recursions" (1.20.0, log item 87). ?arima0: the filter switches to fast
# recursions "if the innovations variance is close enough to its asymptotic bound", delta setting the tolerance.
# Designed: no estimation (init = the coefficients, optim.control = list(maxit = 0), transform.pars = FALSE,
# include.mean = FALSE on the demeaned series; the returned coef is recorded to confirm it stayed at init), and the
# fitted innovations (residuals) per time point for delta = -1 (exact) and 1e-4, 0.01, 0.1, 0.5: the first time
# point where they leave the exact ones is the switch, and the later ones show the recursion used after it.
# Models: MA(1) theta 0.5 and 0.9, ARMA(1,1), AR(2), MA(2), on lh (demeaned) and on a longer simulated series.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261202)
series <- list(lh = as.numeric(lh) - mean(lh), sim = as.numeric(arima.sim(list(ma = 0.7), 120)))
cases <- list(list("ma1_05", c(0, 0, 1), 0.5), list("ma1_09", c(0, 0, 1), 0.9), list("arma11", c(1, 0, 1), c(0.45, 0.3)),
              list("ar2", c(2, 0, 0), c(0.6, -0.1)), list("ma2", c(0, 0, 2), c(0.7, 0.4)))
for (sn in names(series)) for (cs in cases) {
  r <- list(order = cs[[2]], coef = cs[[3]])
  for (dl in c(-1, 1e-4, 0.01, 0.1, 0.5)) {
    f <- arima0(series[[sn]], order = cs[[2]], include.mean = FALSE, init = cs[[3]], transform.pars = FALSE,
                optim.control = list(maxit = 0), delta = dl)
    r[[paste0("d", dl)]] <- list(coef = unname(f$coef), sigma2 = f$sigma2, loglik = f$loglik, resid = as.numeric(residuals(f)))
  }
  out[[paste(sn, cs[[1]], sep = "_")]] <- r
}
out$series <- series
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "null"))
