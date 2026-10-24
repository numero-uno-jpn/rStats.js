source("/oracle/_htest.R")

# One-way analysis of variance table (summary(aov(y ~ g))), TukeyHSD, and BSDA::z.test
# (fixtures aovOneway, TukeyHSD, zTest). Groups are a list of samples, as in oracle/ranktests.R.

set.seed(20261026)
arg_json_vector <- arg_json
arg_json <- function(v) if (is.list(v)) lapply(v, function(g) I(num2str(g))) else arg_json_vector(v)
vec_out <- function(v) I(num2str(unname(as.vector(v))))
as_long <- function(groups) list(y = unlist(groups), g = factor(rep(seq_along(groups), lengths(groups))))

groups_cases <- list(
  list(c(2.9, 3.0, 2.5, 2.6, 3.2), c(3.8, 2.7, 4.0, 2.4), c(2.8, 3.4, 3.7, 2.2, 2.0)),
  list(rnorm(10), rnorm(12, 0.5), rnorm(8, 1)),
  list(rnorm(5, 10), rnorm(5, 10), rnorm(5, 12), rnorm(5, 9), rnorm(5, 10)),
  list(rnorm(30, 1e6, 1e-3), rnorm(30, 1e6 + 1e-3, 1e-3)),
  list(rexp(15) * 1e-200, rexp(15) * 2e-200),
  list(c(1, 2, 3), c(2, 3, 4), c(5, 6, 8)),
  list(c(1, 1, 1), c(2, 2, 2)),                    # no within-group variation
  list(c(4, 4, 4), c(4, 4, 4)),                    # all equal
  list(c(1, 2, NA, 4), c(3, 5, 6)),
  list(c(1, 2, 3), 4),                             # a group of one
  list(round(rnorm(40, 50, 10)), round(rnorm(35, 55, 10)), round(rnorm(38, 52, 10)), round(rnorm(33, 50, 10)))
)

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (g in groups_cases) add(groups = g)
add(groups = list(c(1, 2, 3)))
write_htest_fixture("aovOneway", cases, function(a) {
  d <- as_long(a$groups)
  t <- summary(aov(y ~ g, data = d))[[1]]
  # Rows: between groups, residuals. Columns: Df, Sum Sq, Mean Sq, F value, Pr(>F) (NA on the residual row)
  list(df = vec_out(t[["Df"]]), sumSq = vec_out(t[["Sum Sq"]]), meanSq = vec_out(t[["Mean Sq"]]),
       fValue = num2str(t[["F value"]][1]), pValue = num2str(t[["Pr(>F)"]][1]))
})

cases <- list()
for (g in groups_cases[c(1:6, 9, 11)]) for (cl in c(0.95, 0.99)) add(groups = g, confLevel = cl)
# a group without data (its level is dropped), and samples with group labels (y, g): numeric labels are ordered
# numerically, so 10 comes after 2
yl <- c(1.1, 2.3, 1.9, 3.4, 2.8, 3.9, 5.1, 4.4, 6.0)
add(groups = list(c(1.1, 2.3, 1.9), c(NA, NA), c(5.1, 4.4, 6.0), c(2, 3, 2.5)))
add(y = yl, g = c(1, 1, 1, 2, 2, 2, 10, 10, 10))
add(y = c(1.1, 2.3, 1.9, NA, NA, NA, 5.1, 4.4, 6.0, 2, 3, 2.5), g = c(1, 1, 1, 2, 2, 2, 10, 10, 10, 3, 3, 3))
add(y = yl, g = c("b", "b", "b", "a", "a", "a", "c", "c", "c"), confLevel = 0.9)
write_htest_fixture("TukeyHSD", cases, function(a) {
  d <- if (is.null(a$groups)) data.frame(y = a$y, g = factor(a$g)) else as_long(a$groups)
  r <- TukeyHSD(aov(y ~ g, data = d), conf.level = if (is.null(a$confLevel)) 0.95 else a$confLevel)$g
  # One row per pair, in R's order (2-1, 3-1, ..., k-1, 3-2, ...): names "a-b", positions i > j of the groups
  # compared (levels without data left out), then diff, lwr, upr, p adj
  pairs <- do.call(rbind, strsplit(rownames(r), "-"))
  k <- (1 + sqrt(1 + 8 * nrow(r))) / 2
  lv <- c(pairs[1, 2], pairs[seq_len(k - 1), 1])
  list(names = I(rownames(r)), i = vec_out(match(pairs[, 1], lv)), j = vec_out(match(pairs[, 2], lv)),
       diff = vec_out(r[, "diff"]), lwr = vec_out(r[, "lwr"]), upr = vec_out(r[, "upr"]), pAdj = vec_out(r[, "p adj"]))
})
arg_json <- arg_json_vector

# BSDA::z.test: one sample, two samples (independent), with known standard deviations
cases <- list()
alts <- c("two.sided", "less", "greater")
zs <- list(list(x = rnorm(10, 0.3), y = rnorm(12), sx = 1, sy = 1),
           list(x = rnorm(40, 100, 15), y = rnorm(35, 95, 15), sx = 15, sy = 15),
           list(x = c(1.2, 3.4, 2.2, 5.1), y = c(2, 4, 6, 9, 11, 3), sx = 1.5, sy = 3),
           list(x = 1e8 + rnorm(20, 0, 1e-3), y = 1e8 + rnorm(20, 1e-3, 1e-3), sx = 1e-3, sy = 1e-3),
           list(x = c(rnorm(8), NA), y = c(NA, rnorm(9, 1)), sx = 1, sy = 1))
for (z in zs) for (alt in alts) for (cl in c(0.95, 0.9)) {
  add(x = I(z$x), sigmaX = z$sx, mu = 0, alternative = alt, confLevel = cl)
  add(x = I(z$x), sigmaX = z$sx, mu = 0.5, alternative = alt, confLevel = cl)
  add(x = I(z$x), y = I(z$y), sigmaX = z$sx, sigmaY = z$sy, mu = 0, alternative = alt, confLevel = cl)
}
add(x = I(c(1, 2, 3)), alternative = "two.sided")                  # sigma.x missing
add(x = I(c(1, 2, 3)), sigmaX = -1, alternative = "two.sided")
add(x = I(c(4)), sigmaX = 2, alternative = "two.sided", confLevel = 0.95)
write_htest_fixture("zTest", cases, function(a)
  htest_fields(call_with(BSDA::z.test, list(x = a$x, y = a$y, sigma.x = a$sigmaX, sigma.y = a$sigmaY, mu = a$mu,
                                            alternative = a$alternative, conf.level = a$confLevel))))
