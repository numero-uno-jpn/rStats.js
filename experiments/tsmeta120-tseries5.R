# tsmeta120-tseries5.R: tseries' terasvirta.test, third try (1.20.0, asked for by the user after experiments 8-9
# left it open). Re-reading experiment 8's numbers: the earlier candidates were all of the LM form m R^2, but for lh
# with lag 1, 48 log(SSR0 / SSR1) = 2.7955 is near R's 2.7958, and R's F reports the second df 45 = m - df. Note
# that with lag 1 the auxiliary span {1, x, x^2, x^3} does not change under scaling, so the auxiliary regression
# itself was probably right and the form of the statistic was not.
# Candidates (Terasvirta, Lin and Granger 1993; the likelihood-ratio and LM forms of the same comparison):
#   SSR0 from y on (1, X), SSR1 from y on (1, X, the second- and third-order products), m = n - lag rows, n = length;
#   Chisq in {m R^2, n R^2, m log(SSR0 / SSR1), n log(SSR0 / SSR1)}, R^2 = 1 - SSR1 / SSR0;
#   F = ((SSR0 - SSR1) / df) / (SSR1 / df2) with df2 in {m - df, m - df - lag - 1, n - df};
#   with and without the intercept, scaled or not (scale = TRUE / FALSE in R), lags 1, 2, 3.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(tseries))
out <- list(R = R.version.string, arch = R.version$arch, tseries = as.character(packageVersion("tseries")))
ssr <- function(X, y) sum(lm.fit(X, y)$residuals^2)
set.seed(20261126)
series <- list(lh = as.numeric(lh), lakehuron = as.numeric(LakeHuron), rw = cumsum(rnorm(200)), wn = rnorm(30),
               logair = as.numeric(log(AirPassengers)), sunspot = as.numeric(sunspot.year))
for (nm in names(series)) {
  y0 <- series[[nm]]; n <- length(y0); res <- list(n = n)
  for (lag in 1:3) for (sc in c(TRUE, FALSE)) {
    rC <- terasvirta.test(ts(y0), lag = lag, type = "Chisq", scale = sc)
    rF <- terasvirta.test(ts(y0), lag = lag, type = "F", scale = sc)
    ys <- if (sc) as.numeric(scale(y0)) else y0
    Z <- embed(ys, lag + 1); yy <- Z[, 1]; X <- Z[, -1, drop = FALSE]; m <- length(yy)
    prods <- NULL
    for (i in 1:lag) for (j in i:lag) prods <- cbind(prods, X[, i] * X[, j])
    for (i in 1:lag) for (j in i:lag) for (k in j:lag) prods <- cbind(prods, X[, i] * X[, j] * X[, k])
    df <- ncol(prods); cand <- list()
    for (ic in c(TRUE, FALSE)) {
      X0 <- if (ic) cbind(1, X) else X; X1 <- cbind(X0, prods)
      s0 <- ssr(X0, yy); s1 <- ssr(X1, yy); R2 <- 1 - s1 / s0
      cand[[paste0("ic_", ic)]] <- list(
        chisq = c(mR2 = m * R2, nR2 = n * R2, mlog = m * log(s0 / s1), nlog = n * log(s0 / s1)),
        F = c(m_df = ((s0 - s1) / df) / (s1 / (m - df)), m_df_k = ((s0 - s1) / df) / (s1 / (m - df - lag - 1)),
              n_df = ((s0 - s1) / df) / (s1 / (n - df))))
    }
    res[[paste0("lag", lag, "_", sc)]] <- list(chisq = unname(rC$statistic), chisq_df = unname(rC$parameter),
      p_chisq = rC$p.value, F = unname(rF$statistic), F_df = unname(rF$parameter), p_F = rF$p.value,
      m = m, df = df, cand = cand,
      # second run: the p-values of the forms found in the first run
      p_chisq_cand = pchisq(n * log(ssr(cbind(1, X), yy) / ssr(cbind(1, X, prods), yy)), df, lower.tail = FALSE),
      p_F_cand = pf(unname(rF$statistic), df, m - df, lower.tail = FALSE))
  }
  out[[nm]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
