source("/oracle/_htest.R")

# Boschloo's test of a 2×2 table with fixed row totals (fixture boschloo): Exact::exact.test(method = "boschloo")
# and exact2x2::boschloo for the same data. See oracle/contingency-behaviour.md, "Boschloo's test".
#
# Arguments are in Exact's orientation: group 1 has x1 successes of n1, group 2 x2 of n2; alternative "less" means
# p1 < p2; tsmethod "square" (Exact's default: the two-sided Fisher p-value as the statistic, also exact2x2's
# tsmethod = "minlike") or "central" (twice the smaller one-sided p-value). exact2x2::boschloo parametrises by the
# odds ratio of group 2 to group 1, so its alternative is the opposite ("greater" for Exact's "less").
#
# Expected fields:
#   pValue, statistic, np       Exact's p-value, its test statistic (the observed Fisher p-value rounded to 12
#                               significant digits) and the nuisance parameter(s) where the maximum was found
#   exact2x2.pValue             exact2x2's p-value (maximum over the grid k/99, k = 1..98, without refinement)
# Reference: the supremum over the nuisance parameter p in (0, 1), found from a grid of 999 points and Brent's
# method around the largest grid values, with the rejection region "Fisher p-value <= (1 + 1e-7) times the
# observed one" (the tolerance of fisher.test).
# oracle-memory: 1536m

suppressPackageStartupMessages({ library(Exact); library(exact2x2) })

set.seed(20261106)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
data <- list(c(3, 10, 8, 10), c(2, 15, 9, 15), c(10, 30, 18, 25), c(0, 5, 4, 5), c(7, 12, 7, 12), c(1, 8, 6, 9),
             c(5, 5, 0, 5), c(0, 10, 0, 10), c(10, 10, 10, 10), c(0, 1, 1, 1), c(12, 40, 25, 40), c(4, 7, 1, 13),
             c(40, 100, 55, 100), c(20, 60, 9, 25))
for (i in 1:4) {
  n1 <- sample(5:40, 1); n2 <- sample(5:40, 1)
  data[[length(data) + 1]] <- c(sample(0:n1, 1), n1, sample(0:n2, 1), n2)
}
for (v in data) {
  for (alt in c("less", "greater")) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], alternative = alt)
  for (ts in c("square", "central")) add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], alternative = "two.sided", tsmethod = ts)
}
# n up to 200 per group (Exact only; exact2x2 takes about 8 s for each of these)
big <- list(c(80, 200, 100, 200), c(30, 150, 45, 120), c(100, 200, 100, 200))
for (v in big) {
  add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], alternative = "less", exact2x2 = FALSE)
  add(x1 = v[1], n1 = v[2], x2 = v[3], n2 = v[4], alternative = "two.sided", tsmethod = "square", exact2x2 = FALSE)
}
add(x1 = 3, n1 = 10, x2 = 8, n2 = 10)                    # defaults (two.sided, square)
add(x1 = 11, n1 = 10, x2 = 8, n2 = 10)
add(x1 = 2.5, n1 = 10, x2 = 8, n2 = 10)
add(x1 = 0, n1 = 0, x2 = 8, n2 = 10)

# Fisher p-values of every table (X1, X2) with the given row totals; alt in less (P(X1 <= x1 | margins)), greater,
# two.sided (sum of probabilities at most (1 + 1e-7) times the observed one)
fisher_all <- function(n1, n2, alt) {
  X1 <- rep(0:n1, n2 + 1); X2 <- rep(0:n2, each = n1 + 1)
  if (alt == "less") return(phyper(X1, n1, n2, X1 + X2))
  if (alt == "greater") return(phyper(X1 - 1, n1, n2, X1 + X2, lower.tail = FALSE))
  p <- numeric(length(X1))
  for (k in 0:(n1 + n2)) {
    i <- which(X1 + X2 == k)
    lo <- max(0, k - n2); hi <- min(k, n1); s <- lo:hi
    d <- dhyper(s, n1, n2, k, log = TRUE); d <- exp(d - max(d)); d <- d / sum(d)
    ps <- vapply(seq_along(s), function(j) sum(d[d <= d[j] * (1 + 1e-7)]), 0)
    p[i] <- pmin(1, ps[match(X1[i], s)])
  }
  p
}
boschloo_sup <- function(x1, n1, x2, n2, alt) {
  X1 <- rep(0:n1, n2 + 1); X2 <- rep(0:n2, each = n1 + 1)
  T <- fisher_all(n1, n2, alt)
  T0 <- T[X1 == x1 & X2 == x2]
  R <- matrix(as.numeric(T <= T0 * (1 + 1e-7)), n1 + 1, n2 + 1)   # rows X1, columns X2
  f <- function(p) sum(dbinom(0:n1, n1, p) * (R %*% dbinom(0:n2, n2, p)))
  g <- (1:999) / 1000
  v <- vapply(g, f, 0)
  best <- max(v)
  # refine around every local maximum of the grid within 1e-3 of the largest
  for (i in which(v >= best * (1 - 1e-3))) {
    if (i > 1 && v[i - 1] > v[i]) next
    if (i < length(v) && v[i + 1] > v[i]) next
    o <- optimize(f, c(if (i > 1) g[i - 1] else 1e-12, if (i < length(g)) g[i + 1] else 1 - 1e-12),
                  maximum = TRUE, tol = 1e-13)
    best <- max(best, o$objective)
  }
  min(1, best)
}
bos_ref <- function(a) {
  ok <- all(c(a$x1, a$x2) == round(c(a$x1, a$x2))) && a$x1 >= 0 && a$x2 >= 0 && a$x1 <= a$n1 && a$x2 <= a$n2 &&
    a$n1 > 0 && a$n2 > 0
  if (!ok) return(NULL)
  alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
  ts <- if (is.null(a$tsmethod)) "square" else a$tsmethod
  p <- if (alt != "two.sided") boschloo_sup(a$x1, a$n1, a$x2, a$n2, alt) else if (ts == "square")
    boschloo_sup(a$x1, a$n1, a$x2, a$n2, "two.sided") else
    min(1, 2 * min(boschloo_sup(a$x1, a$n1, a$x2, a$n2, "less"), boschloo_sup(a$x1, a$n1, a$x2, a$n2, "greater")))
  list(pValue = num2str(p))
}

write_htest_fixture("boschloo", cases, function(a) {
  d <- matrix(c(a$x1, a$n1 - a$x1, a$x2, a$n2 - a$x2), 2, byrow = TRUE)
  r <- call_with(exact.test, list(data = d, method = "boschloo", alternative = a$alternative, tsmethod = a$tsmethod,
                                  to.plot = FALSE))
  out <- list(method = r$method, alternative = r$alternative, pValue = num2str(r$p.value),
              statistic = num2str(unname(r$statistic)), np = I(num2str(r$np[[1]])),
              estimate = num2str(unname(r$estimate)))
  if (!isFALSE(a$exact2x2)) {
    alt <- if (is.null(a$alternative)) "two.sided" else a$alternative
    ts <- if (is.null(a$tsmethod) || a$tsmethod == "square") "minlike" else "central"
    alt2 <- switch(alt, less = "greater", greater = "less", two.sided = "two.sided")
    e <- tryCatch(boschloo(a$x1, a$n1, a$x2, a$n2, alternative = alt2, tsmethod = ts)$p.value,
                  error = function(e) conditionMessage(e))
    out$exact2x2.pValue <- if (is.character(e)) e else num2str(e)
  }
  out
}, bos_ref, warnings = TRUE)
