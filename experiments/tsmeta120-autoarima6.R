# tsmeta120-autoarima6.R: forecast's auto.arima (1.20.0, log item 83). In the autoArima fixture's full USAccDeaths
# search (stepwise = FALSE, approximation = FALSE) R prints Inf for ARIMA(1,1,1)(2,1,0)[12] and (3,1,0)(2,1,0)[12],
# whose fits here have AR roots 1.065 and 1.067 and AICc 862.95 and 865.40. Each refitted with Arima (the method
# auto.arima uses, CSS-ML), recording the estimates, the minimum AR / MA root moduli, the AICc, or the error message;
# also with method "ML" and with a neighbouring model for comparison.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch)
rootMin <- function(cf) if (!length(cf)) NA else min(Mod(polyroot(c(1, -cf))))
for (cs in list(list("m111_210", c(1, 1, 1), c(2, 1, 0)), list("m310_210", c(3, 1, 0), c(2, 1, 0)), list("m110_210", c(1, 1, 0), c(2, 1, 0)))) {
  for (meth in c("CSS-ML", "ML")) {
    r <- tryCatch({
      fit <- Arima(USAccDeaths, order = cs[[2]], seasonal = cs[[3]], method = meth)
      phiAll <- fit$model$phi; thetaAll <- fit$model$theta
      list(coef = unname(coef(fit)), names = names(coef(fit)), aicc = fit$aicc, loglik = fit$loglik, code = fit$code,
           ar_root = rootMin(phiAll), ma_root = if (length(thetaAll)) min(Mod(polyroot(c(1, thetaAll)))) else NA)
    }, error = function(e) list(error = conditionMessage(e)), warning = function(w) list(warning = conditionMessage(w)))
    out[[paste(cs[[1]], meth, sep = "_")]] <- r
  }
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "null", pretty = TRUE))
