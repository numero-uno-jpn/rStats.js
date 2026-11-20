# issue: 545
# batch rerun after clean-room script correction
# Focused quantile-regression oracle, with public outputs and documented bandwidth helper.
suppressMessages(library(quantreg));library(jsonlite)
run<-function(expr){w<-character();m<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")},message=function(x){m<<-c(m,conditionMessage(x));invokeRestart("muffleMessage")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w,messages=m));list(value=v,warnings=w,messages=m)}
tab<-function(x){z<-as.matrix(x);list(rows=rownames(z),cols=colnames(z),values=unname(z))}
d<-data.frame(x=c(-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,11,12),y=c(2,1,4,2,5,3,8,5,9,7,11,8,14,10,15,13))
X<-model.matrix(y~x,d);n<-nrow(d)
out<-list(data=list(X=tab(X),y=d$y),bandwidth=list(hs=bandwidth.rq(c(.25,.5,.75),n,hs=TRUE),bofinger=bandwidth.rq(c(.25,.5,.75),n,hs=FALSE)))
for(tau in c(.25,.5,.75)) for(method in c("br","fn")) out[[paste(method,tau,sep="_")]]<-run({
 f<-rq(y~x,data=d,tau=tau,method=method)
 ft<-if(method=="fn")rq(y~x,data=d,tau=tau,method=method,eps=1e-12) else f
 list(coef=unname(coef(f)),rho=unname(f$rho),residuals=unname(residuals(f)),
      tightCoef=unname(coef(ft)),tightRho=unname(ft$rho),
      iid=tab(coef(summary(f,se="iid"))),nid=tab(coef(summary(f,se="nid"))),
      nidBofinger=tab(coef(summary(f,se="nid",hs=FALSE))),
      ker=tab(coef(summary(f,se="ker"))),kerCov=unname(summary(f,se="ker",covariance=TRUE)$cov),
      rank=tab(coef(summary(f,se="rank"))),rankNonIid=tab(coef(summary(f,se="rank",iid=FALSE))))
})
out$weighted<-run({w<-seq(.5,2,length.out=n);f<-rq(y~x,data=d,tau=.5,weights=w);list(weights=w,coef=coef(f),rho=f$rho,residuals=unname(residuals(f)),nid=tab(coef(summary(f,se="nid"))))})
out$rankTests<-run({f<-rq(y~x,data=d,tau=.5);list(rank=tab(coef(summary(f,se="rank",alpha=.1))),rank95=tab(coef(summary(f,se="rank",alpha=.05)))})
out$multiTau<-run({f<-rq(y~x,data=d,tau=c(.25,.5,.75));list(coef=tab(coef(f)),joint=tab(anova(f)$table),separate=tab(anova(f,joint=FALSE)$table))})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
