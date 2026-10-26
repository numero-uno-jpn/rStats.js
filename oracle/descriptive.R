source("/oracle/_linalg.R")

# Descriptive statistics (R's base and stats, and e1071 / DescTools for what R lacks).
# Same format as the hypothesis-test fixtures: expected holds numeric fields only (value, and a few named parts).
# Argument names are the JS names (naRm for na.rm, tiesMethod for ties.method, ...).

set.seed(20261024)
samples <- list(
  c(2.5, 1, 4, 3.5, 2),
  rnorm(10),
  rnorm(101, 50, 10),
  c(3, 1, 2, 2, 3, 3, 5, 1),            # ties
  c(7, 7, 7, 7),                        # all equal
  c(4.2),                               # length 1
  c(1, 2),                              # length 2
  1e8 + rnorm(20, 0, 1e-3),             # cancellation
  rnorm(15, 0, 1e-200),                 # tiny scale
  rnorm(15, 0, 1e200),                  # huge scale (squares overflow)
  rexp(40),                             # skewed
  round(rnorm(30, 10, 3)),              # integers with ties
  c(-3, 0, 0, 2, 8, -1, 0, 5)           # zeros and negatives
)
with_na <- list(c(1, NA, 3, 4, NaN, 2), c(NA_real_, NA_real_))
special <- list(c(1, Inf, 3), c(-Inf, 2, Inf), numeric(0))
# (added later; their cases come at the end of each fixture) sums and products that overflow or underflow a
# double on the way: R accumulates in long double
overflow <- list(c(1e308, 1e308, 1e308), c(1e308, 1e308, -1e308), c(1.5e308, -1e308, 1.5e308), c(1.5e308, 1.7e308),
                 c(-1.7e308, -1.5e308), c(1e308, 1e308), c(1e308, 1e308, 1e308, 1, 2), c(1e308, 10, 0.1),
                 c(1e-308, 1e-10, 1e10), c(1e308, 1e308, NA, -1e308), c(1e308, 1e308, Inf),
                 c(.Machine$double.xmax, .Machine$double.xmax, -.Machine$double.xmax, 1, 3))

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
v <- function(x) vec_out(x)
s <- function(x) num2str(unname(x))
all_samples <- c(samples, special)

# --- sum, prod, mean (trim), var, sd, median, range, min, max ---------------------------------------------
basic <- function(name, f, extra = list(list()), more = list()) {
  cases <<- list()
  for (x in all_samples) for (e in extra) do.call(add, c(list(x = I(x)), e))
  for (x in with_na) for (e in extra) for (nr in c(FALSE, TRUE)) do.call(add, c(list(x = I(x), naRm = nr), e))
  for (x in more) for (e in extra) do.call(add, c(list(x = I(x)), e))
  write_htest_fixture(name, cases, f)
}
basic("sum", function(a) list(value = s(sum(a$x, na.rm = isTRUE(a$naRm)))), more = overflow)
basic("prod", function(a) list(value = s(prod(a$x, na.rm = isTRUE(a$naRm)))), more = overflow)
basic("mean", function(a) list(value = s(mean(a$x, trim = if (is.null(a$trim)) 0 else a$trim, na.rm = isTRUE(a$naRm)))),
      extra = list(list(), list(trim = 0.1), list(trim = 0.25), list(trim = 0.5), list(trim = 0.6), list(trim = -0.1)), more = overflow)
basic("var", function(a) list(value = s(var(a$x, na.rm = isTRUE(a$naRm)))))
basic("sd", function(a) list(value = s(sd(a$x, na.rm = isTRUE(a$naRm)))))
basic("median", function(a) list(value = s(median(a$x, na.rm = isTRUE(a$naRm)))), more = overflow)
basic("range", function(a) list(value = v(suppressWarnings(range(a$x, na.rm = isTRUE(a$naRm))))))

# weighted.mean
cases <- list()
for (x in samples) if (length(x) > 1) {
  add(x = I(x), w = I(runif(length(x))))
  add(x = I(x), w = I(rep(1, length(x))))
  add(x = I(x), w = I(c(0, rep(2, length(x) - 1))))
}
add(x = I(c(1, NA, 3)), w = I(c(1, 1, 1)))
add(x = I(c(1, NA, 3)), w = I(c(1, 1, 1)), naRm = TRUE)
add(x = I(c(1, 2, 3)), w = I(c(0, 0, 0)))
add(x = I(c(1, 2, 3)), w = I(c(1, 2)))
# (added later, at the end) products and sums that overflow
add(x = I(c(1e308, 1e308, -1e308)), w = I(c(1, 1, 1)))
add(x = I(c(1.5e308, 1e308)), w = I(c(1, 1)))
add(x = I(c(1e308, 1e308)), w = I(c(0.5, 0.5)))
add(x = I(c(1e308, 5)), w = I(c(2, 1)))
add(x = I(c(1e308, 1e308, 3)), w = I(c(1, 1, 0)))
write_htest_fixture("weightedMean", cases, function(a)
  list(value = s(weighted.mean(a$x, a$w, na.rm = isTRUE(a$naRm)))))

# --- quantile (types 1-9), IQR, fivenum, mad --------------------------------------------------------------
probs <- c(0, 0.01, 0.1, 0.25, 1 / 3, 0.5, 0.75, 0.9, 0.99, 1)
cases <- list()
for (x in c(samples, list(c(1, Inf, 3)))) for (type in 1:9) add(x = I(x), probs = I(probs), type = type)
for (x in with_na) for (type in c(1, 7)) {
  add(x = I(x), probs = I(c(0.25, 0.5)), type = type, naRm = TRUE)
  add(x = I(x), probs = I(c(0.25, 0.5)), type = type, naRm = FALSE)
}
add(x = I(numeric(0)), probs = I(c(0.5)), type = 7)
add(x = I(c(1, 2, 3)), probs = I(c(-0.1)), type = 7)
add(x = I(c(1, 2, 3)), probs = I(c(1.5)), type = 7)
add(x = I(c(1, 2, 3)), probs = I(c(0.5)), type = 10)
write_htest_fixture("quantile", cases, function(a)
  list(value = v(quantile(a$x, a$probs, type = a$type, na.rm = isTRUE(a$naRm), names = FALSE))))

cases <- list()
for (x in samples) for (type in c(1, 6, 7, 9)) add(x = I(x), type = type)
add(x = I(c(1, NA, 3, 8)), type = 7, naRm = TRUE)
add(x = I(c(1, NA, 3, 8)), type = 7)
write_htest_fixture("IQR", cases, function(a) list(value = s(IQR(a$x, type = a$type, na.rm = isTRUE(a$naRm)))))

cases <- list()
for (x in c(all_samples, with_na)) add(x = I(x))
write_htest_fixture("fivenum", cases, function(a) list(value = v(fivenum(a$x))))

cases <- list()
for (x in samples) {
  add(x = I(x))
  add(x = I(x), constant = 1)
  add(x = I(x), center = 0)
  add(x = I(x), low = TRUE)
  add(x = I(x), high = TRUE)
}
add(x = I(c(1, NA, 3, 8)), naRm = TRUE)
add(x = I(c(1, NA, 3, 8)))
# (added later, at the end) low/high: only for an even count, which includes the missing values unless removed
add(x = I(c(1, 2, NA, 4)), center = 3, low = TRUE)
add(x = I(c(1, 2, NA, 4)), center = 3, high = TRUE)
add(x = I(c(1, NA, NA, 4)), center = 0, low = TRUE)
add(x = I(c(1, NA, NA, 4)), center = 0, high = TRUE)
add(x = I(c(NA, NA)), center = 0, low = TRUE)
add(x = I(c(1, 2, NA, 4)), low = TRUE)
add(x = I(c(1, 2, NA, 4)), center = 3, low = TRUE, naRm = TRUE)
add(x = I(c(1, 2, NA, 4, 9)), center = 3, low = TRUE)
add(x = I(numeric(0)), low = TRUE)
add(x = I(numeric(0)), high = TRUE)
add(x = I(c(1, 2, 3)), low = TRUE, high = TRUE)
add(x = I(c(1, 2, 3, 4)), low = TRUE, high = TRUE)
write_htest_fixture("mad", cases, function(a)
  # unclass: an AsIs x would make R's sort ignore `partial` (the object method), which changes the low/high results
  list(value = s(call_with(mad, list(x = unclass(a$x), center = a$center, constant = a$constant,
                                     na.rm = isTRUE(a$naRm), low = isTRUE(a$low), high = isTRUE(a$high))))))

# --- cumsum, cumprod, cummax, cummin, diff ----------------------------------------------------------------
for (fn in c("cumsum", "cumprod", "cummax", "cummin")) {
  cases <- list()
  for (x in c(all_samples, with_na)) add(x = I(x))
  for (x in overflow) add(x = I(x))
  f <- get(fn)
  write_htest_fixture(fn, cases, function(a) list(value = v(f(a$x))))
}
cases <- list()
for (x in c(samples, with_na)) for (lag in 1:2) for (d in 1:2) add(x = I(x), lag = lag, differences = d)
add(x = I(c(1, 2, 3)), lag = 0, differences = 1)
write_htest_fixture("diff", cases, function(a) list(value = v(diff(a$x, lag = a$lag, differences = a$differences))))

# --- rank -------------------------------------------------------------------------------------------------
cases <- list()
for (x in c(samples, list(c(2, NA, 1, 2, NaN)))) for (tm in c("average", "first", "last", "max", "min"))
  for (nl in c("keep", "last", "first")) add(x = I(x), tiesMethod = tm, naLast = nl)
write_htest_fixture("rank", cases, function(a) {
  nl <- switch(a$naLast, keep = "keep", last = TRUE, first = FALSE)
  list(value = v(rank(a$x, ties.method = a$tiesMethod, na.last = nl)))
})

# --- cov, cor (vectors and matrices; pearson, spearman, kendall; use) --------------------------------------
cases <- list()
m1 <- rmat(12, 3); m2 <- cbind(round(rnorm(10)), round(rnorm(10)), rnorm(10))
mna <- m1; mna[2, 1] <- NA; mna[5, 3] <- NA
for (method in c("pearson", "spearman", "kendall")) {
  add(x = I(samples[[2]]), y = I(rev(samples[[2]])), method = method)
  add(x = m1, method = method)
  add(x = m2, method = method)
  add(x = m1, y = m2[1:12 %% 10 + 1, ], method = method)
  for (use in c("everything", "all.obs", "complete.obs", "pairwise.complete.obs")) add(x = mna, method = method, use = use)
}
add(x = cbind(1e8 + rnorm(10, 0, 1e-3), 1e8 + rnorm(10, 0, 1e-3)), method = "pearson")
add(x = cbind(c(1, 1, 1), c(1, 2, 3)), method = "pearson")
# (added later, at the end) fewer than 2 observations: all NaN, the diagonal too
mfew <- cbind(c(1, NA, 3, 4), c(2, 5, NA, NA), c(1, 2, 3, 5))
for (method in c("pearson", "spearman", "kendall")) {
  add(x = matrix(c(1, 2, 3), 1), method = method)
  for (use in c("everything", "complete.obs", "pairwise.complete.obs")) add(x = mfew, method = method, use = use)
  add(x = cbind(c(1, 1, 1), c(1, 2, 3)), method = method)
}
# The fixture name "cor" is taken by oracle/cor.R (correlation of two vectors), so the matrix version is corMatrix
for (fn in c("cov", "cor")) {
  f <- get(fn)
  write_htest_fixture(if (fn == "cor") "corMatrix" else fn, cases, function(a) {
    r <- call_with(f, list(x = a$x, y = a$y, method = a$method, use = a$use))
    list(value = if (is.matrix(r)) mat_out(r) else s(r))
  })
}

# --- scale ------------------------------------------------------------------------------------------------
cases <- list()
for (m in list(m1, m2, mna, matrix(c(1, 1, 1, 2, 3, 4), 3, 2))) for (ce in c(TRUE, FALSE)) for (sc in c(TRUE, FALSE))
  add(x = m, center = ce, scale = sc)
add(x = m1, center = I(c(1, 2, 3)), scale = I(c(2, 2, 2)))
write_htest_fixture("scale", cases, function(a) {
  r <- scale(a$x, center = a$center, scale = a$scale)
  out <- list(value = mat_out(r))
  if (!is.null(attr(r, "scaled:center"))) out$center <- vec_out(attr(r, "scaled:center"))
  if (!is.null(attr(r, "scaled:scale"))) out$scale <- vec_out(attr(r, "scaled:scale"))
  out
})

# --- tabulate, table (counts of the distinct values), unique ----------------------------------------------
cases <- list()
for (x in list(c(1, 2, 2, 5), c(3, 3, 0, -1, 2, 7), c(1.7, 2.2, 2.9), c(1, NA, 2))) {
  add(bin = I(x))
  add(bin = I(x), nbins = 3)
}
# (added later, at the end) nbins is truncated; negative, NaN and huge values are errors
for (nb in c(2.5, 2.9, -0.5, 0, -1, NaN, Inf, 3e9)) add(bin = I(c(1, 2, 2, 3)), nbins = nb)
write_htest_fixture("tabulate", cases, function(a)
  list(value = v(call_with(tabulate, list(bin = a$bin, nbins = a$nbins)))))

cases <- list()
for (x in c(samples[c(1, 4, 5, 12, 13)], list(c(2, NA, 1, 2, NaN)))) for (ex in c("no", "ifany", "always"))
  add(x = I(x), useNA = ex)
# (added later, at the end) numbers with the same 15-digit text are one level (R's factor uses as.character)
for (x in list(c(0.1 + 0.2, 0.3, 1 / 3, 0.3333333333333333), c(1e15, 1e15 + 1, 1e15),
               c(1 / 3, 0.3333333333333331, 0.3333333333333333), c(0.3, NA, 0.1 + 0.2, 0.7, 0.1 * 7),
               c(-0, 0, 1e-300, 2)))
  for (ex in c("no", "ifany")) add(x = I(x), useNA = ex)
write_htest_fixture("table", cases, function(a) {
  t <- table(a$x, useNA = a$useNA)
  # values: the distinct values in table order (NA last); counts: their frequencies
  list(values = v(as.numeric(names(t))), counts = v(as.vector(t)))
})

cases <- list()
for (x in c(samples, with_na, list(c(0, -0, 1)))) add(x = I(x))
write_htest_fixture("unique", cases, function(a) list(value = v(unique(a$x))))

# --- cut (codes), findInterval, hist, ecdf ----------------------------------------------------------------
cases <- list()
xs <- c(samples[[3]], NA)
for (br in list(4, 10, I(c(0, 40, 50, 60, 100)), I(c(30, 50, 70)))) for (right in c(TRUE, FALSE))
  for (il in c(FALSE, TRUE)) add(x = I(xs), breaks = br, right = right, includeLowest = il)
add(x = I(c(1, 2, 3)), breaks = I(c(1, 2, 3)))
add(x = I(c(1, 1, 1)), breaks = 3)
add(x = I(c(1, 2)), breaks = 1)
# (added later, at the end) NaN among the breaks is dropped; data without a finite range
add(x = I(c(1, 2, 3)), breaks = I(c(0, NaN, 2, 4)))
add(x = I(c(1, 2, 3, 5)), breaks = I(c(4, NaN, 0, NaN, 2)), right = FALSE)
add(x = I(c(1, 2, 3)), breaks = I(c(NaN, 2)))
add(x = I(c(1, 2, 3)), breaks = I(c(NaN, NaN)))
add(x = I(c(1, 2, 3)), breaks = I(c(0, NaN, 2, 2)))
add(x = I(c(1, 2, 3)), breaks = NaN)
add(x = I(c(NaN, NaN)), breaks = 2)
add(x = I(c(1, Inf, 3)), breaks = 3)
add(x = I(c(-Inf, 1)), breaks = 3)
add(x = I(c(-Inf, Inf)), breaks = 3)
add(x = I(c(Inf, Inf, NaN)), breaks = 3)
add(x = I(c(1, NaN)), breaks = 2)
write_htest_fixture("cut", cases, function(a)
  list(value = v(as.integer(cut(a$x, breaks = a$breaks, labels = FALSE, right = !isFALSE(a$right),
                                include.lowest = isTRUE(a$includeLowest))))))

cases <- list()
vec <- c(0, 1, 2.5, 4, 4, 7)
xq <- c(-1, 0, 0.5, 1, 2.5, 3, 4, 6.9, 7, 8, NA)
for (rc in c(FALSE, TRUE)) for (ai in c(FALSE, TRUE)) for (lo in c(FALSE, TRUE))
  add(x = I(xq), vec = I(vec), rightmostClosed = rc, allInside = ai, leftOpen = lo)
# (added later, at the end) one break point and none: the boundary rules apply separately
for (v1 in list(1, numeric(0), c(1, 1))) for (rc in c(FALSE, TRUE)) for (ai in c(FALSE, TRUE)) for (lo in c(FALSE, TRUE))
  add(x = I(c(0, 1, 2, NA)), vec = I(v1), rightmostClosed = rc, allInside = ai, leftOpen = lo)
write_htest_fixture("findInterval", cases, function(a)
  list(value = v(findInterval(a$x, a$vec, rightmost.closed = a$rightmostClosed, all.inside = a$allInside,
                              left.open = a$leftOpen))))

cases <- list()
for (x in samples[c(2, 3, 11, 12, 13)]) {
  add(x = I(x))
  add(x = I(x), breaks = "Scott")
  add(x = I(x), breaks = "FD")
  add(x = I(x), breaks = 5)
  add(x = I(x), breaks = I(pretty(range(x), 7)), right = FALSE)
}
add(x = I(c(7, 7, 7)))
add(x = I(c(1, 2, 10)), breaks = I(c(0, 5, 20)))
add(x = I(c(1, 2, 30)), breaks = I(c(0, 5, 20)))
write_htest_fixture("hist", cases, function(a) {
  h <- call_with(hist, list(x = a$x, breaks = if (is.null(a$breaks)) "Sturges" else a$breaks,
                            right = !isFALSE(a$right), plot = FALSE))
  list(breaks = v(h$breaks), counts = v(h$counts), density = v(h$density), mids = v(h$mids))
})

cases <- list()
for (x in samples[c(1, 4, 11, 12)]) add(x = I(x), q = I(c(min(x) - 1, x[1:3], mean(x), max(x), max(x) + 1)))
write_htest_fixture("ecdf", cases, function(a) list(value = v(ecdf(a$x)(a$q))))

# --- not in R: e1071 skewness / kurtosis, DescTools Gmean / Mode / MeanAD / CoefVar -----------------------
cases <- list()
for (x in c(samples[-c(5, 6)], list(c(1, NA, 3, 8)))) for (type in 1:3) add(x = I(x), type = type)
write_htest_fixture("skewness", cases, function(a)
  list(value = s(e1071::skewness(a$x, na.rm = TRUE, type = a$type))))
write_htest_fixture("kurtosis", cases, function(a)
  list(value = s(e1071::kurtosis(a$x, na.rm = TRUE, type = a$type))))

cases <- list()
for (x in list(c(2, 8), c(1, 3, 9, 27), rexp(20), c(1e300, 1e300), c(1e-300, 1e-300, 4e-300), c(1, 0, 4),
               c(1, -1, 4), c(1, NA, 4)))
  for (nr in c(FALSE, TRUE)) add(x = I(x), naRm = nr)
write_htest_fixture("geometricMean", cases, function(a) list(value = s(DescTools::Gmean(a$x, na.rm = a$naRm))))

cases <- list()
for (x in c(samples[c(1, 4, 5, 6, 12, 13)], list(c(1, 2, 2, 3, 3), c(1, NA, NA, 2), c(5, 4, 3)))) add(x = I(x))
write_htest_fixture("modes", cases, function(a) {
  m <- DescTools::Mode(a$x, na.rm = TRUE)
  # value: all the most frequent values (ascending); frequency: their count. DescTools returns NA if all
  # values occur once
  list(value = v(as.vector(m)), frequency = s(attr(m, "freq")))
})

cases <- list()
for (x in samples) {
  add(x = I(x))
  add(x = I(x), center = "median")
}
write_htest_fixture("meanAD", cases, function(a)
  list(value = s(if (identical(a$center, "median")) DescTools::MeanAD(a$x, center = median) else
                   DescTools::MeanAD(a$x))))

cases <- list()
for (x in samples[-c(5, 6)]) for (ub in c(FALSE, TRUE)) add(x = I(x), unbiased = ub)
write_htest_fixture("cv", cases, function(a) list(value = s(DescTools::CoefVar(a$x, unbiased = a$unbiased))))
