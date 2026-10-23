source("/oracle/_htest.R")

# pairwise.t.test, pairwise.wilcox.test and pairwise.prop.test (fixture pairwise). Expected fields: method and the
# p-value table (rows of the lower triangle, NA above the diagonal).

set.seed(20261030)
alts <- c("two.sided", "less", "greater")
methods <- c("holm", "hochberg", "hommel", "bonferroni", "BH", "BY", "none")
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (i in 1:120) {
  k <- sample(2:6, 1)
  kind <- sample(c("pooled", "welch", "paired", "wilcox", "wilcoxPaired", "prop"), 1)
  adj <- sample(methods, 1)
  if (kind == "prop") {
    n <- sample(5:200, k, TRUE)
    add(kind = kind, x = sapply(n, function(m) sample(0:m, 1)), n = n, pAdjustMethod = adj)
    next
  }
  size <- sample(3:25, 1)
  paired <- kind %in% c("paired", "wilcoxPaired")
  sizes <- if (paired) rep(size, k) else sample(2:25, k, TRUE)
  x <- unlist(lapply(seq_len(k), function(j) round(rnorm(sizes[j], (j - 1) * 0.3, runif(1, 0.5, 2)), 6)))
  if (kind == "wilcox" && runif(1) < 0.4) x <- round(x)
  add(kind = kind, x = x, g = paste0("g", rep(seq_len(k), sizes)), pAdjustMethod = adj, alternative = sample(alts, 1))
}
# the examples of ?pairwise.t.test (airquality Ozone by Month) with missing values
oz <- airquality$Ozone; mo <- paste0("m", airquality$Month)
for (kind in c("pooled", "welch", "wilcox")) add(kind = kind, x = oz, g = mo, pAdjustMethod = "holm")
add(kind = "prop", x = c(83, 90, 129, 70), n = c(86, 93, 136, 82), pAdjustMethod = "holm")
pw_fun <- function(a) {
  args <- list(p.adjust.method = a$pAdjustMethod, alternative = a$alternative)
  r <- switch(a$kind,
    pooled = call_with(pairwise.t.test, c(list(x = a$x, g = a$g), args)),
    welch = call_with(pairwise.t.test, c(list(x = a$x, g = a$g, pool.sd = FALSE), args)),
    paired = call_with(pairwise.t.test, c(list(x = a$x, g = a$g, paired = TRUE), args)),
    wilcox = call_with(pairwise.wilcox.test, c(list(x = a$x, g = a$g), args)),
    wilcoxPaired = call_with(pairwise.wilcox.test, c(list(x = a$x, g = a$g, paired = TRUE), args)),
    prop = pairwise.prop.test(a$x, a$n, p.adjust.method = a$pAdjustMethod))
  list(method = r$method, pValue = num_or_vec(r$p.value))
}
write_htest_fixture("pairwise", cases, pw_fun)
