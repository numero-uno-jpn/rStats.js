source("/oracle/_anova.R")

# Mauchly's test of sphericity: mauchly.test(lm(y ~ 1 or y ~ group), X, M, idata) (fixture mauchlyTest). Each case has
#   y      the responses, one row per subject and one column per measurement
#   group  (optional) between-subjects group labels: the test uses the residuals from the group means
#   X, M   (optional) formulas over idata, as in R: the test is on the contrasts spanned by M and orthogonal to X
#          (R's defaults: M the identity, X ~0)
#   idata  (optional) the within-subject design, one row per column of y (R's default: a column "index" 1..p)
# Written: statistic (W), statisticName, pValue, method ("Mauchly's test of sphericity").

set.seed(20261107)
S <- matrix(c(1, 0.5, 0.3, 0.2, 0.5, 1, 0.4, 0.1, 0.3, 0.4, 1.5, 0.6, 0.2, 0.1, 0.6, 2), 4)
y4 <- round(matrix(rnorm(15 * 4), 15) %*% chol(S) + 10, 2)
y3 <- y4[, 1:3]
y6 <- round(matrix(rnorm(14 * 6), 14) + rnorm(14), 2)
g <- rep(c("a", "b", "c"), length.out = 15)
id23 <- expand.grid(W1 = c("a", "b"), W2 = c("x", "y", "z"), stringsAsFactors = FALSE)

cases <- list(
  list(y = y4), list(y = y4, X = "~1"), list(y = y3, X = "~1"), list(y = y4, group = I(g), X = "~1"),
  list(y = y4[1:5, ], X = "~1"), list(y = y6, X = "~1"),
  list(y = y6, idata = id23, X = "~1"), list(y = y6, idata = id23, M = "~W1 + W2", X = "~W1"),
  list(y = y6, idata = id23, M = "~W1 * W2", X = "~W1 + W2"),
  list(y = y4[, 1:2], X = "~1")
)

write_anova_fixture("mauchlyTest", cases, function(a) {
  Y <- a$y
  m <- if (is.null(a$group)) lm(Y ~ 1) else { G <- factor(unclass(a$group)); lm(Y ~ G) }
  args <- list(m)
  if (!is.null(a$X)) args$X <- as.formula(a$X)
  if (!is.null(a$M)) args$M <- as.formula(a$M)
  if (!is.null(a$idata)) args$idata <- a$idata
  r <- do.call(mauchly.test, args)
  list(statistic = num2str(unname(r$statistic)), statisticName = names(r$statistic),
       pValue = num2str(r$p.value), method = r$method[1])
})
