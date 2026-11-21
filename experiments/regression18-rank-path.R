# issue: 545
# regression18-rank-path.R: how R inverts the rank test (summary.rq, se = "rank"), from public output only (1.8.0)
# Part 1: the 16-row example (T(b) between events, R's intervals at alpha 0.05 / 0.1 and iid TRUE / FALSE)
suppressMessages(library(quantreg))
X <- cbind(1, -3:12); y <- c(2,1,4,2,5,3,8,5,9,7,11,8,14,10,15,13); x <- X[, 2]; tau <- 0.5
Tstat <- function(b, j = 2) {
  yy <- y - X[, j] * b; Xr <- X[, -j, drop = FALSE]
  a <- suppressWarnings(rq.fit.br(Xr, yy, tau = tau))$dual
  xr <- X[, j] - Xr %*% qr.solve(Xr, X[, j])
  sum(xr * (a - (1 - tau))) / sqrt(sum(xr^2) * tau * (1 - tau))
}
bp <- c(); for (i in 1:15) for (k in (i+1):16) bp <- c(bp, (y[i]-y[k])/(x[i]-x[k]))
bp <- sort(unique(round(bp, 12))); bp <- bp[bp > 0.3 & bp < 1.5]
mid <- (head(bp, -1) + tail(bp, -1)) / 2
cat("breakpoints:", format(bp, digits = 15), "\n")
cat("T between:", format(sapply(mid, Tstat), digits = 15), "\n")
cat("T at breakpoints:", format(sapply(bp, Tstat), digits = 15), "\n")
for (a in c(0.05, 0.1)) for (iid in c(TRUE, FALSE)) {
  s <- suppressWarnings(summary(rq(y ~ x, tau = tau), se = "rank", alpha = a, iid = iid))
  cat("alpha", a, "iid", iid, ":", format(coef(s)[2, ], digits = 15), "\n")
}

# Part 2: which pair of points and which critical value give R's endpoints by linear interpolation
Tstat2 <- function(b, j = 2) {
  yy <- y - X[, j] * b; Xr <- X[, -j, drop = FALSE]
  a <- suppressWarnings(rq.fit.br(Xr, yy, tau = tau))$dual
  xr <- X[, j] - Xr %*% qr.solve(Xr, X[, j])
  sum(xr * (a - (1 - tau))) / sqrt(sum(xr^2) * tau * (1 - tau))
}
bp <- c(); for (i in 1:15) for (k in (i+1):16) bp <- c(bp, (y[i]-y[k])/(x[i]-x[k]))
bp <- sort(unique(round(bp, 13))); eps <- 1e-9
TL <- sapply(bp, function(b) Tstat2(b - eps)); TR <- sapply(bp, function(b) Tstat2(b + eps))
targets <- c(a10lo = 0.580560930960114, a10hi = 1.064048640741457, a05lo = 0.557058220755292, a05hi = 1.180302762873809)
zs <- c(n95 = qnorm(.95), n975 = qnorm(.975), t95 = qt(.95, 14), t975 = qt(.975, 14))
for (tg in names(targets)) for (zn in names(zs)) {
  z <- zs[[zn]]
  for (i in seq_along(bp)) for (k in seq_along(bp)) if (k > i && k <= i + 6) {
    for (s1 in c("L", "R")) for (s2 in c("L", "R")) {
      t1 <- if (s1 == "L") TL[i] else TR[i]; t2 <- if (s2 == "L") TL[k] else TR[k]
      if (t1 == t2) next
      for (zz in c(z, -z)) {
        e <- bp[i] + (bp[k] - bp[i]) * (t1 - zz) / (t1 - t2)
        if (abs(e - targets[[tg]]) < 1e-9) cat(tg, zn, "i", bp[i], s1, t1, "k", bp[k], s2, t2, "z", zz, "->", format(e, digits = 15), "\n")
      }
    }
  }
}

# Part 3: stackloss, Air.Flow: T(b) from independent restricted fits near the lower limit
X <- cbind(1, stackloss$Air.Flow, stackloss$Water.Temp, stackloss$Acid.Conc.); y <- stackloss$stack.loss; tau <- 0.5; j <- 2
xr <- X[, j] - X[, -j] %*% qr.solve(X[, -j], X[, j])
for (b in c(0.50, 0.505, 0.508, 0.509, 0.512, 0.513, 0.515, 0.52, 0.525, 0.53, 0.55, 0.6, 0.65, 0.69, 0.71, 0.75, 0.8)) {
  f <- suppressWarnings(rq.fit.br(X[, -j], y - X[, j] * b, tau = tau))
  cat(b, format(sum(xr * (f$dual - (1 - tau))) / sqrt(sum(xr^2) * tau * (1 - tau)), digits = 15), "\n")
}
cat("crit", qt(0.95, 17), "\n")
