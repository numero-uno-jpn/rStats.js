# issue: 545
# R 4.6.2 public geeglm timing at the same 100000-row design as the JS stress test.
suppressPackageStartupMessages(library(geepack))
clusters <- 50000L
n <- clusters * 2L
d <- data.frame(
  id = rep(seq_len(clusters), each = 2L),
  wave = rep(1:2, clusters),
  x = rep(0:1, clusters),
  y = 1 + rep(0:1, clusters) * 0.7 +
    rep(seq_len(clusters) %% 97, each = 2L) * 0.003 +
    rep(c(-0.04, 0.04), clusters)
)
for (corstr in c("independence", "exchangeable")) {
  elapsed <- system.time(
    fit <- geeglm(y ~ x, id = id, waves = wave, data = d, corstr = corstr)
  )[["elapsed"]]
  stopifnot(all(is.finite(coef(fit))))
  cat(sprintf("%s rows=%d clusters=%d elapsed=%.6f\n", corstr, n, clusters, elapsed))
}
