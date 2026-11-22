# issue: 549
# Independent LDA and canonical-correlation calculations; public R calls and base linear algebra only.
library(MASS); library(jsonlite)
mdiff <- function(a,b) {
 if(length(a)!=length(b)) return(Inf)
 if(!length(a)) return(0)
 max(abs(as.numeric(a)-as.numeric(b)),na.rm=TRUE)
}
tab <- function(a) list(rows=rownames(a),cols=colnames(a),values=unname(as.matrix(a)))
lda_calc <- function(xx,gg,prior0=NULL,tol0=1e-8) {
 xx <- as.matrix(xx); gg <- droplevels(factor(gg)); lev0 <- levels(gg)
 nn <- nrow(xx); pp <- ncol(xx); ggN <- length(lev0)
 cnt <- as.numeric(table(gg)); mu <- t(vapply(lev0,function(z) colMeans(xx[gg==z,,drop=FALSE]),numeric(pp)))
 rownames(mu)<-lev0
 pr <- if(is.null(prior0)) cnt/nn else prior0/sum(prior0)
 cen <- as.numeric(crossprod(pr,mu)); names(cen)<-colnames(xx)
 ww <- matrix(0,pp,pp)
 for(j in seq_along(lev0)) {
  dd <- sweep(xx[gg==lev0[j],,drop=FALSE],2,mu[j,],"-")
  ww <- ww+crossprod(dd)
 }
 bb <- matrix(0,pp,pp)
 for(j in seq_along(lev0)) {
  dv <- mu[j,]-cen
  bb <- bb+pr[j]*tcrossprod(dv)
 }
 ee <- eigen(ww,symmetric=TRUE)
 keep <- which(ee$values>max(ee$values)*tol0)
 zmat <- ee$vectors[,keep,drop=FALSE] %*% diag(1/sqrt(ee$values[keep]),nrow=length(keep))
 mid <- crossprod(zmat,bb%*%zmat)
 be <- eigen(mid,symmetric=TRUE)
 pos <- which(be$values>max(be$values)*tol0)
 sc <- sqrt(nn-ggN)*zmat%*%be$vectors[,pos,drop=FALSE]
 sv <- sqrt(pmax(0,be$values[pos])*nn*(nn-ggN)/(ggN-1))
 rownames(sc)<-colnames(xx); colnames(sc)<-paste0("LD",seq_len(ncol(sc)))
 list(scaling=sc,svd=sv,means=mu,prior=pr,center=cen,W=ww,cov=ww/(nn-ggN),
      norm=crossprod(sc,(ww/(nn-ggN))%*%sc),centroids=sweep(mu,2,cen,"-")%*%sc)
}
lda_compare <- function(xx,gg,prior0=NULL,tol0=1e-4,do_cv=FALSE) {
 ref <- MASS::lda(xx,gg,prior=prior0,tol=tol0)
 calc <- lda_calc(xx,gg,prior0,max(1e-10,tol0*1e-4))
 refsc <- as.matrix(ref$scaling); csc <- calc$scaling
 ns <- min(ncol(refsc),ncol(csc))
 sgn <- vapply(seq_len(ns),function(j) sign(sum(refsc[,j]*csc[,j])),numeric(1))
 if(any(sgn==0)) sgn[sgn==0]<-1
 adj <- sweep(csc[,seq_len(ns),drop=FALSE],2,sgn,"*")
 cent <- calc$centroids[,seq_len(ns),drop=FALSE]*matrix(sgn,nrow=nrow(calc$centroids),ncol=ns,byrow=TRUE)
 max_centroid_sign <- vapply(seq_len(ns),function(j) {
  ix <- which.max(abs(cent[,j])); sign(cent[ix,j])
 },numeric(1))
 predref <- predict(ref)
 predcalc <- function(newx,pr) {
  ctr <- as.numeric(crossprod(pr,calc$means)); cov0 <- calc$cov
  scx <- sweep(as.matrix(newx),2,ctr,"-")%*%refsc
  inv <- solve(cov0)
  logp <- sapply(seq_len(nrow(calc$means)),function(j) {
   dd <- sweep(as.matrix(newx),2,calc$means[j,],"-")
   log(pr[j])-0.5*rowSums((dd%*%inv)*dd)
  })
  logp <- logp-apply(logp,1,max)
  post <- exp(logp); post <- post/rowSums(post)
  list(class=colnames(post)[max.col(post,ties.method="first")],posterior=post,x=scx)
 }
 pred0 <- predcalc(xx,calc$prior)
 cvdiff <- NULL
 if(do_cv) {
  cvclass <- character(nrow(xx)); cvpost <- matrix(NA_real_,nrow(xx),length(lev0))
  for(i in seq_len(nrow(xx))) {
   take <- setdiff(seq_len(nrow(xx)),i)
   f0 <- MASS::lda(xx[take,,drop=FALSE],gg[take],prior=prior0,tol=tol0)
   p0 <- predict(f0,xx[i,,drop=FALSE])
   cvclass[i] <- as.character(p0$class[1])
   cvpost[i,] <- as.numeric(p0$posterior[1,lev0])
  }
  cvref <- MASS::lda(xx,gg,prior=prior0,CV=TRUE,tol=tol0)
  cvdiff <- list(class_mismatch=sum(cvclass!=as.character(cvref$class)),
                 posterior_max_abs=mdiff(cvpost,cvref$posterior))
 }
 list(scaling_max_abs_after_sign=mdiff(adj,refsc[,seq_len(ns),drop=FALSE]),
      signs_to_match_reference=sgn,svd_max_abs=mdiff(calc$svd,ref$svd),
      metric_norm=calc$norm,centroids=calc$centroids,
      largest_abs_centroid_sign=max_centroid_sign,
      prediction_class_mismatch=sum(pred0$class!=as.character(predref$class)),
      prediction_posterior_max_abs=mdiff(pred0$posterior,predref$posterior),
      prediction_x_max_abs=mdiff(pred0$x,predref$x),CV=cvdiff,
      reference=list(scaling=tab(ref$scaling),svd=ref$svd,prior=ref$prior,means=tab(ref$means)))
}
## LDA cases: all principal fixtures; errors are captured as text.
xx0 <- as.matrix(iris[,1:4]); gg0 <- iris$Species
mt <- transform(mtcars,cyl=factor(cyl),am=factor(am))
lda_cases <- list(
 iris=function() lda_compare(xx0,gg0,do_cv=TRUE),
 iris_prior=function() lda_compare(xx0,gg0,c(.6,.3,.1),do_cv=TRUE),
 two_classes=function() lda_compare(as.matrix(mt[,c("mpg","hp","wt")]),mt$am,do_cv=TRUE),
 three_cyl=function() lda_compare(as.matrix(mt[,c("mpg","disp","hp","wt")]),mt$cyl),
 class_of_one=function() { g0<-factor(c(as.character(gg0[1:149]),"lone")); lda_compare(xx0,g0) },
 single_variable=function() lda_compare(xx0[,1,drop=FALSE],gg0),
 collinear=function() lda_compare(cbind(xx0,s=xx0[,1]+xx0[,2]),gg0),
 na_formula=function() { keep<-complete.cases(xx0); keep[5]<-FALSE; lda_compare(xx0[keep,,drop=FALSE],gg0[keep]) },
 scale=function() { xs<-xx0; xs[,1]<-xs[,1]*1e100; lda_compare(xs,gg0) })
lda_res <- lapply(lda_cases,function(fn) tryCatch(fn(),error=function(e) list(error=conditionMessage(e))))
## Canonical coefficients from SVD of whitened cross-products.
cc_calc <- function(x0,y0,xc=TRUE,yc=TRUE) {
 xmat <- if(is.vector(x0)) matrix(x0,ncol=1) else as.matrix(x0)
 ymat <- if(is.vector(y0)) matrix(y0,ncol=1) else as.matrix(y0)
 xcen <- if(is.logical(xc)) if(xc) colMeans(xmat) else rep(0,ncol(xmat)) else xc
 ycen <- if(is.logical(yc)) if(yc) colMeans(ymat) else rep(0,ncol(ymat)) else yc
 xa <- sweep(xmat,2,xcen,"-"); ya <- sweep(ymat,2,ycen,"-")
 sx <- apply(abs(xa),2,max); sy <- apply(abs(ya),2,max); sx[sx==0]<-1; sy[sy==0]<-1
 xn <- sweep(xa,2,sx,"/"); yn <- sweep(ya,2,sy,"/")
 px <- qr(xn)$pivot[seq_len(qr(xn)$rank)]; py <- qr(yn)$pivot[seq_len(qr(yn)$rank)]
 xn <- xn[,px,drop=FALSE]; yn <- yn[,py,drop=FALSE]
 ex <- eigen(crossprod(xn),symmetric=TRUE); ey <- eigen(crossprod(yn),symmetric=TRUE)
 kx <- which(ex$values>max(ex$values)*1e-12); ky <- which(ey$values>max(ey$values)*1e-12)
 zx <- ex$vectors[,kx,drop=FALSE]%*%diag(1/sqrt(ex$values[kx]),nrow=length(kx))
 zy <- ey$vectors[,ky,drop=FALSE]%*%diag(1/sqrt(ey$values[ky]),nrow=length(ky))
 cross0 <- crossprod(zx,crossprod(xn,yn)%*%zy)
 ss <- svd(cross0,nu=min(nrow(cross0),ncol(cross0)),nv=min(nrow(cross0),ncol(cross0)))
 xxcoef <- zx%*%ss$u
 yycoef <- zy%*%ss$v
 xxcoef <- sweep(xxcoef,1,sx[px],"/"); yycoef <- sweep(yycoef,1,sy[py],"/")
 rownames(xxcoef)<-colnames(xmat)[px]; rownames(yycoef)<-colnames(ymat)[py]
 list(cor=ss$d,xcoef=xxcoef,ycoef=yycoef,xcenter=xcen,ycenter=ycen,
      xnorm=crossprod(ss$u),ynorm=crossprod(ss$v),px=px,py=py)
}
cc_compare <- function(x0,y0,xc=TRUE,yc=TRUE) {
 ref <- stats::cancor(x0,y0,xcenter=xc,ycenter=yc)
 calc <- cc_calc(x0,y0,xc,yc)
 rx <- as.matrix(ref$xcoef); ry <- as.matrix(ref$ycoef)
 cx <- calc$xcoef; cy <- calc$ycoef
 ncan <- min(ncol(rx),ncol(cx),ncol(ry),ncol(cy))
 sx <- vapply(seq_len(ncan),function(j) sign(sum(rx[,j]*cx[,j])),numeric(1))
 sy <- vapply(seq_len(ncan),function(j) sign(sum(ry[,j]*cy[,j])),numeric(1))
 list(cor_max_abs=mdiff(calc$cor,ref$cor),
      xcoef_signs=sx,ycoef_signs=sy,
      xcoef_max_abs=mdiff(sweep(cx[,seq_len(ncan),drop=FALSE],2,sx,"*"),rx[,seq_len(ncan),drop=FALSE]),
      ycoef_max_abs=mdiff(sweep(cy[,seq_len(ncan),drop=FALSE],2,sy,"*"),ry[,seq_len(ncan),drop=FALSE]),
      x_metric=crossprod(rx,crossprod(as.matrix(x0)-matrix(ref$xcenter,nrow(x0),ncol(as.matrix(x0)),byrow=TRUE),as.matrix(x0)-matrix(ref$xcenter,nrow(x0),ncol(as.matrix(x0)),byrow=TRUE))%*%rx),
      y_metric=crossprod(ry,crossprod(as.matrix(y0)-matrix(ref$ycenter,nrow(y0),ncol(as.matrix(y0)),byrow=TRUE),as.matrix(y0)-matrix(ref$ycenter,nrow(y0),ncol(as.matrix(y0)),byrow=TRUE))%*%ry),
      reference=list(cor=ref$cor,xcoef=tab(ref$xcoef),ycoef=tab(ref$ycoef)))
}
pop <- LifeCycleSavings[,2:3]; oec <- LifeCycleSavings[,-(2:3)]
cc_cases <- list(
 lifecycle=function() cc_compare(pop,oec),
 lifecycle_nocenter=function() cc_compare(pop,oec,FALSE,FALSE),
 lifecycle_given_center=function() cc_compare(pop,oec,c(30,2),c(10,1000,4)),
 iris=function() cc_compare(iris[,1:2],iris[,3:4]),
 one_x=function() cc_compare(mtcars[,"wt",drop=FALSE],mtcars[,c("mpg","hp","qsec")]),
 more_x=function() cc_compare(mtcars[,c("wt","disp","drat","qsec")],mtcars[,c("mpg","hp")]),
 collinear=function() cc_compare(cbind(a=mtcars$wt,b=mtcars$disp,c=mtcars$wt+mtcars$disp),mtcars[,c("mpg","hp")]),
 n_small=function() cc_compare(mtcars[1:4,c("wt","disp","drat")],mtcars[1:4,c("mpg","hp")]),
 scale=function() cc_compare(pop*1e100,oec*1e-100),
 vectors=function() cc_compare(mtcars$wt,mtcars$mpg))
cc_res <- lapply(cc_cases,function(fn) tryCatch(fn(),error=function(e) list(error=conditionMessage(e))))
cat(toJSON(list(lda=lda_res,cancor=cc_res),digits=NA,auto_unbox=TRUE,na="string",null="null"))
