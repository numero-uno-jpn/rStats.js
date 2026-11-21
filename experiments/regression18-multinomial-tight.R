# issue: 545
# regression18-multinomial-tight.R: how far R's multinomial glmnet fits on iris are from the optimum (1.8.0)
# Part 1: R's default (thresh 1e-7) against a strict refit; Part 2: strict refits at 1e-14 and 1e-16; Part 3: path lengths
suppressMessages(library(glmnet)); Xi <- as.matrix(iris[, 1:4]); yi <- iris$Species
Xi <- as.matrix(iris[, 1:4]); yi <- iris$Species
for (tm in c("ungrouped", "grouped")) {
  f <- glmnet(Xi, yi, family = "multinomial", type.multinomial = tm, nlambda = 6)
  ft <- suppressWarnings(glmnet(Xi, yi, family = "multinomial", type.multinomial = tm, nlambda = 6, control = list(thresh = 1e-14, maxit = 1e8)))
  cat(tm, "lambda equal:", isTRUE(all.equal(f$lambda, ft$lambda, tolerance = 0)), "\n")
  cat("default setosa col2:", format(as.matrix(f$beta$setosa)[, 2], digits = 15), "\n")
  cat("tight   setosa col2:", format(as.matrix(ft$beta$setosa)[, 2], digits = 15), "\n")
  cat("max |default - tight| over the path:", max(sapply(names(f$beta), function(k) max(abs(as.matrix(f$beta[[k]]) - as.matrix(ft$beta[[k]]))))), "\n")
}
for (tm in c("ungrouped", "grouped")) {
  ft <- glmnet(Xi, yi, family = "multinomial", type.multinomial = tm, nlambda = 6, control = list(thresh = 1e-14, maxit = 1e8))
  ft2 <- glmnet(Xi, yi, family = "multinomial", type.multinomial = tm, nlambda = 6, control = list(thresh = 1e-16, maxit = 1e8))
  cat(tm, "n lambda", length(ft$lambda), length(ft2$lambda), "\n")
  cat("max |1e-14 - 1e-16|:", max(sapply(names(ft$beta), function(k) max(abs(as.matrix(ft$beta[[k]]) - as.matrix(ft2$beta[[k]]))))), "\n")
  cat("setosa col2:", format(as.matrix(ft$beta$setosa)[, 2], digits = 15), "\n")
}
for (tm in c("ungrouped", "grouped")) for (nl in c(6, 100)) {
  f <- glmnet(Xi, yi, family = "multinomial", type.multinomial = tm, nlambda = nl)
  cat(tm, nl, "n lambda", length(f$lambda), "devRatio", format(head(f$dev.ratio, 6), digits = 6), "... last", format(tail(f$dev.ratio, 1), digits = 8), "\n")
}
