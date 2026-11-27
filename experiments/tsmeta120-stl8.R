# tsmeta120-stl8.R: stats' stl, eighth experiment (1.20.0). tsmeta120-stl7 showed that in the failing configuration
# the fit before the jump equals R's (outer = 2 agrees), but the robustness weights computed from it do not, so the
# scale h = 6 median |R| must differ. Here R's own remainder (outer = 2) and R's weights computed from it (outer = 3
# returns the weights used in its last pass) give the implied h_i = |R_i| / sqrt(1 - sqrt(w_i)) for 0 < w_i < 1;
# it is compared with 6 times the order statistics of |R| (and 3 times the sums of neighbouring ones), to see which
# R used. Two configurations that jump (s.window 7 inner 2 outer 3; periodic inner 1 outer 5) and two that agree.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
out <- list(R = R.version.string, arch = R.version$arch)
cfgs <- list(list("s7_i2_o3", 7, 2, 3), list("periodic_i1_o5", "periodic", 1, 5), list("s7_i2_o2", 7, 2, 2),
             list("periodic_i1_o4", "periodic", 1, 4))
for (cf in cfgs) {
  prev <- stl(USAccDeaths, cf[[2]], inner = cf[[3]], outer = cf[[4]] - 1)
  cur <- stl(USAccDeaths, cf[[2]], inner = cf[[3]], outer = cf[[4]])
  aR <- abs(as.numeric(prev$time.series[, 3])); w <- cur$weights
  inside <- w > 0 & w < 1
  hImp <- aR[inside] / sqrt(1 - sqrt(w[inside]))
  s <- sort(aR); n <- length(s)
  out[[cf[[1]]]] <- list(h_implied_range = range(hImp), h_true_median = 6 * median(aR),
    six_times = 6 * s, three_pairs = 3 * (s[-n] + s[-1]), n = n, zeros = sum(w == 0))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, na = "string", pretty = TRUE))
