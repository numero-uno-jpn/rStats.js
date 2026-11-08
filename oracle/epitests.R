source("/oracle/_htest.R")

# Diagnostic 2 x 2 measures: epiR::epi.tests (fixture epiTests). See oracle/roc-behaviour.md, section 9.
#
# args: table = [[a, b], [c, d]] with rows test +/-, columns disease +/- (epiR's orientation: a = true positives,
# b = false positives, c = false negatives, d = true negatives), method ("exact" default, "wilson", "agresti",
# "clopper-pearson", "jeffreys"), confLevel.
# expected: one field per row of epi.tests()$detail, named as epiR's `statistic` column, each [est, lower, upper];
# warnings. Where epiR's "exact" limits lose digits (they are computed as 1 - qbeta(...), which cancels when the limit
# is small), the case has a `reference` with the same fields from qbeta directly (refKind "cancellation"; only the
# fields that differ by more than 1e-13 relative are listed).

# oracle-memory: 1g

suppressPackageStartupMessages(library(epiR))

set.seed(20261112)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
tabs <- list(
  matrix(c(670, 202, 74, 640), 2, byrow = TRUE),       # epiR's example
  matrix(c(25, 10, 5, 60), 2, byrow = TRUE),
  matrix(c(1, 2, 3, 4), 2, byrow = TRUE),
  matrix(c(48, 3, 2, 47), 2, byrow = TRUE),
  matrix(c(10, 0, 3, 20), 2, byrow = TRUE),           # b = 0: sp = 1
  matrix(c(10, 5, 0, 20), 2, byrow = TRUE),           # c = 0: se = 1
  matrix(c(0, 5, 10, 20), 2, byrow = TRUE),           # a = 0
  matrix(c(10, 5, 8, 0), 2, byrow = TRUE),            # d = 0
  matrix(c(5, 0, 0, 5), 2, byrow = TRUE),             # perfect test
  matrix(c(1, 0, 1e7 - 1, 5), 2, byrow = TRUE),       # se = 1e-7: exact lower limit cancels
  matrix(c(3, 1e6 - 2, 2, 7), 2, byrow = TRUE),
  matrix(c(9e5, 10, 1e5, 2e6), 2, byrow = TRUE)
)
for (i in 1:6) tabs[[length(tabs) + 1]] <- matrix(rpois(4, sample(c(5, 50, 500), 1)) + 1, 2)
methods <- c("exact", "wilson", "agresti", "clopper-pearson", "jeffreys")
for (t in tabs) for (m in methods) add(table = t, method = m)
for (cl in c(0.5, 0.9, 0.99, 0.999999)) for (m in methods) add(table = tabs[[2]], method = m, confLevel = cl)
add(table = tabs[[1]])
add(table = tabs[[1]], method = "exa")
add(table = tabs[[1]], method = "foo")
add(table = tabs[[1]], confLevel = 1)
add(table = tabs[[1]], confLevel = 1.2)
add(table = matrix(c(0, 0, 3, 4), 2, byrow = TRUE))   # no diseased: NaN se
add(table = matrix(c(2.5, 1, 3, 4), 2, byrow = TRUE))

run <- function(a) {
  r <- call_with(epi.tests, list(dat = as.table(a$table), method = a$method, conf.level = a$confLevel))
  d <- r$detail
  out <- lapply(seq_len(nrow(d)), function(i) I(num2str(c(d$est[i], d$lower[i], d$upper[i]))))
  names(out) <- as.character(d$statistic)
  out
}
# Clopper-Pearson limits from qbeta directly, for the rows that use zexact
epi_ref <- function(a) {
  if (!(is.null(a$method) || identical(a$method, "exact"))) return(NULL)
  got <- run(a)
  t <- a$table; A <- t[1, 1]; B <- t[1, 2]; C <- t[2, 1]; D <- t[2, 2]
  cl <- if (is.null(a$confLevel)) 0.95 else a$confLevel
  if (any(t != round(t))) return(NULL)
  cp <- function(x, n) {
    lo <- if (x == 0) 0 else qbeta((1 - cl) / 2, x, n - x + 1)
    up <- if (x == n) 1 else qbeta(1 - (1 - cl) / 2, x + 1, n - x)
    c(x / n, lo, up)
  }
  ex <- list(ap = cp(A + B, A + B + C + D), tp = cp(A + C, A + B + C + D), se = cp(A, A + C), sp = cp(D, B + D),
             diag.ac = cp(A + D, A + B + C + D), pv.pos = cp(A, A + B), pv.neg = cp(D, C + D),
             p.rout = cp(C + D, A + B + C + D), p.rin = cp(A + B, A + B + C + D), p.tpdn = cp(B, B + D),
             p.tndp = cp(C, A + C), p.dntp = cp(B, A + B), p.dptn = cp(C, C + D))
  diff <- list()
  for (nm in names(ex)) {
    g <- as.numeric(unclass(got[[nm]])); e <- ex[[nm]]
    rel <- ifelse(is.nan(g) & is.nan(e), 0, ifelse(g == e, 0, abs(g - e) / abs(e)))
    if (any(is.na(rel) | rel > 1e-13)) diff[[nm]] <- I(num2str(e))
  }
  if (length(diff) == 0) return(NULL)
  c(list(refKind = "cancellation"), diff)
}
write_htest_fixture("epiTests", cases, run, epi_ref, warnings = TRUE)
