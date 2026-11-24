# oracle-platform: amd64
# issue: 560
library(jsonlite)
source("/oracle/_acf111cases.R")
selected <- out[grepl("^(acf_|pacf_|ccf_|clim_)", names(out))]
# acf_long_partial_exact: the partial autocorrelations of acf_long_partial's series (the second cumsum(rnorm(5000)) after
# set.seed(1)) by Durbin-Levinson in 200-bit arithmetic. R's own values are off by up to 5.0e-12 there (rho(1) = 0.9987
# makes the recursion ill-conditioned), so the test compares with these (Claude, 2026-11-23)
suppressPackageStartupMessages(library(Rmpfr))
set.seed(1); invisible(rnorm(5000)); xl <- mpfr(cumsum(rnorm(5000)), 200)
nl <- length(xl); yl <- xl - mean(xl)
G <- new("mpfr", unlist(lapply(0:40, function(k) sum(yl[1:(nl - k)] * yl[(1 + k):nl]))))
rho <- G / G[1]; pex <- numeric(40); prev <- NULL
for (k in 1:40) {
  a <- if (k == 1) rho[2] else (rho[k + 1] - sum(prev * rho[k:2])) / (1 - sum(prev * rho[2:k]))
  pex[k] <- asNumeric(a); prev <- if (k == 1) a else c(prev - a * rev(prev), a)
}
selected$acf_long_partial_exact <- list(value = list(acf = pex))
writeLines(as.character(toJSON(selected, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE)), "/out/acf.json")
