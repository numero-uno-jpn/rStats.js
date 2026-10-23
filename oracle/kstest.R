source("/oracle/_htest.R")

# ks.test, one sample against pnorm / pexp / punif, or two samples (fixture ksTest)

set.seed(20261029)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:100) {
  n <- sample(1:150, 1)
  cdf <- sample(c("pnorm", "pexp", "punif"), 1)
  x <- switch(cdf, pnorm = round(rnorm(n, runif(1, -0.5, 0.5)), 8), pexp = round(rexp(n, runif(1, 0.7, 1.4)), 8),
              punif = round(runif(n) * runif(1, 0.8, 1.1), 8))
  add(x = x, cdf = cdf, alternative = sample(alts, 1))
}
for (i in 1:100) {
  m <- sample(1:120, 1); n <- sample(1:120, 1)
  tied <- runif(1) < 0.3
  x <- if (tied) as.numeric(sample(0:8, m, TRUE)) else round(rnorm(m), 8)
  y <- if (tied) as.numeric(sample(0:8, n, TRUE)) else round(rnorm(n, runif(1, -0.5, 0.5)), 8)
  add(x = x, y = y, alternative = sample(alts, 1))
}
for (alt in alts) {
  add(x = round(rnorm(50), 8), cdf = "pnorm", alternative = alt, exact = FALSE)
  add(x = round(rnorm(150), 8), cdf = "pnorm", alternative = alt, exact = TRUE)
  add(x = c(0.1, 0.1, 0.5, 0.9), cdf = "punif", alternative = alt)
  add(x = round(rnorm(30), 8), y = round(rnorm(40, 1), 8), alternative = alt, exact = FALSE)
  add(x = round(rnorm(130), 8), y = round(rnorm(90, 0.2), 8), alternative = alt)
  add(x = round(rnorm(130), 8), y = round(rnorm(90, 0.2), 8), alternative = alt, exact = TRUE)
  add(x = c(1, 2, 2, 3), y = c(2, 3, 3, 4, 5), alternative = alt)
  add(x = 0.5, cdf = "punif", alternative = alt)
  add(x = round(rnorm(80, 3), 8), cdf = "pnorm", alternative = alt)
}
add(x = c(1, NA, 3), y = c(2, 4))
add(x = numeric(0), cdf = "pnorm")
add(x = c(1, 2), y = numeric(0))
ks_fun <- function(a) {
  y <- if (is.null(a$cdf)) a$y else a$cdf
  htest_fields(call_with(ks.test, list(x = a$x, y = y, alternative = a$alternative, exact = a$exact)))
}
write_htest_fixture("ksTest", cases, ks_fun)
