# issue: 545
# Compare public binomial glmnet fits and predictions at default and strict convergence thresholds.
suppressPackageStartupMessages(library(glmnet))
suppressPackageStartupMessages(library(jsonlite))
X <- matrix(c(-2,1,0,2,-1,3,1,-3,2,0,4,-2,
              1,0,2,-1,3,-2,2,1,-3,4,0,-1,
              2,-1,1,0,-2,3,-3,2,1,-1,4,0),12,3)
y <- c(0,0,1,0,1,0,1,0,1,1,1,1)
tab <- function(x) {
  z <- as.matrix(x)
  list(rows=rownames(z),cols=colnames(z),nrow=nrow(z),ncol=ncol(z),values=unname(asplit(z,1)))
}
capture <- function(expr) {
  warnings <- character()
  value <- withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),
    warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")})
  if(inherits(value,"caught")) return(list(error=value$message,warnings=warnings))
  list(value=value,warnings=warnings)
}
out <- list()
for (spec in list(default=NULL,thresh_1e16=1e-16,thresh_1e20=1e-20)) {
  name <- if(is.null(spec)) "default" else if(spec==1e-16) "thresh_1e16" else "thresh_1e20"
  out[[name]] <- capture({
    f <- if(is.null(spec)) glmnet(X,y,family="binomial",nlambda=6)
         else glmnet(X,y,family="binomial",nlambda=6,control=list(thresh=spec,maxit=1e8))
    list(lambda=as.numeric(f$lambda),a0=as.numeric(f$a0),beta=tab(f$beta),
         link=as.numeric(predict(f,newx=X[1:4,,drop=FALSE],s=f$lambda[3],type="link")),
         response=as.numeric(predict(f,newx=X[1:4,,drop=FALSE],s=f$lambda[3],type="response")))
  })
}
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
