# issue: 545
# Public-output probe of the independence information used by QIC for the AR(1) GEE fit.
suppressPackageStartupMessages(library(geepack))
suppressPackageStartupMessages(library(jsonlite))
gee_check <- data.frame(
  id=rep(1:12,each=3), wave=rep(1:3,12), x=rep(c(-1,0,1),12),
  y=c(
    1.7534,2.9203,2.5018,2.8479,3.1191,3.3040,1.9940,2.9519,3.3162,
    2.0370,3.1600,3.7074,2.1179,2.7573,3.5305,1.8430,2.5981,3.7241,
    2.0848,2.1128,3.2114,2.4783,2.6839,3.3756,2.4709,3.7123,3.0934,
    2.8241,2.1850,3.5375,1.5652,3.4757,3.8670,2.7189,2.3572,3.7923
  )
)
capture <- function(expr) {
  warnings <- character()
  value <- withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),
    warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")})
  if(inherits(value,"caught")) return(list(error=value$message,warnings=warnings))
  list(value=value,warnings=warnings)
}
tab <- function(x) { z <- as.matrix(x); list(rows=rownames(z),cols=colnames(z),nrow=nrow(z),ncol=ncol(z),values=as.numeric(z)) }
out <- capture({
  f <- geeglm(y~x,id=id,waves=wave,data=gee_check,family=gaussian,corstr="ar1")
  ft <- geeglm(y~x,id=id,waves=wave,data=gee_check,family=gaussian,corstr="ar1",
               control=geese.control(epsilon=1e-12,maxit=1000))
  fi <- geeglm(y~x,id=id,waves=wave,data=gee_check,family=gaussian,corstr="independence")
  fit <- function(z) {
    sc <- as.numeric(summary(z)$dispersion[1])
    qic <- as.numeric(QIC(z))
    vr <- vcov(z)
    X <- model.matrix(y~x,data=gee_check)
    ciCurrent <- sum(diag((crossprod(X)/sc) %*% vr))
    list(scale=sc,qic=qic,robust=tab(vr),cicUsingOwnScale=ciCurrent)
  }
  si <- as.numeric(summary(fi)$dispersion[1])
  X <- model.matrix(y~x,data=gee_check)
  list(default=fit(f),tight=fit(ft),independenceScale=si,
       cicUsingIndependenceScale=sum(diag((crossprod(X)/si) %*% vcov(f))),
       independenceRobust=tab(vcov(fi)))
})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
