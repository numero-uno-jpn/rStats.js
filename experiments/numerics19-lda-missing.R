# issue: 549
library(MASS)

x <- as.matrix(iris[, 1:4])
g <- iris$Species

probe <- function(label, xx, gg) {
  cat(label, ": ")
  result <- tryCatch({
    fit <- MASS::lda(xx, gg)
    paste("returned", fit$N, "observations")
  }, error = function(e) paste("error:", conditionMessage(e)))
  cat(result, "\n")
}

x1 <- x
x1[5, 1] <- NA_real_
probe("matrix predictor NA", x1, g)

x2 <- x
x2[5, 1] <- NaN
probe("matrix predictor NaN", x2, g)

x3 <- x
x3[5, 1] <- Inf
probe("matrix predictor Inf", x3, g)

g1 <- as.character(g)
g1[5] <- NA_character_
probe("grouping NA", x, g1)
