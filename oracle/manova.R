# issue: 549
# Oracle fixture extraction using public stats functions only.
library(jsonlite)
tab <- function(x) list(rows=rownames(x), cols=colnames(x), values=unname(as.matrix(x)))
one <- function(fit) {
 tests <- c("Pillai","Wilks","Hotelling-Lawley","Roy")
 z <- lapply(tests, function(t) tab(summary(fit, test=t)$stats)); names(z) <- tests
 s <- summary(fit)
 z$SS <- lapply(s$SS, tab); z$Eigenvalues <- tab(s$Eigenvalues); z$coef <- tab(coef(fit)); z
}
fit <- manova(cbind(Sepal.Length,Sepal.Width,Petal.Length,Petal.Width) ~ Species, data=iris)
out <- list(iris=one(fit), iris_intercept=one(manova(cbind(Sepal.Length,Sepal.Width,
 Petal.Length,Petal.Width) ~ Species, data=iris), intercept=TRUE))
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
