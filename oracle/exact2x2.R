source("/oracle/_htest.R")

# Fisher's exact test of a 2×2 table as exact2x2::fisher.exact computes it (fixture fisherExact): the mid-p version
# (midp = TRUE; tsmethod "central", the only two-sided method it allows) and, for comparison, the default
# (midp = FALSE, tsmethod "minlike": fisher.test's p-value with the matching "minlike" interval of exact2x2CI) and
# tsmethod "central". See oracle/contingency-behaviour.md.
#
# Reference (mid-p only): exact2x2 finds the mid-p limits with uniroot()'s default tolerance on the odds ratio in
# [0, 1] or on its reciprocal in [eps, 1], so the upper limits are off by up to several per cent (and 1/eps where
# the reciprocal is below 1e-4). The reference solves the same equations on the log scale of the odds ratio to a
# relative 1e-14.

suppressPackageStartupMessages(library(exact2x2))

set.seed(20261106)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
m2 <- function(a, b, c, d) matrix(c(a, c, b, d), 2)  # rows are a b / c d
tabs <- list(m2(3, 1, 1, 3), m2(2, 15, 10, 3), m2(1, 2, 3, 4), m2(10, 3, 2, 15), m2(0, 5, 3, 4), m2(5, 0, 3, 4),
             m2(0, 3, 4, 0), m2(0, 0, 3, 4), m2(0, 3, 0, 4), m2(0, 0, 0, 0), m2(1, 0, 0, 0), m2(1, 1, 1, 1),
             m2(7, 7, 7, 7), m2(20, 25, 30, 35), m2(50, 20, 10, 60), m2(100, 1, 1, 100), m2(500, 300, 300, 500),
             m2(1, 50, 60, 2), m2(30, 2, 1, 40), m2(1, 9, 9, 1), m2(56, 14, 48, 32))
for (i in 1:5) tabs[[length(tabs) + 1]] <- matrix(rpois(4, c(2, 5, 20, 80)[i %% 4 + 1]), 2)
alts <- c("two.sided", "less", "greater")
for (x in tabs) {
  for (alt in alts) {
    add(x = x, alternative = alt, midp = TRUE)
    add(x = x, alternative = alt, midp = TRUE, or = 2.5, confLevel = 0.9)
  }
  add(x = x, midp = TRUE, confLevel = 0.99)
  add(x = x)                                          # default: midp FALSE, tsmethod minlike
  add(x = x, tsmethod = "central")
}
x <- tabs[[1]]
for (cl in c(0, 0.3, 0.5, 0.6, 0.999999, 1)) {
  add(x = x, midp = TRUE, confLevel = cl)
  add(x = x, midp = TRUE, alternative = "less", confLevel = cl)
}
add(x = x, midp = TRUE, tsmethod = "central")
add(x = x, midp = TRUE, tsmethod = "minlike")
add(x = x, midp = TRUE, tsmethod = "blaker")
add(x = x, midp = TRUE, alternative = "less", tsmethod = "minlike")   # one-sided: tsmethod is not used
add(x = x, midp = TRUE, confInt = FALSE)
add(x = x, midp = TRUE, or = 0)
add(x = x, midp = TRUE, or = Inf)
add(x = m2(0, 3, 4, 2), midp = TRUE, or = 0)
add(x = x, midp = TRUE, alternative = "g")
add(x = x, midp = TRUE, alternative = "foo")
add(x = m2(3.5, 1, 1, 3), midp = TRUE)
add(x = m2(-1, 1, 1, 3), midp = TRUE)
add(x = m2(NaN, 1, 1, 3), midp = TRUE)
add(x = matrix(1:6, 2), midp = TRUE)
add(x = x, midp = TRUE, or = -1)

# Mid-p tails of the noncentral hypergeometric distribution, as functions of l = log(odds ratio)
midp_tails <- function(x) {
  m <- sum(x[, 1]); n <- sum(x[, 2]); k <- sum(x[1, ]); a <- x[1, 1]
  lo <- max(0, k - n); hi <- min(k, m); s <- lo:hi
  ld <- dhyper(s, m, n, k, log = TRUE)
  probs <- function(l) { d <- ld + l * s; d <- exp(d - max(d)); d / sum(d) }
  list(a = a, lo = lo, hi = hi,
       less = function(l) { d <- probs(l); sum(d[s < a]) + 0.5 * d[s == a] },
       greater = function(l) { d <- probs(l); sum(d[s > a]) + 0.5 * d[s == a] })
}
log_root <- function(f) {   # f increasing in l
  a <- -1; while (f(a) > 0) a <- a * 2
  b <- 1; while (f(b) < 0) b <- b * 2
  exp(uniroot(f, c(a, b), tol = 1e-15, maxiter = 5000)$root)
}
fisher_midp_ref <- function(a) {
  if (!isTRUE(a$midp) || isFALSE(a$confInt)) return(NULL)
  x <- a$x
  if (any(!is.finite(x)) || any(x < 0) || any(x != round(x)) || !all(dim(x) == 2)) return(NULL)
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
  if (!(alt %in% alts) || cl <= 0 || cl >= 1) return(NULL)
  t <- midp_tails(x)
  # the conventions of exact2x2 at the ends of the support and for alpha >= 1/2 are kept
  upperL <- function(alpha) {
    if (t$a == t$hi) return(Inf)
    if (t$a == t$lo && alpha >= 0.5) return(0)
    log_root(function(l) alpha - t$less(l))
  }
  lowerL <- function(alpha) {
    if (t$a == t$lo) return(0)
    if (t$a == t$hi && alpha >= 0.5) return(Inf)
    log_root(function(l) t$greater(l) - alpha)
  }
  ci <- switch(alt, less = c(0, upperL(1 - cl)), greater = c(lowerL(1 - cl), Inf),
               two.sided = c(lowerL((1 - cl) / 2), upperL((1 - cl) / 2)))
  list(confInt = I(num2str(ci)))
}

write_htest_fixture("fisherExact", cases, function(a) {
  r <- call_with(fisher.exact, list(x = a$x, alternative = a$alternative, or = a$or, conf.int = a$confInt,
                                    conf.level = a$confLevel, midp = a$midp, tsmethod = a$tsmethod))
  f <- htest_fields(r)
  f$statistic <- NULL
  f$statisticName <- NULL
  f
}, fisher_midp_ref, warnings = TRUE)
