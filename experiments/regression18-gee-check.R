# issue: 545
# final targeted rerun for independent formula checks
# extend formula checks and public-output coverage
# rerun after output-size and seed-stream corrections
# rerun after independent formula probes
# batch rerun after reserved-token fix
# batch rerun after clean-room script correction
# Small deterministic GEE data for independent moment/covariance calculations.
suppressMessages(library(geepack));library(jsonlite)
run<-function(expr){w<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w));list(value=v,warnings=w)}
tab<-function(x){z<-as.matrix(x);list(rows=rownames(z),cols=colnames(z),values=unname(z))}
d<-data.frame(id=rep(1:12,each=3),wave=rep(1:3,12),x=rep(c(-1,0,1),12),
 y=c(1.7534,2.9203,2.5018,2.8479,3.1191,3.3040,1.9940,2.9519,3.3162,2.0370,3.1600,3.7074,
 2.1179,2.7573,3.5305,1.8430,2.5981,3.7241,2.0848,2.1128,3.2114,2.4783,2.6839,3.3756,
 2.4709,3.7123,3.0934,2.8241,2.1850,3.5375,1.5652,3.4757,3.8670,2.7189,2.3572,3.7923))
out<-list(data=d,control=geese.control())
for(cs in c("independence","exchangeable","ar1","unstructured")){
 out[[cs]]<-run({
  f<-geeglm(y~x,id=id,waves=wave,data=d,family=gaussian,corstr=cs)
  ft<-geeglm(y~x,id=id,waves=wave,data=d,family=gaussian,corstr=cs,control=geese.control(epsilon=1e-12,maxit=500))
  s<-summary(f);st<-summary(ft)
  list(coef=coef(f),coefTight=coef(ft),fitted=unname(fitted(f)),pearson=unname(residuals(f,type="pearson")),
       vcov=tab(vcov(f)),corr=tab(s$corr),dispersion=tab(s$dispersion),tightCorr=tab(st$corr),
       tightDispersion=tab(st$dispersion),qic=unname(as.numeric(QIC(f))))
 })
}
out$jackknife<-run({
 ids<-sort(unique(d$id))
 deleted<-lapply(ids,function(k)unname(coef(geeglm(y~x,id=id,waves=wave,
      data=d[d$id!=k,],family=gaussian,corstr="exchangeable"))))
 ans<-list(ids=ids,deleted=tab(do.call(rbind,deleted)))
 for(st in c("jack","j1s","fij")){
  f<-geeglm(y~x,id=id,waves=wave,data=d,family=gaussian,corstr="exchangeable",std.err=st)
  ans[[st]]<-list(coef=unname(coef(f)),summary=tab(coef(summary(f))),vcov=tab(vcov(f)),alphaCov=tab(f$geese$valpha),gammaCov=tab(f$geese$vgamma))
 }
 ans
})
out$userdefinedToeplitz<-run({
 Z<-matrix(rep(c(1,0,0,1,1,0),12),ncol=2,byrow=TRUE)
 f<-geeglm(y~x,id=id,waves=wave,data=d,family=gaussian,corstr="userdefined",zcor=Z)
 list(Z=tab(Z),coef=unname(coef(f)),corr=tab(summary(f)$corr),residuals=unname(residuals(f,type="pearson")),dispersion=tab(summary(f)$dispersion))
})
out$wavesGap<-run({
 dg<-d[!(d$id<=6 & d$wave==2),]
 a<-geeglm(y~x,id=id,data=dg,family=gaussian,corstr="ar1",waves=wave)
 b<-geeglm(y~x,id=id,data=dg,family=gaussian,corstr="ar1")
 list(clusterSizes=as.integer(table(dg$id)),withWaves=list(coef=unname(coef(a)),corr=tab(summary(a)$corr)),
      defaultWaves=list(coef=unname(coef(b)),corr=tab(summary(b)$corr)))
})
out$jackknifeBinomial<-run({
 set.seed(1729)
 db<-data.frame(id=rep(1:20,each=3),wave=rep(1:3,20),
  age=rep(seq(20,58,length.out=20),each=3)+rep(c(-1,0,1),20),
  smoke=rep(rep(c(0,1),each=10),each=3))
 eta<--2.8+.04*db$age+.9*db$smoke+.15*db$wave
 db$resp<-rbinom(nrow(db),1,plogis(eta))
 ids0<-1:20
 deleted<-lapply(ids0,function(k)unname(coef(geeglm(resp~age+smoke,id=id,data=db[db$id!=k,],
      family=binomial,corstr="exchangeable"))))
 ans<-list(data=db,ids=ids0,clusterSizes=as.integer(table(db$id)),deleted=tab(do.call(rbind,deleted)))
 for(st in c("jack","j1s","fij")){
  f<-geeglm(resp~age+smoke,id=id,waves=wave,data=db,family=binomial,corstr="exchangeable",std.err=st)
  ans[[st]]<-list(coef=unname(coef(f)),summary=tab(coef(summary(f))),
      alphaVar=as.numeric(diag(f$geese$valpha)),gammaVar=as.numeric(diag(f$geese$vgamma)))
 }
 ans
})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
