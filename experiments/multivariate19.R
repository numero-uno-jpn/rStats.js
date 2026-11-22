# multivariate19.R: stats (manova, summary.manova, cancor) and MASS 7.3.66 (lda, predict.lda) on small data and
# boundary cases, public functions only (1.9.0)
# Output: JSON on stdout, 17 significant digits. Only numbers and strings are kept (no R objects)
library(MASS)
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
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(as.matrix(m)))
out <- list()

## MANOVA: summary.manova's table for each of the four tests, with and without the intercept row, and the SSP
## matrices and eigenvalues it reports
mv <- function(fit, ...) {
  tests <- c("Pillai", "Wilks", "Hotelling-Lawley", "Roy")
  res <- lapply(tests, function(t) run({ s <- summary(fit, test = t, ...); tab(s$stats) }))
  names(res) <- tests
  s <- summary(fit, ...)
  res$SS <- lapply(s$SS, tab)
  res$Eigenvalues <- tab(s$Eigenvalues)
  res$coef <- tab(coef(fit))
  res
}
out$manova_iris <- run(mv(manova(cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species, data = iris)))
out$manova_iris_intercept <- run(mv(manova(cbind(Sepal.Length, Sepal.Width, Petal.Length, Petal.Width) ~ Species,
                                           data = iris), intercept = TRUE))
mt <- transform(mtcars, cyl = factor(cyl), am = factor(am), gear = factor(gear))
out$manova_two_factors <- run(mv(manova(cbind(mpg, disp, hp) ~ cyl + am, data = mt)))
out$manova_two_factors_reversed <- run(mv(manova(cbind(mpg, disp, hp) ~ am + cyl, data = mt)))
out$manova_interaction <- run(mv(manova(cbind(mpg, qsec) ~ am * gear, data = mt)))
out$manova_covariate <- run(mv(manova(cbind(mpg, disp, hp) ~ wt + cyl, data = mt)))
out$manova_two_responses_two_groups <- run(mv(manova(cbind(mpg, hp) ~ am, data = mt)))
# Roy's F is an upper bound; df when the number of responses exceeds the term's df and the other way round
out$manova_p_gt_df <- run(mv(manova(cbind(mpg, disp, hp, drat, wt) ~ am, data = mt)))
# boundary cases: a single response, residual df below the number of responses, collinear responses, NA rows
out$manova_one_response <- run(mv(manova(cbind(mpg) ~ cyl, data = mt)))
out$manova_few_df <- run(mv(manova(cbind(mpg, disp, hp, drat, wt, qsec) ~ cyl, data = mt[1:8, ])))
out$manova_collinear <- run(mv(manova(cbind(mpg, disp, I(mpg + disp)) ~ cyl, data = mt)))
out$manova_na <- run({ d <- mt; d$mpg[3] <- NA; mv(manova(cbind(mpg, disp, hp) ~ cyl, data = d)) })
out$manova_tol <- run(mv(manova(cbind(mpg, disp, hp) ~ cyl, data = mt), tol = 0.5))
out$manova_scale <- run(mv(manova(cbind(mpg * 1e100, disp, hp * 1e-100) ~ cyl, data = mt)))
out$manova_npk <- run(mv(manova(cbind(yield, as.numeric(block)) ~ N * P, data = npk)))

## Linear discriminant analysis (method = "moment"): the fit, predict (plug-in by default) and leave-one-out
ldaFit <- function(fit) list(prior = fit$prior, counts = fit$counts, means = tab(fit$means), scaling = tab(fit$scaling),
                             svd = fit$svd, N = fit$N, lev = fit$lev)
ldaPred <- function(p) list(class = as.character(p$class), posterior = tab(p$posterior), x = tab(p$x))
ldaCV <- function(r) list(class = as.character(r$class), posterior = tab(r$posterior))
X <- iris[, 1:4]; g <- iris$Species
out$lda_iris <- run({ f <- lda(X, g); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_iris_formula <- run({ f <- lda(Species ~ ., data = iris); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_iris_prior <- run({ f <- lda(X, g, prior = c(0.6, 0.3, 0.1)); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_iris_cv <- run(ldaCV(lda(X, g, CV = TRUE)))
out$lda_iris_cv_prior <- run(ldaCV(lda(X, g, CV = TRUE, prior = c(0.2, 0.5, 0.3))))
out$lda_iris_newdata <- run({ f <- lda(X, g); ldaPred(predict(f, newdata = X[c(1, 51, 101, 150), ])) })
out$lda_iris_predict_prior <- run({ f <- lda(X, g); ldaPred(predict(f, prior = c(0.1, 0.1, 0.8))) })
out$lda_iris_dimen1 <- run({ f <- lda(X, g); ldaPred(predict(f, dimen = 1)) })
out$lda_iris_predictive <- run({ f <- lda(X, g); ldaPred(predict(f, method = "predictive")) })
out$lda_iris_debiased <- run({ f <- lda(X, g); ldaPred(predict(f, method = "debiased")) })
# two classes (one discriminant), unequal sizes, an empty factor level, collinear variables, a constant variable,
# a class of one, NA, scale
out$lda_two_classes <- run({ f <- lda(mt[, c("mpg", "hp", "wt")], mt$am); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_three_cyl <- run({ f <- lda(mt[, c("mpg", "disp", "hp", "wt")], mt$cyl); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_empty_level <- run({ gg <- factor(g, levels = c(levels(g), "none")); f <- lda(X, gg); ldaFit(f) })
out$lda_collinear <- run({ Xc <- cbind(X, s = X[, 1] + X[, 2]); f <- lda(Xc, g); ldaFit(f) })
out$lda_constant_within <- run({ Xk <- X; Xk[, 2] <- as.numeric(g); f <- lda(Xk, g); ldaFit(f) })
out$lda_class_of_one <- run({ gg <- factor(c(as.character(g[1:149]), "lone")); f <- lda(X, gg); ldaFit(f) })
out$lda_na <- run({ Xn <- X; Xn[5, 2] <- NA; f <- lda(Species ~ ., data = cbind(Xn, Species = g)); ldaFit(f) })
out$lda_scale <- run({ Xs <- X; Xs[, 1] <- Xs[, 1] * 1e100; f <- lda(Xs, g); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_tol <- run({ f <- lda(X, g, tol = 0.5); ldaFit(f) })
out$lda_single_variable <- run({ f <- lda(X[, 1, drop = FALSE], g); list(fit = ldaFit(f), pred = ldaPred(predict(f))) })
out$lda_cv_two_classes <- run(ldaCV(lda(mt[, c("mpg", "hp", "wt")], mt$am, CV = TRUE)))

## Canonical correlation
cc <- function(r) list(cor = r$cor, xcoef = tab(r$xcoef), ycoef = tab(r$ycoef), xcenter = r$xcenter, ycenter = r$ycenter)
pop <- LifeCycleSavings[, 2:3]; oec <- LifeCycleSavings[, -(2:3)]
out$cancor_lifecycle <- run(cc(cancor(pop, oec)))
out$cancor_lifecycle_nocenter <- run(cc(cancor(pop, oec, xcenter = FALSE, ycenter = FALSE)))
out$cancor_lifecycle_given_center <- run(cc(cancor(pop, oec, xcenter = c(30, 2), ycenter = c(10, 1000, 4))))
out$cancor_iris <- run(cc(cancor(iris[, 1:2], iris[, 3:4])))
out$cancor_one_x <- run(cc(cancor(mtcars[, "wt", drop = FALSE], mtcars[, c("mpg", "hp", "qsec")])))
out$cancor_more_x_than_y <- run(cc(cancor(mtcars[, c("wt", "disp", "drat", "qsec")], mtcars[, c("mpg", "hp")])))
out$cancor_collinear <- run(cc(cancor(cbind(a = mtcars$wt, b = mtcars$disp, c = mtcars$wt + mtcars$disp), mtcars[, c("mpg", "hp")])))
out$cancor_n_small <- run(cc(cancor(mtcars[1:4, c("wt", "disp", "drat")], mtcars[1:4, c("mpg", "hp")])))
out$cancor_na <- run({ x <- pop; x[3, 1] <- NA; cc(cancor(x, oec)) })
out$cancor_scale <- run(cc(cancor(pop * 1e100, oec * 1e-100)))
out$cancor_vectors <- run(cc(cancor(mtcars$wt, mtcars$mpg)))
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
