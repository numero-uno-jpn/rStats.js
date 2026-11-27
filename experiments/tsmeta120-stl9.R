# tsmeta120-stl9.R: stats' stl, ninth experiment (1.20.0). tsmeta120-stl8 found that where the candidate departs, R's
# robustness scale is h = 3 (s_25 + s_37) for n = 72 (s = the sorted |remainder|) instead of 3 (s_36 + s_37) =
# 6 median: the upper middle order statistic is right and the lower one is another element. Here, how often and which:
# 400 random series (n from 30 to 121, odd and even; frequency 4 or 12; trend + seasonal + heavy-tailed noise),
# s.window = 7 (not periodic, so the returned remainder is the internal one), inner = 2. From R's remainder with
# outer = 0 and R's weights with outer = 1 (the weights computed from that remainder), the implied h_i =
# |R_i| / sqrt(1 - sqrt(w_i)) for 0.001 < u < 0.999; then all pairs (a <= b) with 3 (s_a + s_b) = h to 1e-9.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261127)
rows <- list()
for (it in 1:400) {
  f <- sample(c(4, 12), 1); n <- sample(30:121, 1)
  y <- ts(0.05 * (1:n) + 3 * sin(2 * pi * (1:n) / f) + rt(n, df = 2), frequency = f)
  r0 <- stl(y, 7, inner = 2, outer = 0); r1 <- stl(y, 7, inner = 2, outer = 1)
  aR <- abs(as.numeric(r0$time.series[, 3])); w <- r1$weights; s <- sort(aR)
  h6 <- 6 * median(aR)
  ok <- w > 1e-12 & w < 1 - 1e-12
  hImp <- median(aR[ok] / sqrt(1 - sqrt(w[ok])))
  pairs <- NULL
  for (a in 1:n) for (b in a:n) if (abs(3 * (s[a] + s[b]) / hImp - 1) < 1e-9) pairs <- rbind(pairs, c(a, b))
  rows[[it]] <- list(n = n, f = f, mid1 = n %/% 2 + 1, mid2 = n - (n %/% 2 + 1) + 1, h_implied = hImp, h6 = h6,
                     agree = abs(hImp / h6 - 1) < 1e-9, pairs = pairs, spread = diff(range(aR[ok] / sqrt(1 - sqrt(w[ok])))) / hImp)
}
out$rows <- rows
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string"))
