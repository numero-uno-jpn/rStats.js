# issue: 560
# Compact adjusted-inertia and JCA iteration/percentage diagnostics.
library(ca)
library(jsonlite)
dat<-wg93[,1:4]; Q<-ncol(dat); J<-sum(vapply(dat,function(x)nlevels(x),integer(1)))
adj<-mjca(dat,lambda="adjusted"); burt<-mjca(dat,lambda="Burt")
summ<-function(x) {
 s<-summary(x)
 sc<-s$scree
 list(names=names(x),sv=as.numeric(x$sv),inertia_e=as.numeric(x$inertia.e),
  inertia_t=as.numeric(x$inertia.t),inertia_et=as.character(x$inertia.et),
  inertia_et_type=typeof(x$inertia.et),inertia_et_class=class(x$inertia.et),
  scree_names=names(sc),scree=as.matrix(sc))
}
jca<-function(...) { x<-mjca(dat,lambda="JCA",...); list(sv=as.numeric(x$sv),
 inertia_t=as.numeric(x$inertia.t),inertia_et=as.numeric(x$inertia.et),
 colpcoord=as.matrix(x$colpcoord)) }
out<-list(Q=Q,J=J,burt_inertia_t=as.numeric(burt$inertia.t),
 adjusted=summ(adj),jca_maxit0=jca(maxit=0),jca_maxit1=jca(maxit=1),
 jca_maxit5=jca(maxit=5),jca_maxit50=jca(maxit=50),
 jca_epsilon_1e10=jca(epsilon=1e-10,maxit=500))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
