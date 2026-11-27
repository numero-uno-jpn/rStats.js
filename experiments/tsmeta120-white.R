# tsmeta120-white.R: tseries' white.test, third try (1.20.0, asked for by the user after experiments 8-9 left it
# open). Experiment 14 found that terasvirta.test (same package, same author) uses n log(SSR0 / SSR1) with n the
# series length, not the LM form m R^2 that experiments 8-9 assumed for both tests. So here the form of the statistic
# is crossed with the construction of the phantom hidden units (Lee, White and Granger 1993; the help page):
#   inputs X = lags 1..lag of the scaled series, y = the scaled series; after set.seed(s), weights from runif;
#   weights: count (lag + 1) q (bias inside, filled by rows or columns of a (lag + 1) x q matrix) or a separate
#     bias row; range: U(-range/2, range/2) (help page) or U(-range, range);
#   activation: logistic or tanh; the principal components 2..qstar+1 of the hidden units (prcomp centred, scaled or
#     not);
#   statistic: Chisq in {m R^2, n R^2, m log(SSR0 / SSR1), n log(SSR0 / SSR1)} with SSR0 of y on (1, X) and SSR1 of
#     y on (1, X, components); F = ((SSR0 - SSR1) / qstar) / (SSR1 / (m - qstar)) or / (m - qstar - lag - 1).
# Several seeds, lags 1 and 2, (q, qstar) = (10, 2) and (6, 3), to tell the variants apart.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))
ssr <- function(X, y) sum(lm.fit(X, y)$residuals^2)
set.seed(20261126)
series <- list(lh = as.numeric(lh), lakehuron = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30))
settings <- list(c(lag = 1, q = 10, qstar = 2, seed = 1), c(lag = 1, q = 10, qstar = 2, seed = 7),
                 c(lag = 2, q = 10, qstar = 2, seed = 1), c(lag = 1, q = 6, qstar = 3, seed = 3))
for (nm in names(series)) {
  y0 <- series[[nm]]; n <- length(y0)
  for (st in settings) {
    lag <- st[["lag"]]; q <- st[["q"]]; qs <- st[["qstar"]]; sd <- st[["seed"]]
    set.seed(sd); rC <- white.test(ts(y0), lag = lag, q = q, qstar = qs, type = "Chisq")
    set.seed(sd); rF <- white.test(ts(y0), lag = lag, q = q, qstar = qs, type = "F")
    ys <- as.numeric(scale(y0)); Z <- embed(ys, lag + 1); yy <- Z[, 1]; X <- Z[, -1, drop = FALSE]; m <- length(yy)
    s0 <- ssr(cbind(1, X), yy); k <- lag + 1
    cand <- list()
    for (rg in c("half", "full")) for (lay in c("in_rows", "in_cols", "sep_first", "sep_last"))
      for (act in c("logistic", "tanh")) for (pcs in c(FALSE, TRUE)) {
        set.seed(sd)
        lim <- if (rg == "half") 2 else 4
        w <- runif(k * q, -lim, lim)
        W <- switch(lay,
          in_rows = matrix(w, k, q, byrow = TRUE),
          in_cols = matrix(w, k, q),
          sep_first = rbind(w[1:q], matrix(w[-(1:q)], lag, q)),
          sep_last = rbind(w[lag * q + 1:q], matrix(w[1:(lag * q)], lag, q)))
        H <- cbind(1, X) %*% W
        H <- if (act == "logistic") 1 / (1 + exp(-H)) else tanh(H)
        pc <- prcomp(H, scale. = pcs)$x[, 2:(qs + 1), drop = FALSE]
        s1 <- ssr(cbind(1, X, pc), yy); R2 <- 1 - s1 / s0
        cand[[paste(rg, lay, act, pcs, sep = "_")]] <- c(mR2 = m * R2, nR2 = n * R2, mlog = m * log(s0 / s1),
          nlog = n * log(s0 / s1), F1 = ((s0 - s1) / qs) / (s1 / (m - qs)), F2 = ((s0 - s1) / qs) / (s1 / (m - qs - k)))
      }
    out[[paste(nm, lag, q, qs, sd, sep = "_")]] <- list(chisq = unname(rC$statistic), F = unname(rF$statistic),
      df_chisq = unname(rC$parameter), df_F = unname(rF$parameter), p_chisq = rC$p.value, p_F = rF$p.value, m = m,
      cand = cand,
      # second run: the p-values of the variant found in the first run (chi-squared(qstar), F(qstar, m - qstar))
      p_chisq_cand = pchisq(unname(rC$statistic), qs, lower.tail = FALSE),
      p_F_cand = pf(unname(rF$statistic), qs, m - qs, lower.tail = FALSE))
  }
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
