# tsmeta120-supsmu.R: stats' supsmu (1.20.0, needed by forecast's mstl for non-seasonal series and by tsoutliers),
# first experiment. A candidate written for this experiment from Friedman (1984, "A Variable Span Scatterplot
# Smoother", LCS Technical Report 5) and the help page:
#   running lines smoother with span s: a window of 2 k + 1 consecutive points (k = half-width) centred on each point,
#     kept inside the data at the ends (shifted, same size), weighted least-squares line through the window; window
#     sums updated as the window slides; variants for k: K1 floor(s n / 2 + 0.5) (at least 2), K2 floor(s n / 2),
#     K3 ceiling(s n / 2); ends: E1 the window shrinks (one-sided, symmetric k until the edge) vs E2 kept at 2k + 1;
#   cross-validated residuals |y_i - s_i| / (1 - h_ii), h_ii = 1/m + (x_i - xbar)^2 / Sxx in the window (m points);
#   supsmu: the tweeter, midrange and woofer spans 0.05, 0.2, 0.5; each residual series smoothed with the midrange
#     span; at each point the span with the smallest smoothed residual; bass alpha: span + (0.5 - span)
#     (r_min / r_woofer)^(10 - alpha) when r_min < r_woofer; the chosen spans smoothed with the midrange span and
#     clamped to [0.05, 0.5]; the fit interpolated linearly in span between the neighbouring smooths; that smoothed
#     once more with the tweeter span; a fixed span: one running lines smooth.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
runLine <- function(x, y, s, kv, ev, cv = FALSE) {
  n <- length(x); k <- switch(kv, K1 = max(2, floor(s * n / 2 + 0.5)), K2 = max(2, floor(s * n / 2)), K3 = max(2, ceiling(s * n / 2)))
  k <- min(k, floor((n - 1) / 2))
  fit <- res <- numeric(n)
  for (i in 1:n) {
    if (ev == "E2") { lo <- max(1, min(i - k, n - 2 * k)); hi <- lo + 2 * k } else { lo <- max(1, i - k); hi <- min(n, i + k) }
    j <- lo:hi; xm <- mean(x[j]); ym <- mean(y[j]); sxx <- sum((x[j] - xm)^2); sxy <- sum((x[j] - xm) * (y[j] - ym))
    b <- if (sxx > (1e-3 * (x[n] - x[1]))^2) sxy / sxx else 0
    fit[i] <- ym + b * (x[i] - xm)
    if (cv) { h <- 1 / length(j) + (if (sxx > (1e-3 * (x[n] - x[1]))^2) (x[i] - xm)^2 / sxx else 0); res[i] <- abs(y[i] - fit[i]) / (1 - h) }
  }
  list(fit = fit, res = res)
}
supsmuC <- function(x, y, kv, ev, bass = 0, span = "cv") {
  o <- order(x); x <- x[o]; y <- y[o]
  if (is.numeric(span)) return(runLine(x, y, span, kv, ev)$fit)
  sp <- c(0.05, 0.2, 0.5)
  fits <- lapply(sp, function(s) runLine(x, y, s, kv, ev, TRUE))
  rs <- sapply(fits, function(f) runLine(x, f$res, 0.2, kv, ev)$fit)
  best <- sp[apply(rs, 1, which.min)]
  if (bass > 0) { rmin <- apply(rs, 1, min); w <- rs[, 3]; sel <- rmin < w & rmin > 0
    best[sel] <- best[sel] + (0.5 - best[sel]) * pmax(1e-7, rmin[sel] / w[sel])^(10 - bass) }
  bs <- pmin(0.5, pmax(0.05, runLine(x, best, 0.2, kv, ev)$fit))
  f1 <- fits[[1]]$fit; f2 <- fits[[2]]$fit; f3 <- fits[[3]]$fit
  mix <- ifelse(bs >= 0.2, { f <- (bs - 0.2) / 0.3; (1 - f) * f2 + f * f3 }, { f <- (0.2 - bs) / 0.15; (1 - f) * f2 + f * f1 })
  runLine(x, mix, 0.05, kv, ev)$fit
}
set.seed(21)
cases <- list(nile = list(seq_along(Nile), as.numeric(Nile)), sinx = { x <- sort(runif(150, 0, 10)); list(x, sin(x) + rnorm(150, sd = 0.3)) },
              lin = list(1:60, 2 + 0.5 * (1:60) + rnorm(60)), big = { x <- 1:400; list(x, cumsum(rnorm(400))) })
for (nm in names(cases)) {
  x <- cases[[nm]][[1]]; y <- cases[[nm]][[2]]
  r <- supsmu(x, y)$y; rb <- supsmu(x, y, bass = 5)$y; rf <- supsmu(x, y, span = 0.3)$y
  v <- list()
  for (kv in c("K1", "K2", "K3")) for (ev in c("E1", "E2"))
    v[[paste(kv, ev)]] <- c(cv = max(abs(r - supsmuC(x, y, kv, ev))), bass = max(abs(rb - supsmuC(x, y, kv, ev, 5))),
                            fixed = max(abs(rf - supsmuC(x, y, kv, ev, span = 0.3))))
  out[[nm]] <- list(n = length(x), variants = v, scale = diff(range(y)))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
