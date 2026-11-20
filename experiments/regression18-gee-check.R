# issue: 545
# batch rerun after clean-room script correction
# Small deterministic GEE data for independent moment/covariance calculations.
suppressMessages(library(geepack));library(jsonlite)
run<-function(expr){w<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w));list(value=v,warnings=w)}
tab<-function(x){z<-as.matrix(x);list(rows=rownames(z),cols=colnames(z),values=unname(z))}
d<-data.frame(id=rep(1:6,each=3),wave=rep(1:3,6),x=rep(c(-1,0,1),6),
 y=c(2.1,2.8,3.4,1.5,2.3,3.1,3.2,3.9,4.7,2.4,3.0,3.8,1.1,2.0,2.7,2.8,3.5,4.2))
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
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
