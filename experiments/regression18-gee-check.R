# issue: 545
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
  ans[[st]]<-list(coef=unname(coef(f)),summary=tab(coef(summary(f))),vcov=tab(vcov(f)))
 }
 ans
})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
