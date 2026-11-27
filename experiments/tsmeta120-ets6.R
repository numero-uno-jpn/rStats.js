# tsmeta120-ets6.R: forecast's ets estimation and selection (1.20.0), sixth ets experiment. Candidates written for
# this experiment from the help page and Hyndman et al. (2008, ch. 5 and 7):
#   model = "ZZZ": every allowed model fitted with ets(y, model = X, damped = D) — errors A / M, trends N / A / Ad
#     (M / Md only with allow.multiplicative.trend), seasons N / A / M when m > 1 (multiplicative ones only for
#     positive data), additive errors with a multiplicative season left out (restrict) — and the smallest aicc chosen;
#   amse: the mean over h = 1..nmse of the in-sample h-step mean squared errors (forecasts from each time's states
#     along the zero-error path);
#   hw(seasonal = "multiplicative"): its model's components and parameters, beside ets(MAM);
#   ses / holt / hw with initial = "simple": alpha (beta, gamma) minimising the SSE with the simple initial states.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
sel <- list()
for (cs in list(list("nile", Nile), list("usacc", USAccDeaths), list("air", AirPassengers), list("uspop", uspop), list("co2", co2),
                list("lynx", lynx), list("uk", UKgas), list("wwwusage", WWWusage))) {
  y <- cs[[2]]; m <- frequency(y)
  r <- ets(y)
  errs <- c("A", "M"); trs <- list(c("N", FALSE), c("A", FALSE), c("A", TRUE)); seas <- if (m > 1) c("N", "A", "M") else "N"
  if (min(y) <= 0) { errs <- "A"; seas <- setdiff(seas, "M") }
  tab <- NULL
  for (e in errs) for (t in trs) for (s in seas) {
    if (e == "A" && s == "M") next
    f <- tryCatch(ets(y, model = paste0(e, t[1], s), damped = as.logical(t[2])), error = function(err) NULL)
    if (!is.null(f)) tab <- rbind(tab, data.frame(model = f$method, aicc = f$aicc, stringsAsFactors = FALSE))
  }
  sel[[cs[[1]]]] <- list(R = r$method, R_aicc = r$aicc, cand = tab$model[which.min(tab$aicc)], cand_aicc = min(tab$aicc),
                         table = tab, amse = r$amse, mse = r$mse)
}
out$selection <- sel

# amse
am <- list()
for (cs in list(list("nile_ANN", Nile, "ANN", FALSE), list("usacc_AAA", USAccDeaths, "AAA", FALSE), list("air_MAM", AirPassengers, "MAM", FALSE))) {
  fit <- ets(cs[[2]], model = cs[[3]], damped = cs[[4]]); y <- as.numeric(cs[[2]]); n <- length(y); m <- frequency(cs[[2]])
  st <- fit$states; cmp <- fit$components
  pathF <- function(row, h) {
    l <- st[row, "l"]; b <- if (cmp[2] != "N") st[row, "b"] else 0; s <- if (cmp[3] != "N") st[row, grep("^s", colnames(st))] else NULL
    sapply(1:h, function(k) { T <- l + k * b; if (cmp[3] == "N") T else { sk <- s[m - ((k - 1) %% m)]; if (cmp[3] == "A") T + sk else T * sk } })
  }
  E <- matrix(NA, n, 3)
  for (t in 0:(n - 1)) { f <- pathF(t + 1, 3); for (h in 1:3) if (t + h <= n) E[t + h, h] <- y[t + h] - f[h] }
  mseh <- colMeans(E^2, na.rm = TRUE)
  am[[cs[[1]]]] <- c(R_amse = fit$amse, cand = mean(mseh), R_mse = fit$mse, cand_mse1 = mseh[1])
}
out$amse <- am

# hw multiplicative and the simple initial values
f <- hw(AirPassengers, seasonal = "multiplicative"); e <- ets(AirPassengers, model = "MAM", damped = FALSE)
out$hw_mult <- list(method = f$model$method, components = f$model$components, par = f$model$par, loglik = f$model$loglik,
                    ets_par = e$par, ets_loglik = e$loglik)
fs <- ses(Nile, initial = "simple"); y <- as.numeric(Nile)
sseS <- function(a) { l <- y[1]; s <- 0; for (t in 2:length(y)) { s <- s + (y[t] - l)^2; l <- l + a * (y[t] - l) }; s }
out$ses_simple <- list(R_alpha = unname(fs$model$par["alpha"]), cand_alpha = optimize(sseS, c(0, 1), tol = 1e-12)$minimum,
                       R_sse = fs$model$SSE, cand_sse = sseS(unname(fs$model$par["alpha"])))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
