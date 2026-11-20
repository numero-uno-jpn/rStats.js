# issue: 545
# batch rerun after reserved-token fix
# batch rerun after clean-room script correction
# Focused glmnet path oracle with fixed inputs and public fit components.
suppressMessages(library(glmnet));library(jsonlite)
run<-function(expr){w<-character();v<-withCallingHandlers(tryCatch(expr,error=function(e)structure(list(message=conditionMessage(e)),class="caught")),warning=function(x){w<<-c(w,conditionMessage(x));invokeRestart("muffleWarning")});if(inherits(v,"caught"))return(list(error=v$message,warnings=w));list(value=v,warnings=w)}
tab<-function(x){z<-as.matrix(x);list(rows=rownames(z),cols=colnames(z),values=unname(z))}
X<-matrix(c(-2,1,0,2,-1,3,1,-3,2,0,4,-2, 1,0,2,-1,3,-2,2,1,-3,4,0,-1, 2,-1,1,0,-2,3,-3,2,1,-1,4,0),12,3)
y<-c(4,2,5,1,7,0,6,3,8,2,9,1);w<-c(1,2,1,3,1,2,1,3,2,1,2,1)
out<-list(X=tab(X),y=y,weights=w,control=glmnet.control())
for(a in c(1,.5,0))out[[paste0("gaussian_alpha",a)]]<-run({
 f<-glmnet(X,y,alpha=a,nlambda=8,lambda.min.ratio=.01)
 ft<-glmnet(X,y,alpha=a,nlambda=8,lambda.min.ratio=.01,control=list(thresh=1e-14))
 list(lambda=f$lambda,lambdaTight=ft$lambda,a0=unname(f$a0),beta=tab(f$beta),
      df=f$df,devRatio=f$dev.ratio,nullDev=f$nulldev,npasses=f$npasses,jerr=f$jerr,
      tightA0=unname(ft$a0),tightBeta=tab(ft$beta))
})
out$weighted<-run({f<-glmnet(X,y,weights=w,nlambda=6);list(lambda=f$lambda,a0=f$a0,beta=tab(f$beta),df=f$df,nullDev=f$nulldev)})
out$noStandardize<-run({f<-glmnet(X,y,standardize=FALSE,nlambda=6);list(lambda=f$lambda,a0=f$a0,beta=tab(f$beta))})
out$binomial<-run({yb<-c(0,0,1,0,1,0,1,0,1,1,1,1);f<-glmnet(X,yb,family="binomial",nlambda=6);list(lambda=f$lambda,a0=f$a0,beta=tab(f$beta),df=f$df,devRatio=f$dev.ratio,nullDev=f$nulldev)})
out$poisson<-run({yp<-c(1,2,1,3,2,4,1,3,2,5,4,6);f<-glmnet(X,yp,family="poisson",offset=log(seq(1,2,length.out=12)),nlambda=6);list(lambda=f$lambda,a0=f$a0,beta=tab(f$beta),df=f$df,devRatio=f$dev.ratio,nullDev=f$nulldev)})
Xi<-as.matrix(iris[,1:4]);yi<-iris$Species
for(tm in c("ungrouped","grouped"))out[[paste0("multinomial_",tm)]]<-run({
 f<-glmnet(Xi,yi,family="multinomial",type.multinomial=tm,nlambda=6)
 list(lambda=f$lambda,a0=tab(f$a0),beta=lapply(f$beta,tab),dfmat=tab(f$dfmat),
      devRatio=f$dev.ratio,nullDev=f$nulldev,
      response=as.data.frame(predict(f,Xi[c(1,51,101),],s=f$lambda[3],type="response")),
      class=predict(f,Xi[c(1,51,101),],s=f$lambda[3],type="class"))
})
out$offPath<-run({f<-glmnet(X,y,lambda=c(2,1,.5,.25,.125));list(lambda=f$lambda,coef=tab(coef(f,s=c(.75,.3))),predict=tab(predict(f,X[1:4,],s=c(.75,.3))))})
foldid<-rep(1:3,4)
out$cv<-run({f<-cv.glmnet(X,y,foldid=foldid,nlambda=8);g<-cv.glmnet(X,y,foldid=foldid,nlambda=8,grouped=FALSE,keep=TRUE);list(lambda=f$lambda,cvm=f$cvm,cvsd=f$cvsd,cvup=f$cvup,cvlo=f$cvlo,nzero=f$nzero,lambdaMin=f$lambda.min,lambda1se=f$lambda.1se,groupedFalse=list(cvm=g$cvm,cvsd=g$cvsd,preval=tab(g$fit.preval)))})
Xcv<-cbind(a=seq(-2,2,length.out=60),b=sin(seq_len(60)),c=cos(seq_len(60)))
yg<-1+.5*Xcv[,1]-.3*Xcv[,2]+sin(seq_len(60)*1.7)*.2
yb<-rep(0:1,30);fid<-rep(1:5,12)
out$cvGaussian<-run({
 a<-cv.glmnet(Xcv,yg,foldid=fid,type.measure="mse",keep=TRUE)
 b<-cv.glmnet(Xcv,yg,foldid=fid,type.measure="mse",grouped=FALSE,keep=TRUE)
 list(lambda=a$lambda,cvm=a$cvm,cvsd=a$cvsd,cvup=a$cvup,cvlo=a$cvlo,
      lambdaMin=a$lambda.min,lambda1se=a$lambda.1se,preval=tab(a$fit.preval),
      groupedFalse=list(cvm=b$cvm,cvsd=b$cvsd,preval=tab(b$fit.preval)))
})
for(tm in c("deviance","class","auc"))out[[paste0("cvBinomial_",tm)]]<-run({
 a<-cv.glmnet(Xcv,yb,family="binomial",foldid=fid,type.measure=tm)
 list(lambda=a$lambda,cvm=a$cvm,cvsd=a$cvsd,lambdaMin=a$lambda.min,lambda1se=a$lambda.1se)
})
cat(toJSON(out,digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE))
