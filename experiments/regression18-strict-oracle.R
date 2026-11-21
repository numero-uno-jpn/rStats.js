# issue: 545
# Public-output comparison of strict GEE refits and grouped-false Gaussian CV.
suppressPackageStartupMessages(library(geepack))
suppressPackageStartupMessages(library(glmnet))
suppressPackageStartupMessages(library(jsonlite))
capture <- function(expr) {
  warnings <- character()
  value <- withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),
    warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")})
  if(inherits(value,"caught")) return(list(error=value$message,warnings=warnings))
  list(value=value,warnings=warnings)
}
tab <- function(x) {
  z <- as.matrix(x)
  list(rows=rownames(z),cols=colnames(z),nrow=nrow(z),ncol=ncol(z),values=as.numeric(z))
}
out <- list()
data(ohio)
nd <- data.frame(age=c(-2,0,1),smoke=c(0,1,1))
out$geePredict <- list()
for (spec in list(default=NULL,epsilon_1e10=geese.control(epsilon=1e-10,maxit=200),
                  epsilon_1e12=geese.control(epsilon=1e-12,maxit=1000))) {
  name <- if (is.null(spec)) "default" else if (spec$epsilon==1e-10) "epsilon_1e10" else "epsilon_1e12"
  out$geePredict[[name]] <- capture({
    f <- if (is.null(spec)) geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="ar1")
         else geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="ar1",control=spec)
    list(coefficients=unname(coef(f)),correlation=tab(summary(f)$corr),dispersion=tab(summary(f)$dispersion),
         pearson=unname(residuals(f,type="pearson")),
         link=unname(predict(f,newdata=nd)),response=unname(predict(f,newdata=nd,type="response")))
  })
}
out$geePredict$clusterSizes <- as.numeric(table(ohio$id))
pearsonR <- out$geePredict$epsilon_1e12$value$pearson
residualGroups <- split(pearsonR, ohio$id)
lags <- seq_len(max(lengths(residualGroups)) - 1)
lagWeights <- vapply(lags, function(lag) sum(pmax(lengths(residualGroups) - lag, 0)), numeric(1))
lagMeans <- vapply(lags, function(lag) {
  products <- unlist(lapply(residualGroups, function(v) {
    if (length(v) > lag) v[(lag + 1):length(v)] * v[seq_len(length(v) - lag)] else numeric()
  }))
  mean(products)
}, numeric(1))
alphaLS <- optimize(function(a) sum(lagWeights * (lagMeans - a^lags)^2), interval=c(-.98,.98))$minimum
out$geePredict$momentProbe <- list(lagMeans=lagMeans,lagWeights=lagWeights,
  alphaLag1=lagMeans[1],alphaLeastSquares=alphaLS,
  alphaR=out$geePredict$epsilon_1e12$value$correlation$values[1])
out$geePredict$explicitWaves <- capture({
  waves <- ave(seq_along(ohio$id), ohio$id, FUN=seq_along)
  f <- geeglm(resp~age+smoke,id=id,waves=waves,data=ohio,family=binomial,corstr="ar1",
              control=geese.control(epsilon=1e-12,maxit=1000))
  list(coefficients=unname(coef(f)),correlation=tab(summary(f)$corr),
       link=unname(predict(f,newdata=nd)),response=unname(predict(f,newdata=nd,type="response")))
})
data(dietox)
dietox$Cu <- factor(dietox$Cu)
out$geeSequentialAnova <- list()
for (spec in list(default=NULL,epsilon_1e10=geese.control(epsilon=1e-10,maxit=200),
                  epsilon_1e12=geese.control(epsilon=1e-12,maxit=1000))) {
  name <- if (is.null(spec)) "default" else if (spec$epsilon==1e-10) "epsilon_1e10" else "epsilon_1e12"
  out$geeSequentialAnova[[name]] <- capture({
    f <- if (is.null(spec)) geeglm(Weight~Time+Cu,id=Pig,data=dietox,corstr="independence")
         else geeglm(Weight~Time+Cu,id=Pig,data=dietox,corstr="independence",control=spec)
    tab(anova(f))
  })
}
X <- matrix(c(-2,1,0,2,-1,3,1,-3,2,0,4,-2,
              1,0,2,-1,3,-2,2,1,-3,4,0,-1,
              2,-1,1,0,-2,3,-3,2,1,-1,4,0),12,3)
y <- c(4,2,5,1,7,0,6,3,8,2,9,1)
foldid <- rep(1:3,4)
out$glmnetGroupedFalseCV <- list()
for (th in c(1e-16,1e-20)) {
  name <- if (th==1e-16) "thresh_1e16" else "thresh_1e20"
  out$glmnetGroupedFalseCV[[name]] <- capture({
    f <- cv.glmnet(X,y,foldid=foldid,nlambda=8,grouped=FALSE,keep=TRUE,
                   control=list(thresh=th,maxit=1e8))
    list(lambda=f$lambda,cvm=f$cvm,cvsd=f$cvsd,preval=tab(f$fit.preval))
  })
}
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
