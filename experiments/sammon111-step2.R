# issue: 560
# Simultaneous vs coordinatewise diagonal-Newton sweeps; stopping cadence diagnostics.
library(MASS)
library(jsonlite)
objective <- function(D,Y) {
 n<-nrow(D); num<-0; den<-0
 for(i in 1:(n-1)) for(j in (i+1):n) {
  d<-D[i,j]; r<-sqrt(sum((Y[i,]-Y[j,])^2)); num<-num+(d-r)^2/d; den<-den+d
 }
 num/den
}
step_values <- function(D,Y,magic,simultaneous=TRUE) {
 n<-nrow(D); k<-ncol(Y); den<-sum(D[upper.tri(D)])
 grad<-matrix(0,n,k); hess<-matrix(0,n,k)
 calc<-function(Z,i,q) {
  g<-0; h<-0
  for(j in seq_len(n)) if(j!=i) {
   v<-Z[i,q]-Z[j,q]; r<-sqrt(sum((Z[i,]-Z[j,])^2)); d<-D[i,j]
   if(r>0) { a<-1/d-1/r; g<-g+a*v; h<-h+a+v^2/r^3 }
  }
  c(2*g/den,2*h/den)
 }
 if(simultaneous) {
  for(i in seq_len(n)) for(q in seq_len(k)) { z<-calc(Y,i,q); grad[i,q]<-z[1];hess[i,q]<-z[2] }
  Y-magic*grad/abs(hess)
 } else {
  Z<-Y
  for(i in seq_len(n)) for(q in seq_len(k)) { z<-calc(Z,i,q); if(is.finite(z[1])&&is.finite(z[2])&&abs(z[2])>0) Z[i,q]<-Z[i,q]-magic*z[1]/abs(z[2]) }
  Z
 }
}
sw<-as.matrix(dist(swiss)); y0<-cmdscale(dist(swiss),k=2)
mg<-0.5*0.2^(0:20)
grid<-lapply(mg,function(m) c(magic=m,simultaneous=objective(sw,step_values(sw,y0,m,TRUE)),coordinatewise=objective(sw,step_values(sw,y0,m,FALSE))))
small<-matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE)
ds<-dist(small)
run<-function(niter,tol=1e-14) { txt<-capture.output(f<-sammon(ds,niter=niter,tol=tol)); list(niter=niter,stress=f$stress,printed=txt) }
out<-list(swiss_initial=objective(sw,y0),swiss_magic_grid=do.call(rbind,grid),
 swiss_default=run(100000),small_niter= lapply(c(79,80,81,89,90,91),run),
 small_tol_tiny=lapply(c(80,81,89,90),function(n)run(n,1e-30)),
 perfect_three=run(100))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
