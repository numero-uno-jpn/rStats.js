# tsmeta120-stl.R: stats' stl (1.20.0), first experiment. A candidate STL written for this experiment from Cleveland,
# Cleveland, McRae and Terpenning (1990, Journal of Official Statistics 6, 3-73) and the help page:
#   loess at x with q neighbours on 1..n: the window of q consecutive points nearest x (shifted inside at the ends),
#     h = max(x - left, right - x); when q > n, h is widened (variant H1: h + (q - n) / 2; H2: h q / n);
#     tricube weights (1 - (r/h)^3)^3 times the robustness weights; variant T1 with Cleveland's lowess thresholds
#     (weight 1 for r <= 0.001 h, 0 for r > 0.999 h), T0 without; degree 1 by the lowess update of the weights
#     (w_j (1 + (x - a)(x_j - a) / c) when sqrt(c) > 0.001 (range of the window)), a weighted mean for degree 0;
#     jumps: evaluated at 1, 1 + jump, ... and n, linearly interpolated between;
#   inner loop: (1) detrend; (2) each cycle-subseries smoothed with (s.window, s.degree), evaluated at 0..k+1 (one
#     extra point at each end); (3) low-pass: moving averages of lengths np, np, 3, then loess (l.window, l.degree);
#     (4) seasonal = (2) - (3); (5) deseasonalise; (6) trend by loess (t.window, t.degree);
#   outer loop: remainder R = Y - S - T, h = 6 median |R|, bisquare robustness weights (1 - (|R|/h)^2)^2 (variant B1
#     with the lowess thresholds 0.001 / 0.999 on |R| / h);
#   s.window = "periodic": s.window = 10 n + 1, s.degree = 0, and afterwards (variant P1) the seasonal replaced by
#     its mean for each cycle position, or (P0) left as is.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
nextodd <- function(x) { x <- round(x); if (x %% 2 == 0) x + 1 else x }

loessAt <- function(y, rw, xs, q, deg, hv, tv) {
  n <- length(y)
  sapply(xs, function(x) {
    qq <- min(q, n)
    left <- max(1, min(round(x) - (qq - 1) %/% 2, n - qq + 1)); right <- left + qq - 1
    if (x < 1) { left <- 1; right <- qq } else if (x > n) { left <- n - qq + 1; right <- n }
    h <- max(x - left, right - x)
    if (q > n) h <- if (hv == "H1") h + (q - n) %/% 2 else h * q / n
    j <- left:right; r <- abs(j - x)
    w <- ifelse(r < h, (1 - (r / h)^3)^3, 0)
    if (tv == "T1") { w[r <= 0.001 * h] <- 1; w[r > 0.999 * h] <- 0 }
    w <- w * rw[j]
    if (sum(w) <= 0) return(NA)
    w <- w / sum(w)
    if (deg == 1) {
      a <- sum(w * j); cc <- sum(w * (j - a)^2)
      if (sqrt(cc) > 0.001 * (n - 1)) w <- w * (1 + (x - a) * (j - a) / cc)
    }
    sum(w * y[j])
  })
}
smoothJump <- function(y, rw, q, deg, jump, hv, tv) {
  n <- length(y)
  if (n <= 2) return(y)
  at <- unique(c(seq(1, n, by = jump), n))
  v <- loessAt(y, rw, at, q, deg, hv, tv)
  if (jump == 1) return(v)
  approx(at, v, 1:n)$y
}
movAvg <- function(x, len) as.numeric(stats::filter(x, rep(1 / len, len), sides = 1))[len:length(x)]
stlC <- function(x, s.window, s.degree = 0, t.window = NULL, t.degree = 1, l.window = NULL, l.degree = t.degree,
                 isRobust = FALSE, inner = if (isRobust) 1 else 2, outer = if (isRobust) 15 else 0,
                 hv = "H1", tv = "T1", bv = "B1", pv = "P1", jumps = TRUE) {
  y <- as.numeric(x); n <- length(y); np <- frequency(x)
  periodic <- is.character(s.window)
  if (periodic) { s.window <- 10 * n + 1; s.degree <- 0 }
  if (is.null(l.window)) l.window <- nextodd(np)
  if (is.null(t.window)) t.window <- nextodd(ceiling(1.5 * np / (1 - 1.5 / s.window)))
  sj <- if (jumps) max(1, ceiling(s.window / 10)) else 1
  tj <- if (jumps) max(1, ceiling(t.window / 10)) else 1
  lj <- if (jumps) max(1, ceiling(l.window / 10)) else 1
  trend <- numeric(n); rw <- rep(1, n); season <- numeric(n)
  for (o in 0:outer) {
    for (it in 1:inner) {
      d <- y - trend
      C <- numeric(n + 2 * np)
      for (p in 1:np) {
        idx <- seq(p, n, by = np); k <- length(idx)
        sm <- loessAt(d[idx], rw[idx], 0:(k + 1), s.window, s.degree, hv, tv)
        if (sj > 1) {
          at <- unique(c(seq(1, k, by = sj), k)); v <- loessAt(d[idx], rw[idx], at, s.window, s.degree, hv, tv)
          sm <- c(loessAt(d[idx], rw[idx], 0, s.window, s.degree, hv, tv), approx(at, v, 1:k)$y,
                  loessAt(d[idx], rw[idx], k + 1, s.window, s.degree, hv, tv))
        }
        C[p + np * (0:(k + 1))] <- sm
      }
      L <- movAvg(movAvg(movAvg(C, np), np), 3)
      L <- smoothJump(L, rep(1, n), l.window, l.degree, lj, hv, tv)
      season <- C[np + 1:n] - L
      trend <- smoothJump(y - season, rw, t.window, t.degree, tj, hv, tv)
    }
    if (o < outer) {
      R <- y - season - trend; h <- 6 * median(abs(R)); u <- abs(R) / h
      rw <- ifelse(u < 1, (1 - u^2)^2, 0)
      if (bv == "B1") { rw[u <= 0.001] <- 1; rw[u > 0.999] <- 0 }
    }
  }
  if (periodic && pv == "P1") {
    cyc <- (seq_len(n) - 1) %% np + 1
    season <- ave(season, cyc)
  }
  list(seasonal = season, trend = trend, remainder = y - season - trend, weights = rw)
}

cases <- list(
  list("co2_periodic", co2, "periodic", FALSE), list("co2_s7", co2, 7, FALSE), list("co2_s35", co2, 35, FALSE),
  list("nottem_s9_robust", nottem, 9, TRUE), list("usacc_periodic_robust", USAccDeaths, "periodic", TRUE),
  list("usacc_s13", USAccDeaths, 13, FALSE), list("quarterly_s7", ts(as.numeric(UKgas), frequency = 4), 7, FALSE)
)
for (cs in cases) {
  r <- stl(cs[[2]], s.window = cs[[3]], robust = cs[[4]])
  rS <- as.numeric(r$time.series[, 1]); rT <- as.numeric(r$time.series[, 2])   # columns seasonal, trend
  res <- list(win = r$win, deg = r$deg, jump = r$jump, ni = r$ni, no = r$no)
  for (hv in c("H1", "H2")) for (tv in c("T1", "T0")) for (pv in c("P1", "P0")) {
    if (pv == "P0" && !is.character(cs[[3]])) next
    cnd <- stlC(cs[[2]], cs[[3]], isRobust = cs[[4]], hv = hv, tv = tv, pv = pv)
    res[[paste(hv, tv, pv, sep = "_")]] <- c(seasonal = max(abs(rS - cnd$seasonal)), trend = max(abs(rT - cnd$trend)),
                                             weights = max(abs(r$weights - cnd$weights)))
  }
  out[[cs[[1]]]] <- res
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
