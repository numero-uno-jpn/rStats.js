# issue: 545
# rerun after independent formula probes
# rerun after stage1 formula verification
# batch rerun after reserved-token fix
# batch rerun after clean-room script correction
# Seed-consumption and documented bootstrap-output experiment; no implementation inspection.
suppressMessages(library(quantreg));library(jsonlite)
run<-function(expr){w<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w));list(value=v,warnings=w)}
tab<-function(x){if(is.null(x))return(NULL);z<-as.matrix(x);list(dim=dim(z),head=unname(z[seq_len(min(6,nrow(z))),seq_len(min(6,ncol(z))),drop=FALSE]))}
sig<-function(s)list(length=length(s),first=unname(s[seq_len(min(8,length(s)))]),last=unname(tail(s,8)))
data(engel);d<-engel;X<-model.matrix(foodexp~income,d);y<-d$foodexp;n<-length(y);R<-40;tau<-.5
out<-list(n=n,R=R,tau=tau,X=tab(X),y=y,bootRuns=list())
for(bs in c("xy","pwy","mcmb","wxy")){
 set.seed(1);seed0<-.Random.seed
 z<-run(boot.rq(X,y,tau=tau,R=R,bsmethod=bs))
 seed1<-.Random.seed
 set.seed(1);sample.int(n,n*R,replace=TRUE);ss<-.Random.seed
 set.seed(1);Uxy<-matrix(sample.int(n,n*R,replace=TRUE),nrow=n)
 set.seed(1);Upwy<-matrix(runif(n*R),nrow=n)
 set.seed(1);Uwxy<-matrix(rexp(n*R),nrow=n
 set.seed(1);rexp(n*R);seedExp<-.Random.seed
 set.seed(1);runif(n*R);su<-.Random.seed
 set.seed(1);rbinom(n*R,1,tau);sb<-.Random.seed
 set.seed(1);rnorm(n*R);sn<-.Random.seed
 out$bootRuns[[bs]]<-list(seedBefore=sig(seed0),seedAfter=sig(seed1),
   matches=list(sample=identical(seed1,ss),xyU=identical(z$value$U,Uxy),pwyU=identical(z$value$U,Upwy),wxyU=identical(z$value$U,Uwxy),exponential=identical(seed1,seedExp),uniform=identical(seed1,su),
                bernoulli=identical(seed1,sb),normal=identical(seed1,sn)),
   result=if(!is.null(z$value))list(B=tab(z$value$B),U=tab(z$value$U)) else z)
}
out$summarySeed<-run({set.seed(1);f<-rq(foodexp~income,tau=tau,data=d);s<-summary(f,se="boot",bsmethod="xy",R=R);list(table=tab(coef(s)),seed=sig(.Random.seed))})
out$xyRepeated<-run({set.seed(1);b1<-boot.rq(X,y,tau=tau,R=R,bsmethod="xy");set.seed(1);b2<-boot.rq(X,y,tau=tau,R=R,bsmethod="xy");list(identical=identical(b1$B,b2$B),B=tab(b1$B),U=tab(b1$U))})
out$seedProbe<-run({
 R2<-13;t2<-.25;z<-list()
 for(bs in c("xy","pwy","mcmb","wxy")){
  set.seed(7);b<-boot.rq(X,y,tau=t2,R=R2,bsmethod=bs);after<-.Random.seed
  set.seed(7);sample.int(n,n*R2,replace=TRUE);seedSample<-.Random.seed
  set.seed(7);Uxy<-matrix(sample.int(n,n*R2,replace=TRUE),nrow=n)
  set.seed(7);Upwy<-matrix(runif(n*R2),nrow=n)
  set.seed(7);Uwxy<-matrix(rexp(n*R2),nrow=n
  set.seed(7);runif(n*R2);seedUniform<-.Random.seed
  set.seed(7);rnorm(n*R2);seedNormal<-.Random.seed
  set.seed(7);rexp(n*R2);seedExp<-.Random.seed
  z[[bs]]<-list(matches=list(sample=identical(after,seedSample),xyU=identical(b$U,Uxy),pwyU=identical(b$U,Upwy),wxyU=identical(b$U,Uwxy),uniform=identical(after,seedUniform),
      normal=identical(after,seedNormal),exponential=identical(after,seedExp)),
      B=tab(b$B),U=tab(b$U))
 }
 z
})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
