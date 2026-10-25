source("/oracle/_htest.R")

# lawstat::brunner.munzel.test (fixture brunnerMunzelTest; lawstat 3.6).
#
# Arguments: x, y, alternative, confLevel (lawstat's alpha = 1 - confLevel). lawstat's result has no alternative
# field; its "greater" means that x tends to be larger than y (p = pt(statistic, df), the statistic being positive
# when y has the larger ranks). The confidence interval is two-sided whatever the alternative.
#
# lawstat computes upper tails as 1 - pt(...), which loses the small p-values; the reference holds the p-value
# from pt(..., lower.tail = FALSE) with lawstat's statistic and df.
# Not included: empty samples, for which lawstat indexes r[n1 + 1:0] and returns meaningless numbers.

set.seed(20261104)
alts <- c("two.sided", "less", "greater")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))
draw <- function(n, kind) switch(kind,
  round(rnorm(n), 6),
  as.numeric(sample(0:6, n, replace = TRUE)),
  round(rexp(n) * 10^runif(1, -3, 3), 4))
for (i in 1:150) {
  kind <- sample(c(1, 1, 2, 3), 1)
  x <- draw(sample(2:70, 1), kind)
  y <- draw(sample(2:70, 1), kind) * runif(1, 0.3, 3) + sample(c(0, 0, 0.5, -1), 1)
  add(x = x, y = y, alternative = sample(alts, 1), confLevel = sample(c(0.95, 0.95, 0.9, 0.99), 1))
}
for (alt in alts) {
  add(x = c(1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30), y = c(0.878, 0.647, 0.598, 2.05, 1.06, 1.29, 1.06,
      3.14, 1.29), alternative = alt)
  add(x = c(1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1), y = c(3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4), alternative = alt)
  add(x = rnorm(200), y = rnorm(150, 1.5), alternative = alt)  # tiny p-values
  add(x = c(1.1, 2.3, 0.4), y = c(5.2, -3.1, 7.7, 0.9), alternative = alt)
}
add(x = c(1, 2), y = c(1.5, 3))
add(x = c(1, 3, 2), y = c(4, 6, 5))           # completely separated: zero variance estimates
add(x = c(4, 6, 5), y = c(1, 3, 2))
add(x = c(1, 1, 1), y = c(1, 1, 1, 1))        # all values equal
add(x = c(2, 2, 2), y = c(1, 3, 2, 4))        # no variation within x
add(x = 1, y = c(2, 3, 4))                    # n = 1: lawstat's variance estimate is 0/0
add(x = c(1, 2, NA, 4), y = c(3, NA, 5, 6))   # NA values are removed
add(x = c(0.5, 1.5, 2.5), y = c(1, 2, 3), confLevel = 0.5)

bm <- function(a) lawstat::brunner.munzel.test(a$x, a$y, alternative = a$alternative %||% "two.sided",
                                              alpha = 1 - (a$confLevel %||% 0.95))
write_htest_fixture("brunnerMunzelTest", cases, function(a) htest_fields(bm(a)), ref = function(a) {
  r <- bm(a)
  t <- unname(r$statistic); df <- unname(r$parameter)
  p <- switch(a$alternative %||% "two.sided",
              two.sided = 2 * pt(-abs(t), df), greater = pt(t, df), less = pt(t, df, lower.tail = FALSE))
  list(pValue = num2str(p))
})
