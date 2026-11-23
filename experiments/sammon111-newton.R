# issue: 560
# Sammon diagonal-Newton step and backtracking diagnostics, independently calculated.
library(MASS)
library(jsonlite)
objective <- function(D,Y) {
  n<-nrow(D); num<-0; den<-0
  for(i in 1:(n-1)) for(j in (i+1):n) {
    d<-D[i,j]; r<-sqrt(sum((Y[i,]-Y[j,])^2))
    num<-num+(d-r)^2/d; den<-den+d
  }
  num/den
}
newton_sweep <- function(D,Y,magic) {
  n<-nrow(D); k<-ncol(Y); den<-sum(D[upper.tri(D)])
  Z<-Y
  for(i in seq_len(n)) for(q in seq_len(k)) {
    grad<-0; hess<-0
    for(j in seq_len(n)) if(j!=i) {
      v<-Z[i,q]-Z[j,q]; r<-sqrt(sum((Z[i,]-Z[j,])^2)); d<-D[i,j]
      if(r>0) {
        a<-1/d-1/r
        grad<-grad+a*v
        hess<-hess+a+v^2/r^3
      }
    }
    grad<-2*grad/den; hess<-2*hess/den
    if(is.finite(grad) && is.finite(hess) && abs(hess)>0)
      Z[i,q]<-Z[i,q]-magic*grad/abs(hess)
  }
  Z
}
sw<-as.matrix(dist(swiss)); y0<-cmdscale(dist(swiss),k=2)
magic_grid<-0.5*0.2^(0:20)
one<-lapply(magic_grid,function(m) {
  y1<-newton_sweep(sw,y0,m)
  c(magic=m,stress=objective(sw,y1))
})
run <- function(d,...) {
  txt<-capture.output(f<-sammon(d,...))
  list(stress=f$stress,points=f$points,printed=txt)
}
small<-matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE)
ds<-dist(small)
out<-list(swiss_initial=objective(sw,y0),swiss_magic_grid=do.call(rbind,one),
  swiss_r_magic_05=run(dist(swiss),magic=0.5,niter=1),
  swiss_r_magic_02=run(dist(swiss),magic=0.2,niter=1),
  small_default=run(ds),small_magic_05=run(ds,magic=0.5,niter=30),
  small_magic_02=run(ds,magic=0.2,niter=30),
  tight_small=run(ds,niter=100000,tol=1e-14),
  tight_eurodist=run(eurodist,niter=100000,tol=1e-14),
  tight_usarrests=run(dist(USArrests),niter=100000,tol=1e-14))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
