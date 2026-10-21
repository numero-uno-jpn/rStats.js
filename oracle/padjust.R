source("/oracle/_htest.R")

# p.adjust (holm, hochberg, hommel, bonferroni, BH, BY, fdr, none)

set.seed(20261021)
pvals <- list(
  c(0.01, 0.04, 0.03, 0.2),
  c(0.01, NA, 0.04, 0.03, NA, 0.2),
  runif(10),
  runif(37)^3,
  sort(runif(25)^4),
  c(runif(50)^2, rep(0.5, 5)),
  c(0, 1, 0.5, 0, 1, 0.02),
  c(NaN, 0.3, NaN, 0.001, 1e-300, 0.9),
  c(0.05, 0.05, 0.05, 0.05),
  c(1e-10, 2e-10, 1e-9, 0.04, 0.041, 0.9, 0.95),
  2 * pnorm(-abs(rnorm(200, c(rep(0, 150), rep(3, 50))))),
  c(0.1, 1.5, -0.2, 0.5),
  0.03,
  NA_real_,
  c(NA_real_, NA_real_),
  numeric(0),
  c(0.02, 0.8)
)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (p in pvals) {
  lp <- sum(!is.na(p))
  for (m in p.adjust.methods) {
    add(p = I(p), method = m)
    # n > length(p). For a length-0 p with hommel and n > 0, R returns a length-1 value (1).
    # rStats.js returns length 0 (a difference from R; not included here)
    if (lp > 0 || m != "hommel") add(p = I(p), method = m, n = lp + 3)
    if (lp >= 1) add(p = I(p), method = m, n = 2 * lp + 1)
  }
}
# Default (holm), abbreviations, edge values of n
add(p = I(c(0.01, 0.2, 0.03)))
add(p = I(c(0.01, 0.2, 0.03)), method = "hom")
add(p = I(c(0.01, 0.2, 0.03)), method = "bonf")
add(p = I(c(0.01, 0.2, 0.03)), method = "hoch")
add(p = I(c(0.1, 0.2)), method = "BH", n = 2.5)
add(p = I(c(0.1, 0.2)), method = "holm", n = 2.5)
add(p = I(c(0.3)), method = "hommel", n = 5)
add(p = I(c(0.3, NA)), method = "BH", n = 1)
add(p = I(numeric(0)), method = "BH", n = 0)
# Errors: n too small, invalid method, ambiguous abbreviation
add(p = I(c(0.1, 0.2, 0.3)), method = "holm", n = 2)
add(p = I(c(0.1, NA, 0.3, NA)), method = "BH", n = 1)
add(p = I(c(0.1, 0.2)), method = "h")
add(p = I(c(0.1, 0.2)), method = "B")
add(p = I(c(0.1, 0.2)), method = "xyz")

write_htest_fixture("pAdjust", cases, function(a) {
  r <- if (is.null(a$n)) p.adjust(unclass(a$p), if (is.null(a$method)) "holm" else a$method)
       else p.adjust(unclass(a$p), if (is.null(a$method)) "holm" else a$method, n = a$n)
  list(value = I(num2str(r)))
})
