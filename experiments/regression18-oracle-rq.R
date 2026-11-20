# issue: 545
# extend formula checks and public-output coverage
# rerun after independent formula probes
# RQ public-output oracle. Numerical inference inputs are emitted for independent formula checks.
suppressMessages(library(quantreg));library(jsonlite)
run<-function(expr){w<-character();m<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")},message=function(x){m<<-c(m,conditionMessage(x));invokeRestart("muffleMessage")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w,messages=m));list(value=v,warnings=w,messages=m)}
tab<-function(x){z<-as.matrix(x);list(rows=rownames(z),cols=colnames(z),values=unname(z))}
d<-data.frame(x=c(-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,11,12),y=c(2,1,4,2,5,3,8,5,9,7,11,8,14,10,15,13))
X<-model.matrix(y~x,d);n<-nrow(d)
out<-list(data=list(X=tab(X),y=d$y),
 bandwidth=list(hs=sapply(c(.25,.5,.75),function(t)bandwidth.rq(t,n,hs=TRUE)),
                bofinger=sapply(c(.25,.5,.75),function(t)bandwidth.rq(t,n,hs=FALSE))))
for(tau in c(.25,.5,.75)) for(method in c("br","fn")) out[[paste(method,tau,sep="_")]]<-run({
 f<-rq(y~x,data=d,tau=tau,method=method)
 ft<-if(method=="fn")rq(y~x,data=d,tau=tau,method=method,eps=1e-12) else f
 ans<-list(coef=unname(coef(f)),rho=unname(f$rho),residuals=unname(residuals(f)),
           tightCoef=unname(coef(ft)),tightRho=unname(ft$rho))
 if(tau==.5){
  h<-bandwidth.rq(tau,n,hs=TRUE);hb<-bandwidth.rq(tau,n,hs=FALSE)
  fm<-rq(y~x,data=d,tau=tau-h,method=method);fp<-rq(y~x,data=d,tau=tau+h,method=method)
  fmb<-rq(y~x,data=d,tau=tau-hb,method=method);fpb<-rq(y~x,data=d,tau=tau+hb,method=method)
  spars<-as.vector(X%*%(coef(fp)-coef(fm))/(2*h))
  sparsB<-as.vector(X%*%(coef(fpb)-coef(fmb))/(2*hb))
  rr<-residuals(f)
  si<-summary(f,se="iid",covariance=TRUE)
  sn<-summary(f,se="nid",covariance=TRUE)
  snB<-summary(f,se="nid",hs=FALSE,covariance=TRUE)
  sk<-summary(f,se="ker",covariance=TRUE)
  sr<-summary(f,se="rank")
  ans$bandwidth<-list(hs=h,bofinger=hb)
  ans$coefMinus<-unname(coef(fm));ans$coefPlus<-unname(coef(fp))
  ans$conditionalSparsity<-spars;ans$conditionalDensity<-1/spars
  ans$conditionalSparsityBofinger<-sparsB;ans$conditionalDensityBofinger<-1/sparsB
  ans$residualSparsity<-list(type1=diff(quantile(rr,c(tau-h,tau+h),type=1,names=FALSE))/(2*h),
                             type7=diff(quantile(rr,c(tau-h,tau+h),type=7,names=FALSE))/(2*h))
  ans$iid<-tab(coef(si));ans$iidCov<-tab(si$cov)
  ak<-akj(sort(rr),z=0)
  ans$iidDensity<-list(density=ak$dens,sparsity=1/ak$dens,bandwidth=ak$h)
  ans$nid<-tab(coef(sn));ans$nidCov<-tab(sn$cov);ans$nidHinv<-tab(sn$Hinv);ans$nidJ<-tab(sn$J)
  ans$nidBofinger<-tab(coef(snB));ans$nidBofingerCov<-tab(snB$cov)
  ans$ker<-tab(coef(sk));ans$kerCov<-tab(sk$cov);ans$kerHinv<-tab(sk$Hinv);ans$kerJ<-tab(sk$J)
  ans$rank<-tab(coef(sr))
  ans$rankNonIid<-tab(coef(summary(f,se="rank",iid=FALSE)))
  ans$prediction<-unname(predict(f,newdata=data.frame(x=c(-2,0,5))))
 }
 ans
})
out$defaultSEswitch<-run({
 ans<-list()
 for(n0 in c(1000,1001)){
  xx<-sin(seq_len(n0)*.17); yy<-1+2*xx+cos(seq_len(n0)*.31)
  ff<-rq(yy~xx,tau=.5)
  ans[[as.character(n0)]]<-list(default=tab(coef(summary(ff))),
    rank=tab(coef(summary(ff,se="rank"))),nid=tab(coef(summary(ff,se="nid"))))
 }
 ans
})
out$stacklossNid<-run({
 data(stackloss)
 f<-rq(stack.loss~.,data=stackloss,tau=.5)
 s<-summary(f,se="nid")
 list(coef=tab(coef(s)))
})
out$weighted<-run({w<-seq(.5,2,length.out=n);f<-rq(y~x,data=d,tau=.5,weights=w);list(weights=w,coef=unname(coef(f)),rho=unname(f$rho),residuals=unname(residuals(f)),nid=tab(coef(summary(f,se="nid"))))})
out$rankTests<-run({f<-rq(y~x,data=d,tau=.5);list(rank=tab(coef(summary(f,se="rank",alpha=.1))),rank95=tab(coef(summary(f,se="rank",alpha=.05))))})
out$multiTau<-run({f<-rq(y~x,data=d,tau=c(.25,.5,.75));list(coef=tab(coef(f)),joint=tab(anova(f)$table),separate=tab(anova(f,joint=FALSE)$table))})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
