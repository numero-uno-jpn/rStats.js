# tsmeta120-arima0.R: stats' arima0 (1.20.0, log item 84). The statsTs fixture shows arima0's log-likelihood above the
# exact one of arima at its own maximum (lh ARMA(1,1): -28.76176 against -28.76203), so arima0 does not maximise the
# exact likelihood. The help page's delta ("fast recursions" once the filter has converged, default 0.01; negative:
# never) is the candidate. Designed: the log-likelihood and sigma2 at fixed coefficients (fixed, transform.pars =
# FALSE), for delta = -1, 0, 1e-4, 0.01, 0.1, 0.5, on pure AR models (where the filter converges exactly after p
# steps), MA(1) with theta near 0 and near 1 (slow convergence), and ARMA(1,1); beside arima's exact value at the same
# coefficients.
# Run 1 stopped: arima0 refuses to fix every parameter, so (run 2, edited in place) the mean is left free in both
# arima0 and arima (one parameter estimated; the comparison is at the same ARMA coefficients).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
y <- as.numeric(lh)
cases <- list(list("ar1", c(1, 0, 0), c(0.57, 2.4)), list("ar2", c(2, 0, 0), c(0.6, -0.1, 2.4)),
              list("ma1_small", c(0, 0, 1), c(0.2, 2.4)), list("ma1_large", c(0, 0, 1), c(0.9, 2.4)),
              list("arma11", c(1, 0, 1), c(0.45, 0.2, 2.4)), list("ma2", c(0, 0, 2), c(0.7, 0.4, 2.4)))
for (cs in cases) {
  r <- list(order = cs[[2]], coef = cs[[3]])
  for (dl in c(-1, 0, 1e-4, 0.01, 0.1, 0.5)) {
    f <- arima0(y, order = cs[[2]], fixed = c(head(cs[[3]], -1), NA), transform.pars = FALSE, delta = dl)
    r[[paste0("d", dl)]] <- c(loglik = f$loglik, sigma2 = f$sigma2, mean = unname(tail(f$coef, 1)))
  }
  e <- arima(y, order = cs[[2]], fixed = c(head(cs[[3]], -1), NA), transform.pars = FALSE, method = "ML", optim.control = list(reltol = 1e-14))
  r$exact <- c(loglik = e$loglik, sigma2 = e$sigma2, mean = unname(tail(coef(e), 1)))
  out[[cs[[1]]]] <- r
}
out$y <- y
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "null", pretty = TRUE))
