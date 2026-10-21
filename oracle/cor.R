source("/oracle/_htest.R")

# cor (two vectors) and cor.test (pearson, kendall, spearman)

set.seed(20261022)
pair <- function(n, rho = 0.5, f = identity) { x <- rnorm(n); y <- rho * x + sqrt(1 - rho^2) * rnorm(n); list(x = f(x), y = f(y)) }
rnd <- function(v) round(v * 2) / 2
# Data sets (the combination of tests varies by group)
small <- list(
  list(x = c(1, 2), y = c(2, 1)),
  list(x = c(1, 2), y = c(1, 3)),
  list(x = c(1, 2, 3), y = c(2, 1, 4)),
  list(x = c(3.1, 1.2, 2.5, 4.4), y = c(2.2, 0.1, 3.3, 5.0)),
  list(x = c(1, 2, 3, 4), y = c(2, 1, 4, 3)),
  list(x = c(44.4, 45.9, 41.9, 53.3, 44.7, 44.1, 50.7, 45.2, 60.1), y = c(2.6, 3.1, 2.5, 5.0, 3.6, 4.0, 5.2, 2.8, 3.8))
)
for (n in c(5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 30, 49, 50, 51)) small[[length(small) + 1]] <- pair(n, 0.4)
for (n in c(9, 10, 20)) small[[length(small) + 1]] <- pair(n, 0.95)
for (n in c(9, 10, 20)) small[[length(small) + 1]] <- pair(n, -0.9)
# Perfect correlation
for (n in c(3, 4, 9, 10, 25, 60)) {
  small[[length(small) + 1]] <- list(x = 1:n * 1.5, y = 2 * (1:n) + 1)
  small[[length(small) + 1]] <- list(x = 1:n * 1.5, y = -(1:n))
}
# Ties
ties <- list(
  list(x = c(1, 2, 2, 3, 4), y = c(1, 3, 2, 5, 4)),
  list(x = c(1, 2, 2, 3, 4, 6, 5, 8), y = c(1, 3, 2, 5, 4, 4, 7, 6)),
  list(x = c(1, 1, 2, 2), y = c(2, 2, 1, 1)),
  list(x = c(1, 1, 1, 1, 2), y = c(1, 2, 3, 4, 4))
)
for (n in c(10, 30, 60)) ties[[length(ties) + 1]] <- pair(n, 0.3, rnd)
ties[[length(ties) + 1]] <- list(x = sample(1:3, 40, TRUE), y = sample(1:4, 40, TRUE))
# NaN, Inf, constants, scale
special <- list(
  list(x = c(1, NA, 3, 4, 5, 7), y = c(2, 1, NaN, 3, 6, 5)),
  list(x = c(1, 2, Inf, 4, 5), y = c(2, 1, 3, 7, 6)),
  list(x = c(1, 2, Inf, -Inf, 5, 9), y = c(2, 1, 3, 7, 6, 8)),
  list(x = c(1, 1, 1, 1), y = c(2, 1, 3, 4)),
  list(x = rep(2, 60), y = 1:60),
  list(x = 1e8 + rnorm(20, 0, 1e-3), y = 1e8 + rnorm(20, 0, 1e-3)),
  list(x = rnorm(15, 0, 1e-200), y = rnorm(15, 0, 1e-200)),
  list(x = rnorm(15, 0, 1e200), y = rnorm(15, 0, 1e200)),
  local({ x <- rnorm(30); list(x = x, y = x + rnorm(30, 0, 1e-4)) }),
  local({ x <- rnorm(30); list(x = x, y = -x + rnorm(30, 0, 1e-7)) })
)
large <- list(pair(200, 0.1), pair(1290, 0.05), pair(1291, 0.05), pair(1500, 0.08))

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
alts <- c("two.sided", "less", "greater")
for (s in c(small, ties, special)) {
  for (alt in alts) {
    add(x = s$x, y = s$y, alternative = alt)
    for (ex in list(NULL, TRUE, FALSE)) for (cc in c(FALSE, TRUE)) for (m in c("kendall", "spearman")) {
      add(x = s$x, y = s$y, alternative = alt, method = m, exact = ex, continuity = if (cc) TRUE else NULL)
    }
  }
  for (cl in c(0, 0.5, 0.9, 0.99, 1)) for (alt in alts) add(x = s$x, y = s$y, alternative = alt, confLevel = cl)
}
for (s in large) for (alt in alts) {
  add(x = s$x, y = s$y, alternative = alt)
  add(x = s$x, y = s$y, alternative = alt, method = "kendall")
  for (ex in list(NULL, TRUE, FALSE)) for (cc in c(FALSE, TRUE)) {
    add(x = s$x, y = s$y, alternative = alt, method = "spearman", exact = ex, continuity = if (cc) TRUE else NULL)
  }
}
# Kendall exact method with n >= 50
for (alt in alts) add(x = large[[1]]$x[1:100], y = large[[1]]$y[1:100], alternative = alt, method = "kendall", exact = TRUE)
# Abbreviations; out-of-range confLevel with Kendall (not checked since it is not Pearson)
add(x = c(1, 2, 3, 4, 5), y = c(2, 1, 3, 5, 4), method = "k", alternative = "g")
add(x = c(1, 2, 3, 4, 5), y = c(2, 1, 3, 5, 4), method = "s", alternative = "l")
add(x = c(1, 2, 3, 4, 5), y = c(2, 1, 3, 5, 4), method = "kendall", confLevel = 2)
# Errors
add(x = c(1, 2, 3), y = c(1, 2))
add(x = c(1, 2), y = c(2, 1))
add(x = c(1, NA, 3), y = c(2, 1, 3))
add(x = 1, y = 2, method = "kendall")
add(x = c(1, NA), y = c(2, 1), method = "spearman")
add(x = c(1, 2, 3, 4, 5), y = c(2, 1, 3, 5, 4), confLevel = 1.5)
add(x = c(1, 2, 3, 4, 5), y = c(2, 1, 3, 5, 4), alternative = "x")
add(x = c(1, 2, 3, 4, 5), y = c(2, 1, 3, 5, 4), method = "x")

opt <- function(v, d) if (is.null(v)) d else v
cor_test <- function(a) cor.test(a$x, a$y, alternative = opt(a$alternative, "two.sided"),
                                 method = opt(a$method, "pearson"), exact = a$exact,
                                 conf.level = opt(a$confLevel, 0.95), continuity = isTRUE(a$continuity))

# Reference: compute the correlation coefficient with Rmpfr and derive the statistic, p-value and interval from it
# (near perfect correlation R's cor is off by a few ulp in 1 - r, which affects the t statistic)
mp_cor <- function(x, y) {
  dx <- mp(x) - mp_mean(x); dy <- mp(y) - mp_mean(y)
  sum(dx * dy) / sqrt(sum(dx^2) * sum(dy^2))
}
p_t <- function(t, df, alt) switch(alt, less = pt(t, df), greater = pt(t, df, lower.tail = FALSE),
                                   2 * min(pt(t, df), pt(t, df, lower.tail = FALSE)))
# AS 89 Edgeworth series in Rmpfr (for lower = TRUE, without subtracting 1 - P(S >= is))
as89_mp <- function(n, is, lower) {
  js <- if (is %% 2 != 0) is + 1 else is
  b <- mp(1) / n
  x <- (6 * (js - 1) * b / (n * n - 1) - 1) * sqrt(1 / b - 1)
  y <- x * x
  cc <- mp(c(0.2274, 0.2531, 0.1745, 0.0758, 0.1033, 0.3932, 0.0879, 0.0151, 0.0072, 0.0831, 0.0131, 4.6e-4))
  u <- x * b * (cc[1] + b * (cc[2] + cc[3] * b) + y * (-cc[4] + b * (cc[5] + cc[6] * b) -
       y * b * (cc[7] + cc[8] * b - y * (cc[9] - cc[10] * b + y * b * (cc[11] - cc[12] * y)))))
  e <- u / exp(y / 2)
  p <- if (lower) Rmpfr::pnorm(x) - e else e + Rmpfr::pnorm(x, lower.tail = FALSE)
  min(1, max(0, Rmpfr::asNumeric(p)))
}
# Frequencies of inversion counts (permutations of n with 0..n(n-1)/2 inversions), as Rmpfr integers via a recurrence
KENDALL_COUNTS <- list()
kendall_counts <- function(n) {
  key <- as.character(n)
  if (!is.null(KENDALL_COUNTS[[key]])) return(KENDALL_COUNTS[[key]])
  cnt <- Rmpfr::mpfr(1, 1024)
  for (j in seq_len(n)[-1]) {
    # Inserting the next element adds 0..j-1 inversions
    len <- length(cnt) + j - 1
    cs <- cumsum(c(cnt, Rmpfr::mpfr(rep(0, j - 1), 1024)))
    lag <- c(Rmpfr::mpfr(rep(0, j), 1024), cs)[seq_len(len)]
    cnt <- cs - lag
  }
  KENDALL_COUNTS[[key]] <<- cnt
  cnt
}
cor_ref <- function(a) {
  alt <- opt(a$alternative, "two.sided"); m <- opt(a$method, "pearson")
  m <- c("pearson", "kendall", "spearman")[pmatch(m, c("pearson", "kendall", "spearman"))]
  ok <- !is.na(a$x) & !is.na(a$y); x <- a$x[ok]; y <- a$y[ok]; n <- length(x)
  if (any(!is.finite(c(x, y)))) return(NULL)
  if (m == "kendall") {
    # Exact p-value without ties from Rmpfr integer counts (R computes the upper tail as 1 - lower and loses digits)
    tied <- anyDuplicated(x) > 0 || anyDuplicated(y) > 0
    exact <- if (is.null(a$exact)) n < 50 else a$exact
    if (!exact || tied || n < 2) return(NULL)
    s <- sum(sapply(seq_len(n), function(i) sum(sign(x[i] - x[-seq_len(i)]) * sign(y[i] - y[-seq_len(i)]))))
    total <- n * (n - 1) / 2; q <- (s + total) / 2
    cnt <- kendall_counts(n); fact <- sum(cnt)
    lo <- Rmpfr::asNumeric(sum(cnt[seq_len(q + 1)]) / fact)
    up <- Rmpfr::asNumeric(sum(cnt[(q + 1):(total + 1)]) / fact)
    return(list(pValue = num2str(switch(alt, less = lo, greater = up, min(1, 2 * min(lo, up))))))
  }
  if (m == "spearman") { x <- rank(x); y <- rank(y) }
  if (all(x == x[1]) || all(y == y[1])) return(NULL)
  r <- mp_cor(x, y)
  if (m == "pearson") {
    t <- sqrt(mp(n - 2)) * r / sqrt(1 - r^2)
    out <- list(statistic = num2str(Rmpfr::asNumeric(t)), estimate = num2str(Rmpfr::asNumeric(r)),
                pValue = num2str(p_t(Rmpfr::asNumeric(t), n - 2, alt)))
    if (n > 3) {
      cl <- opt(a$confLevel, 0.95); z <- atanh(r); s <- 1 / sqrt(mp(n - 3))
      ci <- switch(alt, less = c(-1, Rmpfr::asNumeric(tanh(z + s * qnorm(cl)))),
                   greater = c(Rmpfr::asNumeric(tanh(z - s * qnorm(cl))), 1),
                   { q <- qnorm((1 + cl) / 2); Rmpfr::asNumeric(tanh(z + c(-1, 1) * s * q)) })
      out$confInt <- I(num2str(ci))
    }
    return(out)
  }
  n3 <- mp(n)^3 - n
  S <- n3 * (1 - r) / 6
  out <- list(statistic = num2str(Rmpfr::asNumeric(S)), estimate = num2str(Rmpfr::asNumeric(r)))
  tied <- anyDuplicated(a$x[ok]) > 0 || anyDuplicated(a$y[ok]) > 0
  exact <- if (is.null(a$exact)) n <= 1290 else a$exact
  if (exact && !tied && n <= 1290) {
    if (n <= 9) return(out)
    q <- round(Rmpfr::asNumeric(S)); mx <- n * (n^2 - 1) / 3
    lo <- if (q + 1 > mx) 1 else as89_mp(n, q + 1, TRUE)
    up <- if (q <= 0) 1 else if (q > mx) 0 else as89_mp(n, q, FALSE)
    out$pValue <- num2str(switch(alt, greater = lo, less = up, min(1, 2 * min(lo, up))))
  } else {
    if (isTRUE(a$continuity)) { d <- 6 / n3; r <- (r + d) / (1 + d) }
    t <- r * sqrt((n - 2) / (1 - r^2))
    out$pValue <- num2str(p_t(Rmpfr::asNumeric(t), n - 2, alt))
  }
  out
}

write_htest_fixture("corTest", cases, function(a) htest_fields(cor_test(a)), cor_ref)

# cor (correlation coefficient of two vectors)
cor_cases <- list()
for (s in c(small, ties, special, large)) for (m in c("pearson", "kendall", "spearman")) {
  cor_cases[[length(cor_cases) + 1]] <- list(x = s$x, y = s$y, method = m)
}
cor_cases[[length(cor_cases) + 1]] <- list(x = c(1, 2, 3), y = c(3, 1, 2))
cor_cases[[length(cor_cases) + 1]] <- list(x = 1, y = 2)
cor_cases[[length(cor_cases) + 1]] <- list(x = I(numeric(0)), y = I(numeric(0)))
cor_cases[[length(cor_cases) + 1]] <- list(x = c(1, 2, 3), y = c(1, 2), method = "kendall")
cor_cases[[length(cor_cases) + 1]] <- list(x = c(1, 2, 3), y = c(1, 2, 4), method = "x")
write_htest_fixture("cor", cor_cases, function(a) {
  list(value = num2str(cor(unclass(a$x), unclass(a$y), method = opt(a$method, "pearson"))))
}, function(a) {
  m <- opt(a$method, "pearson")
  if (m == "kendall" || any(is.na(c(a$x, a$y))) || any(!is.finite(c(a$x, a$y))) || length(a$x) < 2) return(NULL)
  x <- unclass(a$x); y <- unclass(a$y)
  if (m == "spearman") { x <- rank(x); y <- rank(y) }
  if (all(x == x[1]) || all(y == y[1])) return(NULL)
  list(value = num2str(Rmpfr::asNumeric(mp_cor(x, y))))
})
