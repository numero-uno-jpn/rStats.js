# issue: 560
# Public MASS isoMDS sensitivity diagnostics; no package internals are inspected.
# Re-run after the formula-stage updates; tight endpoints are compared case by case.
# All calls use documented MASS public arguments and returned values.
library(MASS)
library(jsonlite)
tab <- function(x) list(rows=rownames(x),values=unname(as.matrix(x)))
run <- function(d,k=2,p=2,y=NULL) {
  start <- if(is.null(y)) cmdscale(d,k=k) else y
  printed <- capture.output(tight <- isoMDS(d,y=start,k=k,p=p,tol=1e-10,maxit=5000))
  list(start=tab(start),tight=list(stress=tight$stress,points=tab(tight$points)))
}
small <- matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE)
grid <- as.matrix(expand.grid(x=0:2,y=0:2))
perturbed <- grid + 0.1*cbind(sin(1:9),cos(1:9))
nonE <- as.dist(matrix(c(0,1,1,3,1,0,1,1,1,1,0,1,3,1,1,0),4))
dsw <- dist(swiss); dsmall <- dist(small); dgrid <- dist(grid)
set.seed(560)
random <- matrix(rnorm(18),ncol=2)
out <- list(
 swiss=run(dsw), swiss_k3=run(dsw,k=3), swiss_p1=run(dsw,p=1), swiss_p3=run(dsw,p=3),
 eurodist=run(eurodist), usarrests=run(dist(USArrests)), small=run(dsmall),
 small_k1=run(dsmall,k=1), non_euclidean=run(nonE), grid_ties=run(dgrid,y=perturbed),
 grid_default=run(dgrid), grid_random=run(dgrid,y=random)
)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
