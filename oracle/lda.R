# issue: 549
# Full LDA oracle; all cases from experiments/multivariate19.R
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

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
