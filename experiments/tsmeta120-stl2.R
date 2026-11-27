# tsmeta120-stl2.R: stats' stl, second experiment (1.20.0). The candidate of tsmeta120-stl.R (variants H1, T1, B1, P1
# found there) with two variants for the one failing case, s.window = "periodic" with robust = TRUE: V1 the robustness
# weights left out of the cycle-subseries smoothing, V2 the cycle means taken in every inner iteration (instead of
# only at the end). Also more arguments: s.degree = 1, t.degree = 0, l.window, the jumps, inner / outer, a short series.
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
                 hv = "H1", tv = "T1", bv = "B1", pv = "P1", jumps = TRUE, v1 = FALSE, v2 = FALSE,
                 s.jump = NULL, t.jump = NULL, l.jump = NULL) {
  y <- as.numeric(x); n <- length(y); np <- frequency(x)
  periodic <- is.character(s.window)
  if (periodic) { s.window <- 10 * n + 1; s.degree <- 0 }
  if (is.null(l.window)) l.window <- nextodd(np)
  if (is.null(t.window)) t.window <- nextodd(ceiling(1.5 * np / (1 - 1.5 / s.window)))
  l.window <- nextodd(l.window)
  sj <- if (!is.null(s.jump)) s.jump else max(1, ceiling(s.window / 10))
  tj <- if (!is.null(t.jump)) t.jump else max(1, ceiling(t.window / 10))
  lj <- if (!is.null(l.jump)) l.jump else max(1, ceiling(l.window / 10))
  trend <- numeric(n); rw <- rep(1, n); season <- numeric(n)
  for (o in 0:outer) {
    for (it in 1:inner) {
      d <- y - trend
      C <- numeric(n + 2 * np)
      for (p in 1:np) {
        idx <- seq(p, n, by = np); k <- length(idx)
        rws <- if (v1 && periodic) rep(1, k) else rw[idx]
        sm <- loessAt(d[idx], rws, 0:(k + 1), s.window, s.degree, hv, tv)
        if (sj > 1) {
          at <- unique(c(seq(1, k, by = sj), k)); v <- loessAt(d[idx], rws, at, s.window, s.degree, hv, tv)
          sm <- c(loessAt(d[idx], rws, 0, s.window, s.degree, hv, tv), approx(at, v, 1:k)$y,
                  loessAt(d[idx], rws, k + 1, s.window, s.degree, hv, tv))
        }
        C[p + np * (0:(k + 1))] <- sm
      }
      L <- movAvg(movAvg(movAvg(C, np), np), 3)
      L <- smoothJump(L, rep(1, n), l.window, l.degree, lj, hv, tv)
      season <- C[np + 1:n] - L
      if (v2 && periodic) season <- ave(season, (seq_len(n) - 1) %% np + 1)
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

cmp <- function(r, cnd) c(seasonal = max(abs(as.numeric(r$time.series[, 1]) - cnd$seasonal)),
                          trend = max(abs(as.numeric(r$time.series[, 2]) - cnd$trend)),
                          weights = max(abs(r$weights - cnd$weights)))
for (cs in list(list("usacc", USAccDeaths), list("co2", co2), list("nottem", nottem))) {
  r <- stl(cs[[2]], "periodic", robust = TRUE)
  out[[paste0("periodic_robust_", cs[[1]])]] <- list(
    base = cmp(r, stlC(cs[[2]], "periodic", isRobust = TRUE)),
    V1 = cmp(r, stlC(cs[[2]], "periodic", isRobust = TRUE, v1 = TRUE)),
    V2 = cmp(r, stlC(cs[[2]], "periodic", isRobust = TRUE, v2 = TRUE)),
    V12 = cmp(r, stlC(cs[[2]], "periodic", isRobust = TRUE, v1 = TRUE, v2 = TRUE)))
}
more <- list(
  list("sdeg1", function() stl(co2, s.window = 11, s.degree = 1), function() stlC(co2, 11, s.degree = 1)),
  list("tdeg0", function() stl(co2, s.window = 11, t.degree = 0), function() stlC(co2, 11, t.degree = 0)),
  list("lwin_even", function() stl(nottem, s.window = 9, l.window = 14), function() stlC(nottem, 9, l.window = 14)),
  list("jumps1", function() stl(co2, s.window = 21, s.jump = 1, t.jump = 1, l.jump = 1),
       function() stlC(co2, 21, s.jump = 1, t.jump = 1, l.jump = 1)),
  list("inner5_outer3", function() stl(USAccDeaths, s.window = 7, inner = 5, outer = 3),
       function() stlC(USAccDeaths, 7, inner = 5, outer = 3)),
  list("twin", function() stl(USAccDeaths, s.window = 9, t.window = 31), function() stlC(USAccDeaths, 9, t.window = 31)),
  list("short", function() stl(ts(as.numeric(USAccDeaths)[1:30], frequency = 12), s.window = 7),
       function() stlC(ts(as.numeric(USAccDeaths)[1:30], frequency = 12), 7)),
  list("robust_s7", function() stl(USAccDeaths, s.window = 7, robust = TRUE), function() stlC(USAccDeaths, 7, isRobust = TRUE))
)
for (cs in more) {
  r <- cs[[2]]()
  out[[cs[[1]]]] <- list(win = r$win, deg = r$deg, jump = r$jump, cmp = cmp(r, cs[[3]]()))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
