# issue: 560
# Independent Sammon objective and initial-gradient diagnostics; public function only.
library(MASS)
library(jsonlite)
objective <- function(d,y) {
  D <- as.matrix(d); n <- nrow(D); num <- 0; den <- 0
  for(i in 1:(n-1)) for(j in (i+1):n) {
    dij <- D[i,j]; rij <- sqrt(sum((y[i,]-y[j,])^2))
    num <- num + (dij-rij)^2/dij; den <- den + dij
  }
  num/den
}
gradient <- function(d,y) {
  D <- as.matrix(d); n <- nrow(D); g <- matrix(0,n,ncol(y)); den <- sum(D[upper.tri(D)])
  for(i in 1:(n-1)) for(j in (i+1):n) {
    v <- y[i,]-y[j,]; rij <- sqrt(sum(v^2))
    if(rij>0) { a <- 2*(rij-D[i,j])/(D[i,j]*rij*den); g[i,] <- g[i,]+a*v; g[j,] <- g[j,]-a*v }
  }
  g
}
sw <- dist(swiss)
y0 <- cmdscale(sw,k=2)
fit0 <- sammon(sw,niter=0)
fit <- sammon(sw)
g <- gradient(sw,y0)
for (step in c(1e-8,1e-6,1e-4,1e-2)) {
  yy <- y0 - step*g
  assign(paste0("obj_",format(step,scientific=TRUE)),objective(sw,yy))
}
small <- matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE)
ds <- dist(small)
fs <- sammon(ds)
out <- list(
 swiss_initial_stress=objective(sw,y0),
 swiss_public_niter0=fit0$stress,
 swiss_default=fit$stress,
 swiss_default_printed=capture.output(sammon(sw)),
 swiss_gradient_norm=sqrt(sum(g^2)),
 swiss_objective_after_steps=c(obj_1e-08,obj_1e-06,obj_1e-04,obj_1e-02),
 sammon_small_stress=fs$stress,
 sammon_small_direct_objective=objective(ds,fs$points),
 sammon_small_points=fs$points
)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
