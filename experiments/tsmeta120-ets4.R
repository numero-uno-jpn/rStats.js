# tsmeta120-ets4.R: forecast.ets for class 3 models (MNM, MAM, MAdM), fourth ets experiment (1.20.0). tsmeta120-ets3
# showed R's point forecasts equal to mu~_h s_h for h <= m and, for MNM, multiplied by exactly (1 + alpha gamma
# sigma2)^k beyond (k = floor((h - 1)/m)): the expectation of the level error times the seasonal update (1 + gamma e)
# of the same time. A candidate for the exact first and second moments, derived for this experiment from the model
# of Hyndman et al. (2008, table 2.3): y_{n+h} = T_{n+h} s* (1 + e_{n+h}) prod_i (1 + gamma e_{t_i}), where s* is the
# last observed seasonal state for that position and t_i = n + h - i m (i = 1..k) the times of its updates. The
# trend states x = (l, b) follow x_{t+1} = (A + B e_t) x_t with T = c'x, c = (1, phi) (or (1) without a trend),
#   A: l' = c'x, b' = phi b; B: l' = alpha c'x, b' = beta c'x.
# With w = prod (1 + gamma e_{t_i}), M1 = E[w x] and M2 = E[w^2 x x'] propagate exactly:
#   ordinary step: M1' = A M1, M2' = A M2 A' + sigma2 B M2 B';
#   paired step:   M1' = (A + gamma sigma2 B) M1,
#                  M2' = (1 + gamma^2 sigma2) A M2 A' + 2 gamma sigma2 (A M2 B' + B M2 A') + sigma2 (1 + 3 gamma^2 sigma2) B M2 B';
# E[y] = s* c'M1, E[y^2] = s*^2 (1 + sigma2) c'M2 c, var = E[y^2] - E[y]^2 (M1, M2 at time n + h - 1 after the
# step into n + h - 1, the last step taken without pairing at h... see the code).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(forecast))
out <- list(R = R.version.string, arch = R.version$arch, forecast = as.character(packageVersion("forecast")))
pars <- function(fit, nm, d) if (nm %in% names(fit$par)) unname(fit$par[nm]) else d
moments <- function(fit, h, d2 = FALSE) {
  m <- frequency(fit$x); cmp <- fit$components; trend <- cmp[2] != "N"; damped <- cmp[4] == "TRUE"
  al <- pars(fit, "alpha", 0); be <- pars(fit, "beta", 0); ga <- pars(fit, "gamma", 0); ph <- if (damped) pars(fit, "phi", 1) else 1
  s2 <- fit$sigma2; st <- fit$states[nrow(fit$states), ]
  x0 <- if (trend) c(unname(st["l"]), unname(st["b"])) else unname(st["l"])
  sv <- unname(st[grep("^s", names(st))])
  # third run (log item 37): variant d2, the damping applied after the trend (T = l + b, b' = phi b), so that
  # T_{n+h} = l + (1 + phi + ... + phi^{h-1}) b
  cv <- if (trend) (if (d2) c(1, 1) else c(1, ph)) else 1
  A <- if (trend) rbind(cv, c(0, ph)) else matrix(1)
  B <- if (trend) rbind(al * cv, be * cv) else matrix(al)
  res <- t(sapply(1:h, function(hh) {
    k <- floor((hh - 1) / m); paired <- hh - (1:k) * m; if (k == 0) paired <- integer(0)
    M1 <- x0; M2 <- tcrossprod(x0)
    # steps for the errors e_{n+1} .. e_{n+hh-1}: step j uses e_{n+j}
    for (j in seq_len(hh - 1)) {
      if (j %in% paired) {
        M1 <- (A + ga * s2 * B) %*% M1
        M2 <- (1 + ga^2 * s2) * A %*% M2 %*% t(A) + 2 * ga * s2 * (A %*% M2 %*% t(B) + B %*% M2 %*% t(A)) +
              s2 * (1 + 3 * ga^2 * s2) * B %*% M2 %*% t(B)
      } else { M1 <- A %*% M1; M2 <- A %*% M2 %*% t(A) + s2 * B %*% M2 %*% t(B) }
    }
    sstar <- sv[m - ((hh - 1) %% m)]
    Ey <- sstar * sum(cv * M1); Ey2 <- sstar^2 * (1 + s2) * drop(t(cv) %*% M2 %*% cv)
    c(mean = Ey, var = Ey2 - Ey^2)
  }))
  res
}
for (cs in list(list("MNM", AirPassengers, "MNM", FALSE), list("MAM", AirPassengers, "MAM", FALSE),
                list("MAdM", AirPassengers, "MAM", TRUE), list("MNM_usacc", USAccDeaths, "MNM", FALSE),
                list("MAM_co2", co2, "MAM", FALSE))) {
  fit <- ets(cs[[2]], model = cs[[3]], damped = cs[[4]]); h <- 36
  fc <- forecast(fit, h = h, level = 95)
  mo <- moments(fit, h); half <- (as.numeric(fc$upper) - as.numeric(fc$mean)) / qnorm(0.975)
  out[[cs[[1]]]] <- list(d_mean = max(abs(as.numeric(fc$mean) / mo[, "mean"] - 1)), d_sd = max(abs(half / sqrt(mo[, "var"]) - 1)),
                         ratio_sd = half / sqrt(mo[, "var"]), ratio_mean = as.numeric(fc$mean) / mo[, "mean"],
                         par = fit$par, par_names = names(fit$par),   # second run: per-h ratios and the parameters
                         d2 = { m2 <- moments(fit, h, TRUE); c(mean = max(abs(as.numeric(fc$mean) / m2[, "mean"] - 1)),
                                sd = max(abs(half / sqrt(m2[, "var"]) - 1))) })
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
