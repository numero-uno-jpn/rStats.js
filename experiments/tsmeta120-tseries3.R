# tsmeta120-tseries3.R: tseries' pp.test (third and last try), runs.test, terasvirta.test, white.test and po.test
# (1.20.0). Candidates written for this experiment from the help pages and the papers they cite:
#   pp.test, from Phillips and Perron (1988) with a trend: Z(alpha) = nn (rho - 1) - nn^6 / (24 Dx) (lambda2 - su2),
#     Z(t_alpha) = (su / lambda) t - (lambda2 - su2) nn^3 / (4 sqrt(3) sqrt(Dx) lambda), Dx = det(X'X) for
#     X = (1, t, y_{t-1}); su2 and lambda2 as in experiment 7 (over nn);
#   runs.test (Wald-Wolfowitz): R = number of runs, mean 1 + 2 n1 n2 / n, variance 2 n1 n2 (2 n1 n2 - n) /
#     (n^2 (n - 1)), stat = (R - mean) / sd, normal p-values;
#   terasvirta.test (Terasvirta, Lin and Granger 1993): y scaled (scale()), X = lags 1..lag; u = residuals of y on
#     (1, X); u on (1, X, the products x_i x_j (i <= j) and x_i x_j x_k (i <= j <= k)); Chisq = n (SSR0 - SSR1) /
#     SSR0 with df = number of products, F = ((SSR0 - SSR1) / df) / (SSR1 / (n - k - df - 1));
#   white.test (Lee, White and Granger 1993): after set.seed, weights runif in [-range/2, range/2] for (1, X) to q
#     hidden units, filled by rows or by columns; activation logistic or tanh; the principal components 2..qstar+1
#     (of the covariance or the correlation matrix) of the hidden units; Chisq = n R^2 of u on (1, X, components);
#   po.test: the Phillips-Perron Z(alpha) of the residuals of x1 on the other columns (with an intercept when
#     demean), lag trunc(n/100) (lshort) or trunc(n/30), regression u_t on u_{t-1} without a constant;
#     Z = (n - 1)(rho - 1) - (lambda2 - su2) / (2 sum(u_{t-1}^2) / (n - 1)^2) (statistic only).
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))

nwLam <- function(u, l, D) {
  nn <- length(u); s <- sum(u^2)
  for (k in seq_len(l)) s <- s + 2 * (1 - k / (l + 1)) * sum(u[(k + 1):nn] * u[1:(nn - k)])
  s / D
}
set.seed(20261126)
series <- list(lh = as.numeric(lh), lakehuron = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30),
               logair = as.numeric(log(AirPassengers)))
for (nm in names(series)) {
  y <- series[[nm]]; n <- length(y); res <- list(n = n)
  for (lsh in c(TRUE, FALSE)) {
    yt <- y[-1]; yl <- y[-n]; nn <- n - 1; tt <- 1:nn
    X <- cbind(1, tt, yl); f <- lm.fit(X, yt); u <- f$residuals
    rho <- f$coefficients[3]; s2 <- sum(u^2) / (nn - 3)
    seb <- sqrt(s2 * solve(crossprod(X))[3, 3]); tr <- (rho - 1) / seb
    l <- if (lsh) trunc(4 * (nn / 100)^0.25) else trunc(12 * (nn / 100)^0.25)
    su2 <- sum(u^2) / nn; l2 <- nwLam(u, l, nn); Dx <- det(crossprod(X))
    za <- nn * (rho - 1) - nn^6 / (24 * Dx) * (l2 - su2)
    zt <- sqrt(su2 / l2) * tr - (l2 - su2) * nn^3 / (4 * sqrt(3) * sqrt(Dx) * sqrt(l2))
    rza <- unname(suppressWarnings(pp.test(y, type = "Z(alpha)", lshort = lsh))$statistic)
    rzt <- unname(suppressWarnings(pp.test(y, type = "Z(t_alpha)", lshort = lsh))$statistic)
    res[[paste0("pp_", lsh)]] <- list(za = rza, zt = rzt, cand_za = unname(za), cand_zt = unname(zt),
                                      d_za = rza - unname(za), d_zt = rzt - unname(zt))
  }
  # runs.test on the signs about the median
  fx <- factor(y > median(y))
  for (alt in c("two.sided", "less", "greater")) {
    r <- runs.test(fx, alternative = alt)
    b <- as.integer(fx); R <- 1 + sum(diff(b) != 0); n1 <- sum(b == 1); n2 <- sum(b == 2); m <- length(b)
    mu <- 1 + 2 * n1 * n2 / m; v <- 2 * n1 * n2 * (2 * n1 * n2 - m) / (m^2 * (m - 1)); z <- (R - mu) / sqrt(v)
    pc <- switch(alt, two.sided = 2 * pnorm(-abs(z)), less = pnorm(z), greater = pnorm(z, lower.tail = FALSE))
    res[[paste0("runs_", alt)]] <- list(stat = unname(r$statistic), p = r$p.value, cand = z, cand_p = pc)
  }
  # terasvirta.test
  for (lag in 1:2) for (ty in c("Chisq", "F")) {
    r <- terasvirta.test(ts(y), lag = lag, type = ty)
    ys <- as.numeric(scale(y)); Z <- embed(ys, lag + 1); yy <- Z[, 1]; X <- Z[, -1, drop = FALSE]
    u0 <- lm.fit(cbind(1, X), yy)$residuals
    prods <- NULL
    for (i in 1:lag) for (j in i:lag) prods <- cbind(prods, X[, i] * X[, j])
    for (i in 1:lag) for (j in i:lag) for (k in j:lag) prods <- cbind(prods, X[, i] * X[, j] * X[, k])
    u1 <- lm.fit(cbind(1, X, prods), u0)$residuals
    ssr0 <- sum(u0^2); ssr1 <- sum(u1^2); m <- length(yy); df <- ncol(prods)
    cand <- if (ty == "Chisq") m * (ssr0 - ssr1) / ssr0 else ((ssr0 - ssr1) / df) / (ssr1 / (m - lag - df - 1))
    res[[paste0("tera_", lag, "_", ty)]] <- list(stat = unname(r$statistic), df = r$parameter, p = r$p.value,
                                                 cand = cand, cand_df = df)
  }
  # white.test, lag 1, defaults
  set.seed(1); r <- white.test(ts(y))
  ys <- as.numeric(scale(y)); Z <- embed(ys, 2); yy <- Z[, 1]; X <- Z[, -1, drop = FALSE]; m <- length(yy)
  u0 <- lm.fit(cbind(1, X), yy)$residuals
  wc <- list()
  for (fill in c("rows", "cols")) for (act in c("logistic", "tanh")) for (pcm in c("cov", "cor")) {
    set.seed(1)
    w <- runif(2 * 10, -2, 2)
    W <- if (fill == "rows") matrix(w, 2, 10, byrow = TRUE) else matrix(w, 2, 10)
    H <- cbind(1, X) %*% W
    H <- if (act == "logistic") 1 / (1 + exp(-H)) else tanh(H)
    pc <- prcomp(H, scale. = pcm == "cor")$x[, 2:3]
    u1 <- lm.fit(cbind(1, X, pc), u0)$residuals
    wc[[paste(fill, act, pcm, sep = "_")]] <- m * (1 - sum(u1^2) / sum(u0^2))
  }
  res$white <- list(stat = unname(r$statistic), df = r$parameter, p = r$p.value, cand = wc)
  out[[nm]] <- res
}
# po.test on two cointegrated series and on two independent random walks
set.seed(20261127)
x2 <- cumsum(rnorm(300)); x1 <- 0.5 + 2 * x2 + arima.sim(list(ar = 0.6), 300); x3 <- cumsum(rnorm(300))
for (cs in list(list(name = "coint", M = cbind(x1, x2)), list(name = "indep", M = cbind(x3, x2)),
                list(name = "three", M = cbind(x1, x2, x3)))) {
  for (dm in c(TRUE, FALSE)) for (lsh in c(TRUE, FALSE)) {
    r <- suppressWarnings(po.test(cs$M, demean = dm, lshort = lsh))
    M <- cs$M; nobs <- nrow(M)
    u <- if (dm) lm.fit(cbind(1, M[, -1]), M[, 1])$residuals else lm.fit(M[, -1, drop = FALSE], M[, 1])$residuals
    ut <- u[-1]; ul <- u[-nobs]; nn <- nobs - 1
    rho <- sum(ut * ul) / sum(ul^2); e <- ut - rho * ul
    l <- if (lsh) trunc(nobs / 100) else trunc(nobs / 30)
    su2 <- sum(e^2) / nn; l2 <- nwLam(e, l, nn)
    z <- nn * (rho - 1) - (l2 - su2) / (2 * sum(ul^2) / nn^2)
    out[[paste0("po_", cs$name, "_", dm, "_", lsh)]] <- list(stat = unname(r$statistic), lag = unname(r$parameter),
      p = r$p.value, cand = z, cand_lag = l)
  }
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
