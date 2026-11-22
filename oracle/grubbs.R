# issue: 549
# Full Grubbs oracle; all cases plus R-generated type-20 tables
# tests19-small.R: PMCMRplus 1.9.12 (tamhaneT2Test, pageTest) and outliers 0.15 (grubbs.test, pgrubbs, qgrubbs) on
# small data and boundary cases, public functions only (1.9.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
suppressMessages(library(PMCMRplus))
library(outliers)
library(jsonlite)
# Helpers (the same in each script): run() records the value, the warnings, the messages and the error of one call
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(m))
# the parts of an htest-like result, as numbers and strings
ht <- function(r) list(method = r$method, statistic = r$statistic, statisticNames = names(r$statistic),
                       parameter = r$parameter, parameterNames = names(r$parameter), p.value = r$p.value,
                       alternative = r$alternative, estimate = r$estimate, null.value = r$null.value)
# pairwise results: the lower-triangular matrices of statistics and p-values
pw <- function(r) list(method = r$method, statistic = tab(r$statistic), p.value = tab(r$p.value),
                       p.adjust.method = r$p.adjust.method, dist = r$dist, alternative = r$alternative)
out <- list()

## Grubbs' test (outliers)
x1 <- c(199.31, 199.53, 200.19, 200.82, 201.92, 201.95, 202.18, 245.57)
x2 <- c(-3.1, 0.2, 0.4, 0.5, 0.7, 0.9, 1.1, 1.2, 1.3, 4.8)
x3 <- c(8.1, 8.3, 8.4, 8.6, 8.8, 9.0, 9.1, 12.4, 12.9)
for (xn in c("x1", "x2", "x3")) {
  x <- switch(xn, x1 = x1, x2 = x2, x3 = x3)
  for (type in c(10, 11, 20)) for (opp in c(FALSE, TRUE)) for (ts in c(FALSE, TRUE)) {
    out[[sprintf("grubbs_%s_type%d_opp%d_two%d", xn, type, opp, ts)]] <-
      run(ht(grubbs.test(x, type = type, opposite = opp, two.sided = ts)))
  }
}
out$grubbs_n3 <- run(ht(grubbs.test(c(1, 2, 10))))
out$grubbs_n3_type11 <- run(ht(grubbs.test(c(1, 2, 10), type = 11)))
out$grubbs_n4_type20 <- run(ht(grubbs.test(c(1, 2, 3, 10), type = 20)))
out$grubbs_n30_type20 <- run(ht(grubbs.test(c(seq(1, 2.8, length.out = 28), 9, 10), type = 20)))
out$grubbs_n31_type20 <- run(ht(grubbs.test(c(seq(1, 2.9, length.out = 29), 9, 10), type = 20)))
out$grubbs_n2 <- run(ht(grubbs.test(c(1, 2))))
out$grubbs_constant <- run(ht(grubbs.test(rep(3, 6))))
out$grubbs_na <- run(ht(grubbs.test(c(1, 2, NA, 3, 10))))
out$grubbs_large_n <- run(ht(grubbs.test(c(seq(-2, 2, length.out = 199), 6))))
out$grubbs_tie_extremes <- run(ht(grubbs.test(c(1, 1, 2, 3, 4, 9, 9))))
out$grubbs_symmetric <- run(ht(grubbs.test(c(-5, 0, 0.1, -0.1, 0.2, -0.2, 5))))
out$grubbs_scale <- run(ht(grubbs.test(x1 * 1e100)))
out$grubbs_shift <- run(ht(grubbs.test(x2 + 1e8)))

## pgrubbs and qgrubbs (the distribution functions behind the p-values). They take one value at a time (a vector
## stops with "the condition has length > 1") and pgrubbs has no lower.tail; each value is a call of its own
each <- function(v, f) lapply(v, function(a) run(f(a)))
qs <- c(0.5, 1, 1.5, 2, 2.5, 3, 3.5)
for (type in c(10, 11, 20)) for (n in c(3, 4, 5, 7, 10, 20, 30, 50)) {
  qq <- if (type == 10) qs else if (type == 11) qs + 1.5 else c(0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99)
  out[[sprintf("pgrubbs_type%d_n%d", type, n)]] <- list(q = qq, p = each(qq, function(a) pgrubbs(a, n, type = type)))
  ps <- c(0.001, 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99)
  out[[sprintf("qgrubbs_type%d_n%d", type, n)]] <- list(p = ps, q = each(ps, function(a) qgrubbs(a, n, type = type)),
                                                        qrev = each(ps, function(a) qgrubbs(a, n, type = type, rev = TRUE)))
}
# type 20 on a fine grid of n and q (the tabulated distribution and its interpolation)
for (n in c(4, 6, 8, 9, 11, 15, 16, 25, 29)) {
  qq <- seq(0.02, 0.98, by = 0.04)
  out[[sprintf("pgrubbs_type20_grid_n%d", n)]] <- list(q = qq, p = each(qq, function(a) pgrubbs(a, n, type = 20)))
}

# Type-20 tables generated only from public qgrubbs outputs.
u_grid <- seq(0,1,by=.001)
p_grid <- c(.001,.01,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,.95,.99,.999)
for (nn in 3:30) {
  qv <- vapply(p_grid,function(pp) tryCatch(qgrubbs(pp,nn,type=20),error=function(e) NA_real_),numeric(1))
  pv <- vapply(u_grid,function(uu) tryCatch(qgrubbs(uu,nn,type=20,rev=TRUE),error=function(e) NA_real_),numeric(1))
  out[[paste0("qgrubbs_type20_quantiles_n",nn)]] <- list(p=p_grid,q=qv)
  out[[paste0("qgrubbs_type20_rev_table_n",nn)]] <- list(u=u_grid,p=pv)
}
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
