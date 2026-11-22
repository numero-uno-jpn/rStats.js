# issue: 549
library(MASS)
library(PMCMRplus)
library(outliers)
library(jsonlite)

iris_x <- as.matrix(iris[, 1:4])
iris_y <- as.matrix(iris[, 3:4])
iris_g <- iris$Species
lda_base <- MASS::lda(iris_x, iris_g)
cc_base <- stats::cancor(iris_x[, 1:2], iris_y)
mv_base <- stats::manova(cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species, data = iris)
mv_base_pillai <- summary(mv_base, test = "Pillai")$stats[1, "Pillai"]

offset_result <- lapply(c(1e8, 1e12), function(shift) {
  xx <- iris_x + shift
  ff <- MASS::lda(xx, iris_g)
  pp <- predict(ff)
  cc <- stats::cancor(xx[, 1:2], iris_y + shift)
  dd <- iris
  dd[, 1:4] <- dd[, 1:4] + shift
  mm <- stats::manova(cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species, data = dd)
  list(
    shift = shift,
    lda_scaling_rel = max(abs(ff$scaling - lda_base$scaling) / pmax(abs(lda_base$scaling), 1e-300)),
    lda_posterior_abs = max(abs(pp$posterior - predict(lda_base)$posterior)),
    cancor_abs = max(abs(cc$cor - cc_base$cor)),
    manova_pillai_abs = abs(summary(mm, test = "Pillai")$stats[1, "Pillai"] - mv_base_pillai)
  )
})

eps <- 2^-53
aa <- -0.5 + (0:10) * eps
bb <- 0.5 + (0:10) * eps
xx <- c(aa, bb)
gg <- factor(rep(c("a", "b"), each = 11), levels = c("a", "b"))
t2_result <- tryCatch({
  rr <- PMCMRplus::tamhaneT2Test(xx, gg)
  list(statistic = rr$statistic, p = rr$p.value)
}, error = function(e) list(error = conditionMessage(e)))

pg_matrix <- matrix(rep(c(1, 2), 1400), ncol = 2, byrow = TRUE)
pg_result <- PMCMRplus::pageTest(pg_matrix, alternative = "greater")

gb_x <- c(seq(-1, 1, length.out = 199), 300)
gb_result <- tryCatch(outliers::grubbs.test(gb_x, type = 10),
                      error = function(e) list(error = conditionMessage(e)))
gb_cdf <- lapply(c(0, 0.5, 1, 2, 5, Inf), function(qv) {
  tryCatch(suppressWarnings(outliers::pgrubbs(qv, n = 10, type = 10)),
           error = function(e) list(error = conditionMessage(e)))
})
gb_quantile <- lapply(c(0, 1e-16, 1e-8, 0.5, 1 - 1e-15, 1), function(pp) {
  tryCatch(suppressWarnings(outliers::qgrubbs(pp, n = 10, type = 10)),
           error = function(e) list(error = conditionMessage(e)))
})

pat1 <- ((0:49) %% 5 - 2) * 1e135
pat2 <- c(2, -1, 1, -2, 0)[(0:49) %% 5 + 1] * 1e135
large_data <- data.frame(
  y1 = c(pat1, 1e150 + pat1),
  y2 = c(pat2, 1e150 + pat2),
  group = factor(rep(c("a", "b"), each = 50))
)
large_mv <- stats::manova(cbind(y1, y2) ~ group, data = large_data)
large_summary <- summary(large_mv, test = "Pillai")$stats

cat(toJSON(list(
  offsets = offset_result,
  tamhane = t2_result,
  page_result = list(z = unname(pg_result$statistic), p = unname(pg_result$p.value)),
  grubbs = list(statistic = unname(gb_result$statistic), p = unname(gb_result$p.value),
                cdf = gb_cdf, quantiles = gb_quantile),
  large_manova = list(pillai = unname(large_summary[1, "Pillai"]),
                      f = unname(large_summary[1, "approx F"]),
                      p = unname(large_summary[1, "Pr(>F)"]))
), digits = NA, auto_unbox = TRUE, na = "string"))
