# issue: 560
# R endpoint evaluation with correctly normalized isotonic disparities.
library(MASS)
library(jsonlite)
pava_weighted <- function(y,w) {
  means<-numeric(0); weights<-numeric(0); starts<-integer(0); ends<-integer(0)
  for(i in seq_along(y)) {
    means<-c(means,y[i]); weights<-c(weights,w[i]); starts<-c(starts,i); ends<-c(ends,i)
    while(length(means)>1 && means[length(means)-1]>means[length(means)]) {
      n<-length(means); nw<-weights[n-1]+weights[n]
      means[n-1]<-(means[n-1]*weights[n-1]+means[n]*weights[n])/nw
      weights[n-1]<-nw; ends[n-1]<-ends[n]; means<-means[-n];weights<-weights[-n]
      starts<-starts[-n];ends<-ends[-n]
    }
  }
  out<-numeric(sum(w))
  for(i in seq_along(means)) out[starts[i]:ends[i]]<-means[i]
  out
}
stress_primary <- function(d,r) {
  o<-order(d,seq_along(d)); ds<-d[o]; rs<-r[o]
  u<-unique(ds); grp<-match(ds,u)
  sums<-as.numeric(rowsum(rs,grp,reorder=TRUE)); w<-as.numeric(tabulate(grp,length(u)))
  fitted_group<-pava_weighted(sums/w,w); fitted<-fitted_group[grp]
  scale<-sqrt(sum(rs^2)/sum(fitted^2)); fitted<-fitted*scale
  100*sqrt(sum((rs-fitted)^2)/sum(rs^2))
}
stress_fixed <- function(d,r,secondary) {
  o<-order(d,secondary,seq_along(d)); fit<-isoreg(d[o],r[o])$yf
  fit<-fit*sqrt(sum(r[o]^2)/sum(fit^2))
  100*sqrt(sum((r[o]-fit)^2)/sum(r[o]^2))
}
evalfit <- function(d,y,k=2,p=2) {
  f<-isoMDS(d,y=y,k=k,p=p,tol=1e-10,maxit=5000)
  dv<-as.vector(d); rv<-as.vector(dist(f$points))
  o<-order(dv,seq_along(dv))
  tie_values<-unique(dv[duplicated(dv)])
  tied_pairs<-lapply(tie_values,function(v) {
    ii<-which(dv==v); list(dissimilarity=v,pair_index=ii,configuration_distance=rv[ii])
  })
  list(r_stress=f$stress,primary=stress_primary(dv,rv),
       fixed_original=stress_fixed(dv,rv,seq_along(dv)),
       fixed_reverse=stress_fixed(dv,rv,-seq_along(dv)),
       fixed_r_ascending=stress_fixed(dv,rv,rv),
       fixed_r_descending=stress_fixed(dv,rv,-rv),
       n_pairs=length(dv),n_unique=length(unique(dv)),
       tie_groups=tied_pairs,pair_order_head=head(o,12))
}
small<-matrix(c(1,2,0,4,0,3,-1,5,2,2,7,0,0,0,1),ncol=3,byrow=TRUE)
grid<-as.matrix(expand.grid(x=0:2,y=0:2))
perturbed<-grid+0.1*cbind(sin(1:9),cos(1:9))
nonE<-as.dist(matrix(c(0,1,1,3,1,0,1,1,1,1,0,1,3,1,1,0),4))
out<-list(small=evalfit(dist(small),cmdscale(dist(small),k=2)),
 small_k1=evalfit(dist(small),cmdscale(dist(small),k=1),k=1),
 grid_ties=evalfit(dist(grid),perturbed),
 eurodist=evalfit(eurodist,cmdscale(eurodist,k=2)),
 swiss=evalfit(dist(swiss),cmdscale(dist(swiss),k=2)),
 usarrests=evalfit(dist(USArrests),cmdscale(dist(USArrests),k=2)),
 non_euclidean=evalfit(nonE,cmdscale(nonE,k=2)))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
