# issue: 549
# Oracle fixture extraction using public stats::cancor only.
library(jsonlite)
tab <- function(x) list(rows=rownames(x), cols=colnames(x), values=unname(as.matrix(x)))
pick <- function(r) list(cor=r$cor, xcoef=tab(r$xcoef), ycoef=tab(r$ycoef),
                          xcenter=r$xcenter, ycenter=r$ycenter)
x <- LifeCycleSavings[,2:3]; y <- LifeCycleSavings[,-(2:3)]
out <- list(centered=pick(cancor(x,y)), uncentered=pick(cancor(x,y,xcenter=FALSE,ycenter=FALSE)),
            vectors=pick(cancor(mtcars$wt,mtcars$mpg)),
            scaled=pick(cancor(x*1e100,y*1e-100)))
cat(toJSON(out, digits=NA, auto_unbox=TRUE, na="string"))
