# issue: 560
# Sammon one-coordinate and one-point line-search tests, plus tight-stop diagnostics.
library(MASS)
library(jsonlite)
objective<-function(D,Y){n<-nrow(D);a<-0;b<-0;for(i in 1:(n-1))for(j in (i+1):n){d<-D[i,j];r<-sqrt(sum((Y[i,]-Y[j,])^2));a<-a+(d-r)^2/d;b<-b+d};a/b}
deriv<-function(D,Y,i,q){n<-nrow(D);den<-sum(D[upper.tri(D)]);g<-0;h<-0
 for(j in seq_len(n))if(j!=i){v<-Y[i,q]-Y[j,q];r<-sqrt(sum((Y[i,]-Y[j,])^2));d<-D[i,j];if(r>0){a<-1/d-1/r;g<-g+a*v;h<-h+a+v^2/r^3}}
 c(gradient=2*g/den,hessian=2*h/den)}
sw<-as.matrix(dist(swiss));y0<-cmdscale(dist(swiss),k=2);mg<-0.5*0.2^(0:20);base<-objective(sw,y0)
coord<-matrix(NA_real_,nrow=nrow(y0)*ncol(y0),ncol=length(mg))
point<-matrix(NA_real_,nrow=nrow(y0),ncol=length(mg))
for(i in seq_len(nrow(y0))) {
 for(q in seq_len(ncol(y0))) {
  z<-deriv(sw,y0,i,q)
  for(j in seq_along(mg)){Y<-y0;Y[i,q]<-Y[i,q]-mg[j]*z[1]/abs(z[2]);coord[(i-1)*ncol(y0)+q,j]<-objective(sw,Y)}
 }
 for(j in seq_along(mg)){Y<-y0;for(q in seq_len(ncol(y0))){z<-deriv(sw,y0,i,q);Y[i,q]<-Y[i,q]-mg[j]*z[1]/abs(z[2])};point[i,j]<-objective(sw,Y)}
}
small<-matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE);ds<-dist(small)
run<-function(n,tol=1e-14){txt<-capture.output(f<-sammon(ds,niter=n,tol=tol));list(niter=n,stress=f$stress,printed=txt)}
out<-list(swiss_initial=base,magic=mg,first_coordinate=coord[1,],first_point=point[1,],
 coordinates_with_any_descent=rowSums(coord<base)<length(mg),
 coordinates_with_no_descent=which(rowSums(coord<base)==0),
 points_with_any_descent=rowSums(point<base)<length(mg),
 best_stress_by_magic=apply(coord,2,min),
 small_niter=lapply(c(79,80,81,89,90,91),run),
 small_tol_1e30=lapply(c(80,81,89,90),function(n)run(n,1e-30)))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
