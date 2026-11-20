# issue: 545
# Oracle for rq (quantreg 6.1), R 4.6.2. Public functions and documented quantities only.
suppressMessages(library(quantreg))
library(jsonlite)
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(tryCatch(expr, error=function(e) structure(list(message=conditionMessage(e)), class="caught")),
    warning=function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message=function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error=value$message, warnings=warns, messages=msgs))
  list(value=value, warnings=warns, messages=msgs)
}
tab <- function(m) list(rows=rownames(m), cols=colnames(m), values=unname(m))
fitValues <- function(f) list(coefficients=coef(f), residuals=unname(residuals(f)), objective=sum(f$weights * (f$tau * pmax(residuals(f),0) + (1-f$tau) * pmax(-residuals(f),0))), tau=f$tau)
out <- list()
data(engel); data(stackloss)
for (q in c(.1,.25,.5,.75,.9)) {
  for (alg in c("br","fn")) {
    out[[paste(alg,q,sep="_")]] <- run({
      f <- rq(foodexp ~ income, tau=q, data=engel, method=alg)
      ft <- if (alg=="fn") rq(foodexp ~ income, tau=q, data=engel, method=alg, eps=1e-12) else f
      list(default=fitValues(f), fitTight=fitValues(ft),
        summary_rank=run(tab(coef(summary(f, se="rank")))),
        summary_iid=run(tab(coef(summary(f, se="iid")))),
        summary_nid=run(tab(coef(summary(f, se="nid")))),
        summary_ker=run(tab(coef(summary(f, se="ker")))),
        covariance=run(summary(f, se="ker", covariance=TRUE)$cov))
    })
  }
}
out$stackloss <- run({
  f <- rq(stack.loss ~ ., data=stackloss)
  list(fit=fitValues(f), summary=run(tab(coef(summary(f)))),
       nid_hs=run(tab(coef(summary(f, se="nid", hs=TRUE)))),
       nid_bofinger=run(tab(coef(summary(f, se="nid", hs=FALSE)))))
})
out$weighted <- run({ f <- rq(stack.loss ~ ., data=stackloss, weights=rep(c(1,2,3), length.out=nrow(stackloss)), tau=.3); fitValues(f) })
out$factor <- run({ d<-mtcars; d$cyl<-factor(d$cyl); f<-rq(mpg~wt+cyl,data=d,tau=.6); fitValues(f) })
out$multi_tau <- run({
 f<-rq(foodexp~income,tau=c(.25,.5,.75),data=engel)
 list(coef=tab(coef(f)), summaries=lapply(summary(f,se="nid"),function(s)tab(coef(s))),
      anova_joint=run(as.list(anova(f)$table)),anova_separate=run(as.list(anova(f,joint=FALSE)$table)))
})
out$nested_anova <- run({ a<-rq(stack.loss~Air.Flow,data=stackloss); b<-rq(stack.loss~.,data=stackloss);
 list(wald=run(as.list(anova(b,a)$table)),rank=run(as.list(anova(b,a,test="rank")$table))) })
out$prediction <- run({ f<-rq(foodexp~income,tau=.5,data=engel); nd<-data.frame(income=c(500,1000,2500));
 list(fit=predict(f,newdata=nd),none=run(tab(predict(f,newdata=nd,interval="confidence",se="nid"))),
      percentile=run(tab(predict(f,newdata=nd,interval="confidence",type="percentile"))),
      direct=run(tab(predict(f,newdata=nd,interval="confidence",type="direct")))) })
out$nonunique <- run({ d<-data.frame(x=1:6,y=c(2,1,4,3,6,5));
 list(br=fitValues(rq(y~x,data=d,method="br")),fn=fitValues(rq(y~x,data=d,method="fn")),
      fn_tight=fitValues(rq(y~x,data=d,method="fn",eps=1e-12))) })
out$exact <- run({ f<-rq(y~x,data=data.frame(x=1:10,y=2+3*(1:10))); list(fit=fitValues(f),rank=run(tab(coef(summary(f)))),nid=run(tab(coef(summary(f,se="nid"))))) })
out$collinear <- run(rq(y~x1+x2,data=data.frame(x1=1:8,x2=2*(1:8),y=c(3,1,4,1,5,9,2,6))))
out$missing <- run(fitValues(rq(y~x,data=data.frame(x=c(1:9,NA),y=c(3,1,4,1,5,NA,2,6,5,3)),na.action=na.omit)))
for (method in c("xy","pwy","mcmb","wxy")) {
 out[[paste0("boot_",method)]] <- run({ set.seed(1); f<-rq(foodexp~income,tau=.5,data=engel);
   s<-summary(f,se="boot",bsmethod=method,R=200); list(table=tab(coef(s)),boot=if(is.null(s$B)) NULL else dim(s$B)) })
}
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
