# issue: 545
# Seed-consumption and documented bootstrap-output experiment; no implementation inspection.
suppressMessages(library(quantreg));library(jsonlite)
run<-function(expr){w<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w));list(value=v,warnings=w)}
tab<-function(x){if(is.null(x))return(NULL);z<-as.matrix(x);list(dim=dim(z),head=unname(z[seq_len(min(6,nrow(z))),seq_len(min(6,ncol(z))),drop=FALSE]))}
data(engel);d<-engel;X<-model.matrix(foodexp~income,d);y<-d$foodexp;n<-length(y);R<-40;tau<-.5
out<-list(n=n,R=R,tau=tau,X=tab(X),y=y,methods=list())
for(bs in c("xy","pwy","mcmb","wxy")){
 set.seed(1);seed0<-.Random.seed
 z<-run(boot.rq(X,y,tau=tau,R=R,bsmethod=bs))
 seed1<-.Random.seed
 out$methods[[bs]]<-list(seedBefore=seed0,seedAfter=seed1,result=if(!is.null(z$value))list(B=tab(z$value$B),U=tab(z$value$U)) else z)
 set.seed(1);sample.int(n,n*R,replace=TRUE);out$methods[[bs]]$seedSample<-.Random.seed
 set.seed(1);rexp(n*R);out$methods[[bs]]$seedExp<-.Random.seed
 set.seed(1);runif(n*R);out$methods[[bs]]$seedUniform<-.Random.seed
 set.seed(1);rbinom(n*R,1,tau);out$methods[[bs]]$seedBernoulli<-.Random.seed
 set.seed(1);rnorm(n*R);out$methods[[bs]]$seedNormal<-.Random.seed
}
out$summarySeed<-run({set.seed(1);f<-rq(foodexp~income,tau=tau,data=d);s<-summary(f,se="boot",bsmethod="xy",R=R);list(table=tab(coef(s)),seed=.Random.seed)})
out$xyRepeated<-run({set.seed(1);b1<-boot.rq(X,y,tau=tau,R=R,bsmethod="xy");set.seed(1);b2<-boot.rq(X,y,tau=tau,R=R,bsmethod="xy");list(identical=identical(b1$B,b2$B),B=tab(b1$B),U=tab(b1$U))})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
