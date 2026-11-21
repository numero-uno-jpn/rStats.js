# issue: 545
# Compare fixed-lambda fold fits, fold-specific paths, and cv.glmnet predictions.
suppressMessages(library(glmnet))
library(jsonlite)
tab <- function(x) {
  z <- as.matrix(x)
  list(rows = rownames(z), cols = colnames(z), values = unname(z))
}
X <- matrix(c(
  -2,1,0,2,-1,3,1,-3,2,0,4,-2,
  1,0,2,-1,3,-2,2,1,-3,4,0,-1,
  2,-1,1,0,-2,3,-3,2,1,-1,4,0
), 12, 3)
y <- c(4,2,5,1,7,0,6,3,8,2,9,1)
foldid <- rep(1:3, 4)
full <- glmnet(X, y, nlambda = 8)
cv <- cv.glmnet(X, y, foldid = foldid, nlambda = 8, keep = TRUE)
manual <- lapply(1:3, function(k) {
  train <- which(foldid != k)
  test <- which(foldid == k)
  fixed <- glmnet(X[train, , drop = FALSE], y[train], lambda = full$lambda)
  automatic <- glmnet(X[train, , drop = FALSE], y[train], nlambda = 8)
  pathCoef <- as.matrix(coef(automatic))
  k <- max(which(automatic$lambda >= full$lambda[1]))
  linearT <- (full$lambda[1] - automatic$lambda[k]) /
    (automatic$lambda[k + 1] - automatic$lambda[k])
  logT <- (log(full$lambda[1]) - log(automatic$lambda[k])) /
    (log(automatic$lambda[k + 1]) - log(automatic$lambda[k]))
  list(
    test = test,
    fixed = tab(predict(fixed, X[test, , drop = FALSE], s = full$lambda)),
    automatic = tab(predict(automatic, X[test, , drop = FALSE], s = full$lambda)),
    coefAtFirst = unname(as.matrix(coef(automatic, s = full$lambda[1]))[, 1]),
    linearAtFirst = unname(pathCoef[, k] * (1 - linearT) + pathCoef[, k + 1] * linearT),
    logAtFirst = unname(pathCoef[, k] * (1 - logT) + pathCoef[, k + 1] * logT),
    fixedLambda = fixed$lambda,
    automaticLambda = automatic$lambda
  )
})
out <- list(
  fullLambda = full$lambda,
  cvLambda = cv$lambda,
  cvm = cv$cvm,
  cvsd = cv$cvsd,
  cvPreval = tab(cv$fit.preval),
  manual = manual
)
writeLines(toJSON(out, auto_unbox = TRUE, digits = NA, null = "null"))
