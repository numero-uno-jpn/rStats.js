# issue: 549
# Oracle fixture extraction using public MASS functions only.
library(MASS); library(jsonlite)
tab <- function(x) list(rows=rownames(x), cols=colnames(x), values=unname(as.matrix(x)))
fitout <- function(f) list(prior=f$prior, counts=f$counts, means=tab(f$means),
                            scaling=tab(f$scaling), svd=f$svd, N=f$N, lev=f$lev)
predout <- function(p) list(class=as.character(p$class), posterior=tab(p$posterior), x=tab(p$x))
f <- lda(iris[,1:4], iris$Species)
out <- list(fit=fitout(f), prediction=predout(predict(f)),
            newdata=predout(predict(f, newdata=iris[c(1,51,101,150),])),
            prior=fitout(lda(iris[,1:4], iris$Species, prior=c(.6,.3,.1))),
            cv={p<-lda(iris[,1:4], iris$Species, CV=TRUE);
                list(class=as.character(p$class), posterior=tab(p$posterior))})
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
