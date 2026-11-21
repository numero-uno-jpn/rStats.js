# regression18-glmnet.R: glmnet 5.1 on small data and boundary cases, public functions only (1.8.0)
# Output: JSON on stdout, 17 significant digits. fitTight: the same call with thresh = 1e-14 (R's default 1e-7 stops
# early, as polr's and nls's defaults did)
suppressMessages(library(glmnet))
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
out <- list()
pathValues <- function(fit) {
  list(lambda = fit$lambda, a0 = run(fit$a0), beta = run(tab(as.matrix(fit$beta))), df = run(fit$df),
       dev.ratio = fit$dev.ratio, nulldev = fit$nulldev, npasses = fit$npasses, jerr = fit$jerr)
}
both <- function(...) list(default = run(pathValues(glmnet(...))), fitTight = run(pathValues(glmnet(..., thresh = 1e-14))))
X <- as.matrix(mtcars[, c("cyl", "disp", "hp", "drat", "wt", "qsec")])
ybin <- mtcars$am; ycnt <- mtcars$carb
for (a in c(1, 0.5, 0)) {
  out[[sprintf("mtcars_gaussian_alpha%g", a)]] <- run(both(X, mtcars$mpg, alpha = a))
  out[[sprintf("mtcars_binomial_alpha%g", a)]] <- run(both(X, ybin, family = "binomial", alpha = a))
  out[[sprintf("mtcars_poisson_alpha%g", a)]] <- run(both(X, ycnt, family = "poisson", alpha = a))
}
# options: standardize, intercept, weights, offset, penalty.factor, limits, a given lambda sequence, nlambda, ratio
out$gaussian_nostd <- run(both(X, mtcars$mpg, standardize = FALSE))
out$gaussian_nointercept <- run(both(X, mtcars$mpg, intercept = FALSE))
out$gaussian_weights <- run(both(X, mtcars$mpg, weights = rep(1:4, 8)))
out$poisson_offset <- run(both(X, ycnt, family = "poisson", offset = log(mtcars$gear)))
out$gaussian_penalty_factor <- run(both(X, mtcars$mpg, penalty.factor = c(0, 1, 1, 2, 1, 0.5)))
out$gaussian_limits <- run(both(X, mtcars$mpg, lower.limits = -1, upper.limits = 0.5))
out$gaussian_lambda <- run(both(X, mtcars$mpg, lambda = c(5, 1, 0.5, 0.1, 0.01)))
out$gaussian_nlambda_ratio <- run(both(X, mtcars$mpg, nlambda = 20, lambda.min.ratio = 0.001))
out$gaussian_dfmax <- run(both(X, mtcars$mpg, dfmax = 2))
out$binomial_factor_y <- run(both(X, factor(ifelse(ybin == 1, "manual", "auto")), family = "binomial"))
# multinomial: ungrouped and grouped
Xi <- as.matrix(iris[, 1:4])
for (tm in c("ungrouped", "grouped")) {
  out[[paste0("iris_multinomial_", tm)]] <- run({
    f <- glmnet(Xi, iris$Species, family = "multinomial", type.multinomial = tm)
    ft <- glmnet(Xi, iris$Species, family = "multinomial", type.multinomial = tm, thresh = 1e-14)
    mv <- function(fit) list(lambda = fit$lambda, a0 = tab(fit$a0), beta = lapply(fit$beta, function(b) tab(as.matrix(b))),
                              dev.ratio = fit$dev.ratio, nulldev = fit$nulldev, dfmat = tab(fit$dfmat))
    list(default = mv(f), fitTight = mv(ft),
         predictClass = run(predict(f, Xi[c(1, 51, 101, 120), ], s = c(0.01, 0.1), type = "class")),
         predictResponse = run(as.list(as.data.frame(predict(f, Xi[c(1, 51, 101), ], s = 0.05, type = "response")))))
  })
}
# coef and predict at lambdas off the path (exact = FALSE interpolates; exact = TRUE refits)
out$coef_predict <- run({
  f <- glmnet(X, mtcars$mpg)
  list(coefInterp = tab(as.matrix(coef(f, s = c(0.123, 2)))),
       coefExact = run(tab(as.matrix(coef(f, s = 0.123, exact = TRUE, x = X, y = mtcars$mpg)))),
       predictLink = tab(predict(f, X[1:3, ], s = c(0.123, 2))),
       nonzero = run(predict(f, type = "nonzero", s = 0.5)))
})
out$binomial_predict <- run({
  f <- glmnet(X, ybin, family = "binomial")
  list(link = tab(predict(f, X[1:4, ], s = 0.05)), response = tab(predict(f, X[1:4, ], s = 0.05, type = "response")),
       class = predict(f, X[1:4, ], s = 0.05, type = "class"))
})
# cv.glmnet with fixed folds
foldid <- rep(1:4, 8)
for (fam in c("gaussian", "binomial", "poisson")) {
  y <- switch(fam, gaussian = mtcars$mpg, binomial = ybin, poisson = ycnt)
  out[[paste0("cv_", fam)]] <- run({
    cv <- cv.glmnet(X, y, family = fam, foldid = foldid)
    list(lambda = cv$lambda, cvm = cv$cvm, cvsd = cv$cvsd, cvup = cv$cvup, cvlo = cv$cvlo, nzero = unname(cv$nzero),
         lambda.min = cv$lambda.min, lambda.1se = cv$lambda.1se, name = unname(cv$name))
  })
}
for (tm in c("mse", "mae")) {
  out[[paste0("cv_gaussian_", tm)]] <- run({
    cv <- cv.glmnet(X, mtcars$mpg, foldid = foldid, type.measure = tm)
    list(cvm = cv$cvm, cvsd = cv$cvsd, lambda.min = cv$lambda.min, lambda.1se = cv$lambda.1se)
  })
}
for (tm in c("deviance", "class", "auc", "mse", "mae")) {
  out[[paste0("cv_binomial_", tm)]] <- run({
    cv <- cv.glmnet(X, ybin, family = "binomial", foldid = foldid, type.measure = tm)
    list(cvm = cv$cvm, cvsd = cv$cvsd, lambda.min = cv$lambda.min, lambda.1se = cv$lambda.1se)
  })
}
out$cv_multinomial_grouped <- run({
  cv <- cv.glmnet(Xi, iris$Species, family = "multinomial", type.multinomial = "grouped", foldid = rep(1:5, 30))
  list(lambda = cv$lambda, cvm = cv$cvm, cvsd = cv$cvsd, lambda.min = cv$lambda.min, lambda.1se = cv$lambda.1se)
})
out$cv_keep_ungrouped <- run({
  cv <- cv.glmnet(X, mtcars$mpg, foldid = foldid, grouped = FALSE, keep = TRUE)
  list(cvm = cv$cvm, cvsd = cv$cvsd, fit.preval = tab(cv$fit.preval[1:5, 1:5]))
})
# boundaries: a constant column, a constant y, p > n, one column, separation, huge and tiny scales, NA
out$constant_column <- run(both(cbind(X, k = 1), mtcars$mpg))
out$constant_y <- run(both(X, rep(3, 32)))
out$p_gt_n <- run({ set.seed(1); Z <- matrix(rnorm(20 * 50), 20, 50); y <- Z[, 1] - 2 * Z[, 2] + rnorm(20)
                   list(Z = tab(Z), y = y, fit = both(Z, y)) })
out$one_column <- run(both(X[, "wt", drop = FALSE], mtcars$mpg))
out$binomial_separation <- run(both(cbind(x1 = 1:12, x2 = c(3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8)), rep(0:1, each = 6),
                                     family = "binomial"))
out$scale_x_1e100 <- run(both(X * 1e100, mtcars$mpg))
out$scale_y_1em100 <- run(both(X, mtcars$mpg * 1e-100))
out$na_x <- run({ Xn <- X; Xn[2, 3] <- NA; pathValues(glmnet(Xn, mtcars$mpg)) })
out$binomial_one_class <- run(pathValues(glmnet(X, rep(1, 32), family = "binomial")))
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
