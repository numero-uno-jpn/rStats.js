# issue: 545
# Additional public-output thresholds, extreme inputs, and scale/size probes.
suppressPackageStartupMessages(library(quantreg))
suppressPackageStartupMessages(library(geepack))
suppressPackageStartupMessages(library(glmnet))
suppressPackageStartupMessages(library(jsonlite))
capture <- function(expr) {
  warn <- character()
  val <- withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),
    warning=function(w){warn<<-c(warn,conditionMessage(w));invokeRestart("muffleWarning")})
  if(inherits(val,"caught")) return(list(error=val$message,warnings=warn))
  list(value=val,warnings=warn)
}
tab <- function(x) { z<-as.matrix(x); list(rows=rownames(z),cols=colnames(z),nrow=nrow(z),ncol=ncol(z),values=as.numeric(z)) }
out <- list()
d <- data.frame(a=seq(-2,2,length.out=60),b=sin(seq_len(60)*.3))
d$y <- 1+1.2*d$a-.6*d$b+sin(seq_len(60)*.7)*.4
for(tol in c(1e-14,1e-16,1e-20)) out[[paste0("rq_",format(tol,scientific=TRUE))]] <- capture({
 f<-rq(y~a+b,data=d,tau=.5,method="fn",eps=tol)
 s<-summary(f,se="nid",covariance=TRUE)
 nd<-data.frame(a=c(-1.5,-.25,.5,1.75),b=c(.2,-.7,.1,.9))
 list(coef=coef(f),residuals=residuals(f),fitted=fitted(f),rho=f$rho,
      summary=tab(coef(s)),covariance=tab(s$cov),
      prediction=predict(f,newdata=nd),
      none=tab(predict(f,newdata=nd,interval="confidence",type="none")),
      direct=tab(predict(f,newdata=nd,interval="confidence",type="direct")))
})
out$rqAnova <- capture({
 f<-rq(y~a+b,data=d,tau=.5,method="fn",eps=1e-14)
 r<-rq(y~a,data=d,tau=.5,method="fn",eps=1e-14)
 m<-rq(y~a+b,data=d,tau=c(.25,.5,.75),method="fn",eps=1e-14)
 list(nested=tab(anova(f,r)$table),joint=tab(anova(m,joint=TRUE)$table),
      separate=tab(anova(m,joint=FALSE)$table))
})
g <- data.frame(id=rep(1:12,each=3),wave=rep(1:3,12),x=rep(c(-1,0,1),12),
 y=c(1.7534,2.9203,2.5018,2.8479,3.1191,3.3040,1.9940,2.9519,3.3162,
 2.0370,3.1600,3.7074,2.1179,2.7573,3.5305,1.8430,2.5981,3.7241,
 2.0848,2.1128,3.2114,2.4783,2.6839,3.3756,2.4709,3.7123,3.0934,
 2.8241,2.1850,3.5375,1.5652,3.4757,3.8670,2.7189,2.3572,3.7923))
for(cs in c("independence","exchangeable","ar1","unstructured")) for(tol in c(1e-10,1e-12,1e-14))
 out[[paste0("gee_",cs,"_",format(tol,scientific=TRUE))]] <- capture({
 f<-geeglm(y~x,id=id,waves=wave,data=g,family=gaussian,corstr=cs,
           control=geese.control(epsilon=tol,maxit=500))
 s<-summary(f)
 list(coef=coef(f),vcov=tab(vcov(f)),summary=tab(coef(s)),corr=tab(s$corr),
      dispersion=tab(s$dispersion),fitted=fitted(f),residuals=residuals(f),qic=as.numeric(QIC(f)))
 })
set.seed(913); X<-matrix(rnorm(240),60,4); y<-1.5+.7*X[,1]-.4*X[,2]+rnorm(60,sd=.2); fold<-rep(1:5,12)
for(tol in c(1e-14,1e-16,1e-20)) out[[paste0("glmnet_",format(tol,scientific=TRUE))]] <- capture({
 f<-glmnet(X,y,alpha=.5,nlambda=12,control=list(thresh=tol,maxit=1e7))
 cv<-cv.glmnet(X,y,alpha=.5,foldid=fold,nlambda=12,keep=TRUE,control=list(thresh=tol,maxit=1e7))
 list(lambda=f$lambda,a0=f$a0,beta=tab(f$beta),df=f$df,devRatio=f$dev.ratio,
      cvLambda=cv$lambda,cvm=cv$cvm,cvsd=cv$cvsd,lambdaMin=cv$lambda.min,
      lambda1se=cv$lambda.1se,preval=tab(cv$fit.preval))
})
out$scale <- list()
xx<-cbind(a=seq(-1,1,length.out=40),b=sin(seq_len(40)*.4)); yy<-1+.8*xx[,1]-.3*xx[,2]+cos(seq_len(40)*.7)*.1
for(mult in c(1e100,1e-100)) {
 out$scale[[paste0("x",format(mult,scientific=TRUE))]]<-capture({
  f<-rq(yy~I(xx[,1]*mult)+xx[,2],method="fn",eps=1e-14);coef(f)
 })
 out$scale[[paste0("y",format(mult,scientific=TRUE))]]<-capture({
  f<-rq(I(yy*mult)~xx[,1]+xx[,2],method="fn",eps=1e-14);coef(f)
 })
}
out$nonfinite <- list()
for(bad in c(NaN,Inf,-Inf)) {
 badY<-yy;badY[2]<-bad
 out$nonfinite[[paste0("rq_y_",bad)]]<-capture({ f<-rq(badY~xx[,1]+xx[,2],method="fn"); list(coef=coef(f),rho=f$rho) })
 zz<-xx;zz[2,1]<-bad
 out$nonfinite[[paste0("glmnet_x_",bad)]]<-capture({ f<-glmnet(zz,yy,nlambda=5); list(lambda=f$lambda,coef=as.matrix(coef(f))) })
}
out$weights <- lapply(c(1e-8,3,1e8),function(mult) capture({
 w<-rep(mult,length(yy))
 list(rq=coef(rq(yy~xx[,1]+xx[,2],weights=w,method="fn")),
      gee=coef(geeglm(yy~xx[,1]+xx[,2],id=rep(1:20,each=2),weights=w,corstr="exchangeable")),
      glmnet=glmnet(xx,yy,weights=w,nlambda=5)$lambda)
}))
n<-100000; lx<-cbind(a=((seq_len(n)*37)%%1009)/1009,b=((seq_len(n)*73)%%1013)/1013)
ly<-1.5+.8*lx[,1]-.4*lx[,2]+.2*(((seq_len(n)*97)%%101)-50)/50
out$timing <- list()
out$timing$rq_fn <- capture(as.numeric(system.time(rq(ly~lx[,1]+lx[,2],method="fn",eps=1e-10,maxit=200))["elapsed"]))
gn<-10000; gd<-data.frame(id=rep(seq_len(gn),each=2),wave=rep(1:2,gn),x=rep(0:1,gn),
 y=rep(1:2,gn)+rep(seq_len(gn)%%7,each=2)/10)
for(cs in c("independence","exchangeable")) out$timing[[paste0("gee_",cs)]]<-capture(
 as.numeric(system.time(geeglm(y~x,id=id,waves=wave,data=gd,corstr=cs))["elapsed"]))
gx<-matrix(rnorm(n*20),n,20); gy<-1+gx[,1]-.5*gx[,2]+rnorm(n,sd=.5)
for(fam in c("gaussian","binomial")) out$timing[[paste0("glmnet_",fam)]]<-capture(
 as.numeric(system.time(glmnet(gx,if(fam=="gaussian")gy else as.numeric(gy>median(gy)),
                               family=fam,nlambda=20))["elapsed"]))
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
