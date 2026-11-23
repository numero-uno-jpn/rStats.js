# issue: 560
# JCA iteration measure and adjusted scree-percentage diagnostics.
library(ca)
library(jsonlite)
dat<-wg93[,1:4];Q<-ncol(dat);J<-sum(vapply(dat,function(x)nlevels(x),integer(1)))
adj<-mjca(dat,lambda="adjusted");burt<-mjca(dat,lambda="Burt")
sadj<-summary(adj)$scree
summ<-function(x){s<-summary(x);list(sv=as.numeric(x$sv),inertia_e=as.numeric(x$inertia.e),
 inertia_t=as.numeric(x$inertia.t),inertia_et=as.character(x$inertia.et),
 inertia_et_type=typeof(x$inertia.et),scree=s$scree,JCA_iter=as.numeric(x$JCA.iter))}
jca<-function(...) {x<-mjca(dat,lambda="JCA",...);list(sv=as.numeric(x$sv),
 inertia_t=as.numeric(x$inertia.t),inertia_et=as.numeric(x$inertia.et),JCA_iter=as.numeric(x$JCA.iter))}
out<-list(Q=Q,J=J,burt_inertia_t=as.numeric(burt$inertia.t),
 adjusted=summ(adj),jca_default=jca(),
 jca_by_maxit=lapply(0:6,function(m)jca(maxit=m)),
 jca_maxit50=jca(maxit=50),jca_epsilon_1e10=jca(epsilon=1e-10,maxit=500))
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
