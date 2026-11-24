# issue: 560
# Distinguish tie-block isotonic regression from ordered-pair regression and stress normalizations.
library(MASS)
library(jsonlite)
pava_weighted <- function(y,w) {
 means<-numeric(0);weights<-numeric(0);starts<-integer(0);ends<-integer(0)
 for(i in seq_along(y)) {
  means<-c(means,y[i]);weights<-c(weights,w[i]);starts<-c(starts,i);ends<-c(ends,i)
  while(length(means)>1 && means[length(means)-1]>means[length(means)]) {
   n<-length(means);nw<-weights[n-1]+weights[n]
   means[n-1]<-(means[n-1]*weights[n-1]+means[n]*weights[n])/nw
   weights[n-1]<-nw;ends[n-1]<-ends[n];means<-means[-n];weights<-weights[-n]
   starts<-starts[-n];ends<-ends[-n]
  }
 }
 out<-numeric(sum(w))
 for(i in seq_along(means))out[starts[i]:ends[i]]<-means[i]
 out
}
metrics <- function(r,fit) {
 ss<-sum((r-fit)^2); sr<-sum(r^2); sf<-sum(fit^2)
 sc<-sqrt(sr/sf)
 c(stress_config_den=100*sqrt(ss/sr),stress_fit_den=100*sqrt(ss/sf),
   stress_normfit=100*sqrt(sum((r-fit*sc)^2)/sr),norm_factor=sc)
}
evalfit <- function(d,y,k=2,p=2) {
 f<-isoMDS(d,y=y,k=k,p=p,tol=1e-10,maxit=5000)
 dv<-as.vector(d);rv<-as.vector(dist(f$points));o<-order(dv,seq_along(dv))
 fit_tie<-{u<-unique(dv[o]);grp<-match(dv[o],u);sums<-as.numeric(rowsum(rv[o],grp,reorder=TRUE));w<-as.numeric(tabulate(grp,length(u)));pava_weighted(sums/w,w)[grp]}
 fit_index<-isoreg(rv[o])$yf
 oa<-order(dv,rv,seq_along(dv));fit_asc<-isoreg(rv[oa])$yf
 od<-order(dv,-rv,seq_along(dv));fit_desc<-isoreg(rv[od])$yf
 list(r_stress=f$stress,n_pairs=length(dv),n_unique=length(unique(dv)),
  tie_block=metrics(rv[o],fit_tie),
  fixed_pair_index=metrics(rv[o],fit_index),
  fixed_tie_r_ascending=metrics(rv[oa],fit_asc),
  fixed_tie_r_descending=metrics(rv[od],fit_desc),
  tie_groups=lapply(unique(dv[duplicated(dv)]),function(v){ii<-which(dv==v);list(dissimilarity=v,pair_index=ii,configuration_distance=rv[ii])}))
}
small<-matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE)
grid<-as.matrix(expand.grid(x=0:2,y=0:2));perturbed<-grid+0.1*cbind(sin(1:9),cos(1:9))
nonE<-as.dist(matrix(c(0,1,1,3,1,0,1,1,1,1,0,1,3,1,1,0),4))
out<-list(small=evalfit(dist(small),cmdscale(dist(small),k=2)),
 small_k1=evalfit(dist(small),cmdscale(dist(small),k=1),k=1),
 grid_ties=evalfit(dist(grid),perturbed),eurodist=evalfit(eurodist,cmdscale(eurodist,k=2)),
 swiss=evalfit(dist(swiss),cmdscale(dist(swiss),k=2)),
 usarrests=evalfit(dist(USArrests),cmdscale(dist(USArrests),k=2)),
 non_euclidean=evalfit(nonE,cmdscale(nonE,k=2)))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
