# mediation116-boot-count.R: how much of the generator mediate(boot = TRUE) uses (1.16.0): the number of uniform draws
# from set.seed(1234) to the state after the call, for lm / lm with sims = 2, 3, 4 and 30 (sims = 1 is an error), and the same count for
# sample(n, n, replace = TRUE) alone, to see what each replicate draws.
# Output: JSON on stdout. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(mediation))
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(20261125)
n <- 60
C <- rnorm(n); Xb <- rbinom(n, 1, 0.5)
Mb <- 0.8 * Xb + 0.3 * C + rnorm(n); Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
d <- data.frame(C, Xb, Mb, Yb)
assign("d", d, envir = globalenv())
fm <- lm(Mb ~ Xb + C, data = d); fy <- lm(Yb ~ Xb + Mb + C, data = d)
count_unif <- function(target, limit) {
  set.seed(1234); if (identical(.Random.seed, target)) return(0)
  for (k in seq_len(limit)) { runif(1); if (identical(.Random.seed, target)) return(k) }
  NA
}
out$boot <- lapply(c(s2 = 2, s3 = 3, s4 = 4, s30 = 30), function(s) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = TRUE, sims = s); st <- .Random.seed
  count_unif(st, 20000)
})
out$quasi <- lapply(c(s2 = 2, s3 = 3), function(s) {
  set.seed(1234); r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = FALSE, sims = s); st <- .Random.seed
  count_unif(st, 20000)
})
set.seed(1234); invisible(sample(n, n, replace = TRUE)); st <- .Random.seed; out$sample_one <- count_unif(st, 2000)
set.seed(1234); invisible(rnorm(n)); st <- .Random.seed; out$rnorm_n <- count_unif(st, 2000)
cat(toJSON(out, auto_unbox = TRUE, pretty = TRUE))
