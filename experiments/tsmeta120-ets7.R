# tsmeta120-ets7.R: forecast's ets amse for damped trends (1.20.0, log item 82). The ets fixture agrees with the
# candidate of log 51 (amse = the mean over h = 1..nmse of the in-sample h-step MSE along the zero-error path) for
# ANN, AAA, MAM and all undamped models, but not for damped ones (AAdN 9%, MAdN, AAdA, MAdM 0.05-0.5%). Designed:
# the same fitted model refitted with model = fit, use.initial.values = TRUE (no re-estimation) and nmse = 1..6, so
# that h * amse_h - (h - 1) * amse_{h-1} gives R's in-sample MSE for each horizon h separately.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch)
for (cs in list(list("uspop_AAdN", uspop, "AAN", TRUE), list("uspop_MAdN", uspop, "MAN", TRUE),
                list("usacc_AAdA", USAccDeaths, "AAA", TRUE), list("uspop_AAN", uspop, "AAN", FALSE))) {
  fit <- ets(cs[[2]], model = cs[[3]], damped = cs[[4]])
  am <- sapply(1:6, function(k) ets(cs[[2]], model = fit, use.initial.values = TRUE, nmse = k)$amse)
  out[[cs[[1]]]] <- list(x = as.numeric(cs[[2]]), par = unname(fit$par), par_names = names(fit$par), amse = am,
                         same_par = all.equal(fit$par, ets(cs[[2]], model = fit, use.initial.values = TRUE, nmse = 3)$par))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "null"))
