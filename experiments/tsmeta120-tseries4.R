# tsmeta120-tseries4.R: tseries' terasvirta.test, white.test and po.test, second experiment (1.20.0). Grids of
# variants of the candidates of experiment 8 (same papers):
#   terasvirta.test: the null regression with or without an intercept; the auxiliary regression of u0 (or of y) on
#     (1?, X, products) with or without an intercept; m = n - lag or n;
#   white.test: the hidden units' inputs (1, X) or X only with a separate bias; weights runif over [-range/2, range/2]
#     or [-range, range]; activation logistic or tanh; principal components 2..3 of prcomp with or without
#     scaling; the auxiliary regression on (1, X, components);
#   po.test: lag from n - 1; the denominators of su2, lambda2 and sum(u_{t-1}^2) over nn or n.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))
ssr <- function(X, y) sum(lm.fit(X, y)$residuals^2)
nwSum <- function(u, l) {
  nn <- length(u); s <- sum(u^2)
  for (k in seq_len(l)) s <- s + 2 * (1 - k / (l + 1)) * sum(u[(k + 1):nn] * u[1:(nn - k)])
  s
}
set.seed(20261126)
series <- list(lh = as.numeric(lh), lakehuron = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30))
for (nm in names(series)) {
  y <- series[[nm]]; res <- list()
  for (lag in 1:2) {
    r <- terasvirta.test(ts(y), lag = lag)
    ys <- as.numeric(scale(y)); Z <- embed(ys, lag + 1); yy <- Z[, 1]; X <- Z[, -1, drop = FALSE]; m <- length(yy)
    prods <- NULL
    for (i in 1:lag) for (j in i:lag) prods <- cbind(prods, X[, i] * X[, j])
    for (i in 1:lag) for (j in i:lag) for (k in j:lag) prods <- cbind(prods, X[, i] * X[, j] * X[, k])
    v <- list()
    for (c0 in c(TRUE, FALSE)) for (c1 in c(TRUE, FALSE)) for (resp in c("u0", "y")) {
      X0 <- if (c0) cbind(1, X) else X
      u0 <- lm.fit(X0, yy)$residuals
      X1 <- if (c1) cbind(1, X, prods) else cbind(X, prods)
      target <- if (resp == "u0") u0 else yy
      s0 <- sum(u0^2); s1 <- ssr(X1, target)
      v[[paste(c0, c1, resp, sep = "_")]] <- c(m = m * (s0 - s1) / s0, n = length(y) * (s0 - s1) / s0)
    }
    res[[paste0("tera_", lag)]] <- list(stat = unname(r$statistic), cand = v)
  }
  set.seed(1); r <- white.test(ts(y))
  ys <- as.numeric(scale(y)); Z <- embed(ys, 2); yy <- Z[, 1]; X <- Z[, -1, drop = FALSE]; m <- length(yy)
  u0 <- lm.fit(cbind(1, X), yy)$residuals
  v <- list()
  for (inp in c("bias_in", "bias_sep")) for (rg in c(2, 4)) for (fill in c("rows", "cols"))
    for (act in c("logistic", "tanh")) for (sc in c(FALSE, TRUE)) {
      set.seed(1)
      w <- runif(2 * 10, -rg, rg)
      W <- if (fill == "rows") matrix(w, 2, 10, byrow = TRUE) else matrix(w, 2, 10)
      H <- if (inp == "bias_in") cbind(1, X) %*% W else sweep(X %*% W[2, , drop = FALSE], 2, W[1, ], "+")
      H <- if (act == "logistic") 1 / (1 + exp(-H)) else tanh(H)
      pc <- prcomp(H, scale. = sc)$x[, 2:3]
      v[[paste(inp, rg, fill, act, sc, sep = "_")]] <- m * (1 - ssr(cbind(1, X, pc), u0) / sum(u0^2))
    }
  res$white <- list(stat = unname(r$statistic), cand = v)
  out[[nm]] <- res
}
set.seed(20261127)
x2 <- cumsum(rnorm(300)); x1 <- 0.5 + 2 * x2 + arima.sim(list(ar = 0.6), 300); x3 <- cumsum(rnorm(300))
for (cs in list(list(name = "coint", M = cbind(x1, x2)), list(name = "indep", M = cbind(x3, x2)))) {
  for (dm in c(TRUE, FALSE)) for (lsh in c(TRUE, FALSE)) {
    r <- suppressWarnings(po.test(cs$M, demean = dm, lshort = lsh))
    M <- cs$M; nobs <- nrow(M)
    u <- if (dm) lm.fit(cbind(1, M[, -1]), M[, 1])$residuals else lm.fit(M[, -1, drop = FALSE], M[, 1])$residuals
    ut <- u[-1]; ul <- u[-nobs]; nn <- nobs - 1
    rho <- sum(ut * ul) / sum(ul^2); e <- ut - rho * ul
    l <- if (lsh) trunc(nn / 100) else trunc(nn / 30)
    v <- list()
    for (Da in c("nn", "n")) for (Db in c("nn", "n")) for (lead in c("nn", "n")) {
      dv <- function(D) if (D == "nn") nn else nobs
      su2 <- sum(e^2) / dv(Da); l2 <- nwSum(e, l) / dv(Da)
      v[[paste(Da, Db, lead, sep = "_")]] <- dv(lead) * (rho - 1) - (l2 - su2) / (2 * sum(ul^2) / dv(Db)^2)
    }
    out[[paste0("po_", cs$name, "_", dm, "_", lsh)]] <- list(stat = unname(r$statistic), lag = unname(r$parameter),
                                                              cand_lag = l, cand = v)
  }
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
