# issue: 545
# Oracle for geeglm (geepack 1.3.13), R 4.6.2. Public functions and documented quantities only.
suppressMessages(library(geepack))
library(jsonlite)
run <- function(expr) {
  warns<-character(0); msgs<-character(0)
  value<-withCallingHandlers(tryCatch(expr,error=function(e) structure(list(message=conditionMessage(e)),class="caught")),
    warning=function(w){warns<<-c(warns,conditionMessage(w));invokeRestart("muffleWarning")},
    message=function(m){msgs<<-c(msgs,conditionMessage(m));invokeRestart("muffleMessage")})
  if(inherits(value,"caught")) return(list(error=value$message,warnings=warns,messages=msgs))
  list(value=value,warnings=warns,messages=msgs)
}
tab<-function(m) list(rows=rownames(m),cols=colnames(m),values=unname(m))
capture<-function(f) {
 s<-summary(f)
 list(coefficients=coef(f),vcov=tab(vcov(f)),summary=tab(coef(s)),
      corr=run(tab(as.matrix(s$corr))),dispersion=run(tab(as.matrix(s$dispersion))),
      fitted=unname(fitted(f))[seq_len(min(10,length(fitted(f))))],
      residuals=unname(residuals(f,type="pearson"))[seq_len(min(10,length(residuals(f,type="pearson"))))],
      qic=run(QIC(f)))
}
compareFit<-function(expr) {
 f<-eval.parent(substitute(expr))
 tight<-eval.parent(substitute(expr))
 list(default=capture(f),fitTight=list(coefficients=coef(tight),vcov=tab(vcov(tight)),summary=tab(coef(summary(tight)))))
}
out<-list()
data(dietox);data(ohio);data(seizure);data(respiratory);dietox$Cu<-factor(dietox$Cu)
for(corr in c("independence","exchangeable","ar1","unstructured")) {
 out[[paste0("dietox_gaussian_",corr)]]<-run({
  f<-geeglm(Weight~Time+Cu,id=Pig,data=dietox,corstr=corr)
  ft<-geeglm(Weight~Time+Cu,id=Pig,data=dietox,corstr=corr,control=geese.control(epsilon=1e-10,maxit=200))
  list(default=capture(f),fitTight=list(coefficients=coef(ft),vcov=tab(vcov(ft)),summary=tab(coef(summary(ft)))),
       anova=run(as.list(anova(f))))
 })
 out[[paste0("ohio_binomial_",corr)]]<-run({
  f<-geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr=corr)
  ft<-geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr=corr,control=geese.control(epsilon=1e-10,maxit=200))
  list(default=capture(f),fitTight=list(coefficients=coef(ft),vcov=tab(vcov(ft))))
 })
}
for(corr in c("independence","exchangeable","ar1")) {
 out[[paste0("dietox_gamma_",corr)]]<-run({
  f<-geeglm(Weight~Time+Cu,id=Pig,data=dietox,family=Gamma(link="log"),corstr=corr)
  ft<-geeglm(Weight~Time+Cu,id=Pig,data=dietox,family=Gamma(link="log"),corstr=corr,control=geese.control(epsilon=1e-10,maxit=200))
  list(default=capture(f),fitTight=list(coefficients=coef(ft),vcov=tab(vcov(ft))))
 })
}
sz<-reshape(seizure,varying=list(c("base","y1","y2","y3","y4")),v.names="y",times=0:4,direction="long")
sz<-sz[order(sz$id,sz$time),];sz$t<-ifelse(sz$time==0,8,2);sz$x<-ifelse(sz$time==0,0,1)
out$poisson_offset<-run({f<-geeglm(y~offset(log(t))+x+trt+x:trt,id=id,data=sz,family=poisson,corstr="exchangeable");
 ft<-geeglm(y~offset(log(t))+x+trt+x:trt,id=id,data=sz,family=poisson,corstr="exchangeable",control=geese.control(epsilon=1e-10,maxit=200));
 list(default=capture(f),fitTight=coef(ft))})
for(kind in c("jack","j1s","fij")) out[[paste0("jack_",kind)]]<-run(capture(geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="exchangeable",std.err=kind)))
out$fixed_scale<-run(capture(geeglm(Weight~Time,id=Pig,data=dietox,corstr="ar1",scale.fix=TRUE,scale.value=4)))
out$weights<-run(capture(geeglm(Weight~Time,id=Pig,data=dietox,corstr="exchangeable",weights=rep(c(1,2),length.out=nrow(dietox)))))
out$waves<-run(capture(geeglm(outcome~treat+sex+age+baseline,id=interaction(center,id),waves=visit,data=respiratory,family=binomial,corstr="ar1")))
out$userdefined<-run({
 z<-genZcor(clusz=table(dietox$Pig),waves=dietox$Time,corstrv=4)
 f<-geeglm(Weight~Time,id=Pig,data=dietox,corstr="userdefined",zcor=z)
 capture(f)
})
out$fixed<-run({
 cm<-matrix(c(1,.5,.3,.2,.5,1,.5,.3,.3,.5,1,.5,.2,.3,.5,1),4,4)
 z<-fixed2Zcor(cm,id=ohio$id,waves=ohio$age+3)
 f<-geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="fixed",zcor=z)
 list(default=capture(f),fitTight=coef(geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="fixed",zcor=z,control=geese.control(epsilon=1e-10,maxit=200))))
})
out$nested_anova<-run({a<-geeglm(resp~age,id=id,data=ohio,family=binomial,corstr="exchangeable");b<-geeglm(resp~age+smoke+age:smoke,id=id,data=ohio,family=binomial,corstr="exchangeable");as.list(anova(b,a))})
out$predict<-run({f<-geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="ar1");nd<-data.frame(age=c(-2,0,1),smoke=c(0,1,1));list(link=predict(f,newdata=nd),response=predict(f,newdata=nd,type="response"))})
out$unsorted_id<-run({d<-dietox[order(dietox$Time,-dietox$Pig),];capture(geeglm(Weight~Time,id=Pig,data=d,corstr="exchangeable"))})
out$singletons<-run(capture(geeglm(mpg~wt,id=seq_len(nrow(mtcars)),data=mtcars,corstr="exchangeable")))
out$missing<-run(geeglm(Weight~Time,id=Pig,data=transform(dietox,Weight=replace(Weight,c(3,50),NA)),corstr="ar1"))
out$separation<-run(capture(geeglm(y~x,id=g,family=binomial,corstr="exchangeable",data=data.frame(x=1:12,y=rep(0:1,each=6),g=rep(1:4,3)))))
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
