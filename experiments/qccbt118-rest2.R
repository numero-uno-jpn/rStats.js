# qccbt118-rest2.R: two points of qccbt118-rest.R (1.18.0):
# (a) groups of 30: sd.xbar (UWAVE-R) gave NA while qcc(type = "xbar") gave 1.00206 (UWAVE-SD is 0.99919): candidates
#     RMSDF, MVLUE-SD, the tables' lengths (se.R.unscaled may be longer than exp.R.unscaled) and sizes 25 / 26;
# (b) the lambda grid of the u chart OC curve (0:24 for center 2.975 and size 2, where 0:ceiling(center + 10 sqrt(center))
#     gives 21): candidate 0:ceiling(n u + 10 sqrt(u)) and others, for sizes 1, 3, 5, 0.5.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(qcc))
out <- list(R = R.version.string, arch = R.version$arch, qcc = as.character(packageVersion("qcc")))
set.seed(20261203)
pdf(NULL)
try1 <- function(expr) tryCatch(expr, error = function(e) list(error = conditionMessage(e)),
                                warning = function(w) list(warning = conditionMessage(w)))
out$len <- c(d2 = length(qcc.options("exp.R.unscaled")), d3 = length(qcc.options("se.R.unscaled")))
out$d3_26_50 <- qcc.options("se.R.unscaled")[26:min(50, length(qcc.options("se.R.unscaled")))]
c4 <- function(n) sqrt(2 / (n - 1)) * exp(lgamma(n / 2) - lgamma((n - 1) / 2))
for (k in c(25, 26, 30)) {
  big <- matrix(rnorm(10 * k), 10, k)
  s <- apply(big, 1, sd)
  out[[paste0("n", k)]] <- list(
    q = try1(qcc(big, type = "xbar", plot = FALSE)$std.dev),
    q_warn = tryCatch({ withCallingHandlers(qcc(big, type = "xbar", plot = FALSE), warning = function(w) {
      out[[paste0("w", k)]] <<- conditionMessage(w); invokeRestart("muffleWarning") }); "ok" }, error = function(e) conditionMessage(e)),
    UWAVE_R = try1(sd.xbar(big)), UWAVE_SD = sd.xbar(big, std.dev = "UWAVE-SD"), RMSDF = sd.xbar(big, std.dev = "RMSDF"),
    MVLUE_SD = sd.xbar(big, std.dev = "MVLUE-SD"), MVLUE_R = try1(sd.xbar(big, std.dev = "MVLUE-R")),
    cand_raw_rms = sqrt(mean(s^2)), cand_mean_s = mean(s), cand_rms_c4 = sqrt(mean(s^2)) / c4(10 * (k - 1) + 1),
    qR = try1(unname(qcc(big, type = "R", plot = FALSE)$limits)), qS = try1(unname(qcc(big, type = "S", plot = FALSE)$limits)))
}
out$b <- list()
for (sz in c(1, 2, 3, 5, 0.5)) {
  cc <- rpois(20, 6)
  qu <- qcc(cc, sizes = sz, type = "u", plot = FALSE)
  oc <- suppressWarnings(oc.curves(qu))
  u <- qu$center
  out$b[[as.character(sz)]] <- list(u = u, last = names(oc)[length(oc)], head = unname(head(oc, 3)),
                                    limits = unname(qu$limits[1, ]),
                                    cand1 = ceiling(sz * u + 10 * sqrt(u)), cand2 = ceiling(sz * u + 10 * sqrt(sz * u)),
                                    cand3 = ceiling(u + 10 * sqrt(u)),
                                    c_same = unname(head(ppois(floor(qu$limits[1, 2] * sz), 0:2) -
                                                         ppois(ceiling(qu$limits[1, 1] * sz) - 1, 0:2), 3)))
}
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null"))
