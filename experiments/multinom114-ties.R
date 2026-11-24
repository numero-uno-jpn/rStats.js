# multinom114-ties.R: how predict.multinom(type = "class") breaks ties (1.14.0), public functions only. Compares it
# with max.col (documented: ties within a relative tolerance of 1e-5 are broken at random) on the same random seed,
# and counts the uniforms drawn.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(nnet))
fitq <- function(e) { r <- NULL; invisible(capture.output(r <- e)); r }
draws <- function(seed, f) {
  set.seed(seed); val <- f(); after <- .Random.seed
  set.seed(seed); k <- 0
  while (k <= 1000 && !identical(.Random.seed, after)) { runif(1); k <- k + 1 }
  list(value = val, uniforms = if (k > 1000) NA else k)
}
out <- list()
# an intercept-only model with equal counts: every row a three-way tie
tie <- data.frame(y = factor(rep(c("A", "B", "C"), each = 4)))
m <- fitq(multinom(y ~ 1, data = tie, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
pr <- predict(m, type = "probs")
for (s in 1:5) out[[paste0("seed", s)]] <- list(
  predict = draws(s, function() as.character(predict(m, type = "class"))),
  maxcol = draws(s, function() colnames(pr)[max.col(pr)]))
# two-way ties and near ties: probabilities given directly to max.col
near <- rbind(c(0.4, 0.4, 0.2), c(0.4, 0.4 * (1 - 5e-6), 0.2), c(0.4, 0.4 * (1 - 5e-5), 0.2), c(0.3, 0.2, 0.5),
              c(0.45, 0.1, 0.45))
for (s in 1:3) out[[paste0("near", s)]] <- draws(s, function() max.col(near))
# a two-way tie in a fitted model: two categories with equal counts, a third rarer
tie2 <- data.frame(y = factor(c(rep("A", 5), rep("B", 5), rep("C", 2))))
m2 <- fitq(multinom(y ~ 1, data = tie2, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
pr2 <- predict(m2, type = "probs")
out$tie2 <- list(probs = as.vector(pr2[1, ]), predict = draws(7, function() as.character(predict(m2, type = "class"))),
                 maxcol = draws(7, function() colnames(pr2)[max.col(pr2)]))
cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
