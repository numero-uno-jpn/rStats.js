# tsmeta120-stats2.R: stats' ar.burg, ar.ols's order selection, ar.mle and decompose's figure (1.20.0), second
# experiment. Candidates written for this experiment from the help page of ar (Brockwell and Davis 1991 (8.2.6),
# 1996 p. 145; Percival and Walden 1998):
#   ar.burg: x demeaned; forward f and backward b errors; reflection a_k = 2 sum f_t b_{t-1} / sum (f_t^2 + b_{t-1}^2)
#     over the usable t; coefficients by Levinson's update; var.method 1: v_k = v_{k-1} (1 - a_k^2), v_0 = sum(x^2)/n;
#     var.method 2: (sum f^2 + sum b^2) / (2 (n - k)); aic_k = n log v_k + 2 k; var.pred = v_p or v_p n / (n - (p+1));
#   ar.ols's aic: (A) each order k on its own rows (n - k): n_k log(RSS_k / n_k) + 2 k; (B) every order on the rows of
#     order.max: (n - pm) log(RSS_k / (n - pm)) + 2 k; (C) as (A) with n in front; (D) as (B) with n in front;
#   ar.mle: for each order the coefficients and sigma2 of arima(x, c(k, 0, 0), method = "ML") (tight); aic_k =
#     n log(sigma2_k) + 2 k or arima's aic; var.pred = sigma2 or sigma2 n / (n - (p + 1));
#   decompose: figure in the cycle order starting at the first observation's position.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)

burgC <- function(x, pm) {
  n <- length(x); x <- x - mean(x); f <- x; b <- x
  v1 <- numeric(pm + 1); v2 <- numeric(pm + 1); v1[1] <- v2[1] <- sum(x^2) / n
  phi <- numeric(0); pac <- numeric(pm); coefs <- list()
  for (k in 1:pm) {
    ft <- f[(k + 1):n]; bt <- b[k:(n - 1)]
    a <- 2 * sum(ft * bt) / sum(ft^2 + bt^2)
    phi <- c(phi - a * rev(phi), a); pac[k] <- a; coefs[[k]] <- phi
    fn <- ft - a * bt; bn <- bt - a * ft
    f[(k + 1):n] <- fn; b[(k + 1):n] <- bn
    v1[k + 1] <- v1[k] * (1 - a^2); v2[k + 1] <- (sum(fn^2) + sum(bn^2)) / (2 * (n - k))
  }
  list(v1 = v1, v2 = v2, pac = pac, coefs = coefs)
}
res <- list()
for (cs in list(list("lh", lh), list("lakehuron", LakeHuron), list("sunspot", sunspot.year),
                list("logair_diff", diff(log(AirPassengers))))) {
  xx <- as.numeric(cs[[2]]); n <- length(xx); pm <- min(n - 1, floor(10 * log10(n))); xm <- xx - mean(xx)
  bc <- burgC(xx, pm)
  bu <- list()
  for (vm in 1:2) {
    rb <- ar.burg(cs[[2]], var.method = vm)
    v <- if (vm == 1) bc$v1 else bc$v2
    aic <- n * log(v) + 2 * (0:pm); aic <- aic - min(aic); p <- which.min(aic) - 1
    bu[[vm]] <- list(order = rb$order, cand_order = p, d_aic = max(abs(as.numeric(rb$aic) - aic)),
                     d_pacf = max(abs(as.numeric(rb$partialacf) - bc$pac)),
                     d_ar = if (p) max(abs(as.numeric(rb$ar) - bc$coefs[[p]])) else 0,
                     var_pred = rb$var.pred, v_p = v[p + 1], v_p_adj = v[p + 1] * n / (n - (p + 1)))
  }
  ro <- ar.ols(cs[[2]])
  rssA <- sapply(0:pm, function(k) { if (k == 0) return(sum(xm^2)); Z <- embed(xm, k + 1)
    sum(lm.fit(cbind(1, Z[, -1, drop = FALSE]), Z[, 1])$residuals^2) })
  rssB <- sapply(0:pm, function(k) { Z <- embed(xm, pm + 1)
    if (k == 0) return(sum((Z[, 1] - mean(Z[, 1]))^2))
    sum(lm.fit(cbind(1, Z[, 2:(k + 1), drop = FALSE]), Z[, 1])$residuals^2) })
  nk <- n - (0:pm); nb <- n - pm
  cA <- nk * log(rssA / nk) + 2 * (0:pm); cB <- nb * log(rssB / nb) + 2 * (0:pm)
  cC <- n * log(rssA / nk) + 2 * (0:pm); cD <- n * log(rssB / nb) + 2 * (0:pm)
  rel <- function(a) max(abs(as.numeric(ro$aic) - (a - min(a))))
  ols <- list(order = ro$order, aic = as.numeric(ro$aic), dA = rel(cA), dB = rel(cB), dC = rel(cC), dD = rel(cD),
              orders = c(A = which.min(cA), B = which.min(cB), C = which.min(cC), D = which.min(cD)) - 1)
  rm <- ar.mle(cs[[2]]); pmm <- min(pm, 12)
  fits <- lapply(0:pmm, function(k) arima(xx, order = c(k, 0, 0), method = "ML",
                                          optim.control = list(reltol = 1e-15, maxit = 2000)))
  s2 <- sapply(fits, function(f) f$sigma2)
  a1 <- n * log(s2) + 2 * (0:pmm); a2 <- sapply(fits, function(f) f$aic)
  pr <- rm$order
  mle <- list(order = rm$order, aic = as.numeric(rm$aic), d_a1 = max(abs(as.numeric(rm$aic) - (a1 - min(a1)))),
              d_a2 = max(abs(as.numeric(rm$aic) - (a2 - min(a2)))), order_a1 = which.min(a1) - 1,
              order_a2 = which.min(a2) - 1,
              ar = as.numeric(rm$ar), ar_arima = if (pr) unname(coef(fits[[pr + 1]])[1:pr]) else numeric(0),
              x_mean = rm$x.mean, mean_arima = unname(coef(fits[[pr + 1]])[pr + 1]),
              var_pred = rm$var.pred, s2 = s2[pr + 1], s2_adj = s2[pr + 1] * n / (n - (pr + 1)))
  res[[cs[[1]]]] <- list(n = n, pm = pm, burg = bu, ols = ols, mle = mle)
}
out$ar <- res
dc <- list()
for (cs in list(list("air_apr", window(AirPassengers, start = c(1949, 4))), list("usacc_jul", window(USAccDeaths, start = c(1973, 7))))) {
  r <- decompose(cs[[2]]); f <- frequency(cs[[2]])
  det <- as.numeric(cs[[2]]) - as.numeric(r$trend); pos <- cycle(cs[[2]])
  fig <- sapply(1:f, function(k) mean(det[pos == k], na.rm = TRUE)); fig <- fig - mean(fig)
  s0 <- pos[1]; ord <- ((s0 - 1 + 0:(f - 1)) %% f) + 1
  dc[[cs[[1]]]] <- list(d_first = max(abs(r$figure - fig[ord])), d_calendar = max(abs(r$figure - fig)))
}
out$decompose <- dc
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
