# issue: 549
# Independent LDA calculations using weighted class moments and base SVD.
library(MASS); library(jsonlite)
mdiff <- function(a,b) {
 if(length(a)!=length(b)) return(Inf)
 if(!length(a)) return(0)
 max(abs(as.numeric(a)-as.numeric(b)),na.rm=TRUE)
}
tab <- function(a) list(rows=rownames(a),cols=colnames(a),values=unname(as.matrix(a)))
lda_calc <- function(xx,gg,prior0=NULL,tol0=1e-10) {
 xx <- as.matrix(xx); gg <- droplevels(factor(gg)); levs <- levels(gg)
 nn <- nrow(xx); pp <- ncol(xx); ng <- length(levs)
 xscale <- apply(abs(xx),2,max); xscale[xscale==0] <- 1
 xn <- sweep(xx,2,xscale,"/")
 cnt <- as.numeric(table(gg))
 mu <- t(vapply(levs,function(z) colMeans(xn[gg==z,,drop=FALSE]),numeric(pp)))
 rownames(mu)<-levs
 pr <- if(is.null(prior0)) cnt/nn else prior0/sum(prior0)
 cen <- as.numeric(crossprod(pr,mu))
 ww <- matrix(0,pp,pp)
 for(j in seq_along(levs)) {
  dd <- sweep(xn[gg==levs[j],,drop=FALSE],2,mu[j,],"-")
  ww <- ww+crossprod(dd)
 }
 bb <- matrix(0,pp,pp)
 for(j in seq_along(levs)) {
  dv <- mu[j,]-cen
  bb <- bb+pr[j]*tcrossprod(dv)
 }
 ee <- eigen(ww,symmetric=TRUE)
 keep <- which(ee$values>max(ee$values)*tol0)
 if(length(keep)==pp) {
  rr <- chol(ww/(nn-ng)); ri <- solve(rr)
  mm <- diag(sqrt(pr))%*%sweep(mu,2,cen,"-")%*%ri
  ss <- svd(mm)
  pos <- which(ss$d>max(ss$d)*sqrt(tol0))
  scn <- ri%*%ss$v[,pos,drop=FALSE]
  sv <- ss$d[pos]*sqrt(nn/(ng-1))
 } else {
  zmat <- ee$vectors[,keep,drop=FALSE]%*%diag(1/sqrt(ee$values[keep]),nrow=length(keep))
  mid <- crossprod(zmat,bb%*%zmat)
  ss <- svd(mid)
  pos <- which(ss$d>max(ss$d)*tol0)
  scn <- sqrt(nn-ng)*zmat%*%ss$v[,pos,drop=FALSE]
  sv <- sqrt(pmax(0,ss$d[pos])*nn*(nn-ng)/(ng-1))
 }
 sc <- sweep(scn,1,xscale,"/")
 rownames(sc)<-colnames(xx); colnames(sc)<-paste0("LD",seq_len(ncol(sc)))
 list(scaling=sc,scaling_norm=scn,svd=sv,means=sweep(mu,2,xscale,"*"),
      means_norm=mu,prior=pr,center=cen*xscale,center_norm=cen,
      xscale=xscale,W=ww,cov=ww/(nn-ng),
      norm=crossprod(scn,(ww/(nn-ng))%*%scn),
      centroids=sweep(mu,2,cen,"-")%*%scn)
}
lda_compare <- function(xx,gg,prior0=NULL,tol0=1e-4,do_cv=FALSE,do_predict=TRUE) {
 levs <- levels(droplevels(factor(gg)))
 ref <- if(is.null(prior0)) MASS::lda(xx,gg,tol=tol0) else MASS::lda(xx,gg,prior=prior0,tol=tol0)
 calc <- lda_calc(xx,gg,prior0,max(1e-10,tol0*1e-4))
 refsc <- as.matrix(ref$scaling); csc <- calc$scaling
 ns <- min(ncol(refsc),ncol(csc))
 sgn <- vapply(seq_len(ns),function(j) sign(sum(refsc[,j]*csc[,j])),numeric(1))
 if(any(sgn==0)) sgn[sgn==0]<-1
 adj <- sweep(csc[,seq_len(ns),drop=FALSE],2,sgn,"*")
 scn_adj <- sweep(calc$scaling_norm[,seq_len(ns),drop=FALSE],2,sgn,"*")
 cent <- calc$centroids[,seq_len(ns),drop=FALSE]*matrix(sgn,nrow=nrow(calc$centroids),ncol=ns,byrow=TRUE)
 max_centroid_sign <- vapply(seq_len(ns),function(j) {
  ix <- which.max(abs(cent[,j])); sign(cent[ix,j])
 },numeric(1))
 xxn <- sweep(as.matrix(xx),2,calc$xscale,"/")
 refsc_norm <- sweep(refsc[,seq_len(ns),drop=FALSE],1,calc$xscale,"*")
 ref_scores <- sweep(xxn,2,calc$center_norm,"-")%*%refsc_norm
 calc_scores <- sweep(xxn,2,calc$center_norm,"-")%*%scn_adj
 pred_error <- NULL
 if(do_predict) {
  predref <- predict(ref)
  predcalc <- function(newx,pr) {
   xxnew <- sweep(as.matrix(newx),2,calc$xscale,"/")
   ctr <- as.numeric(crossprod(pr,calc$means_norm))
   scx <- sweep(xxnew,2,ctr,"-")%*%scn_adj
   inv <- solve(calc$cov)
   logp <- sapply(seq_len(nrow(calc$means_norm)),function(j) {
    dd <- sweep(xxnew,2,calc$means_norm[j,],"-")
    log(pr[j])-0.5*rowSums((dd%*%inv)*dd)
   })
   colnames(logp)<-levs
   logp <- logp-apply(logp,1,max)
   post <- exp(logp); post <- post/rowSums(post)
   list(class=levs[max.col(post,ties.method="first")],posterior=post,x=scx)
  }
  pred0 <- predcalc(xx,calc$prior)
  pred_error <- list(class_mismatch=sum(pred0$class!=as.character(predref$class)),
   posterior_max_abs=mdiff(pred0$posterior,predref$posterior),
   x_max_abs=mdiff(pred0$x,predref$x))
  if(is.null(prior0) && length(levs)==3L) {
   pr2 <- c(.1,.2,.7)
   po <- predict(ref,prior=pr2); pc <- predcalc(xx,pr2)
   pred_error$override_prior <- list(class_mismatch=sum(pc$class!=as.character(po$class)),
    posterior_max_abs=mdiff(pc$posterior,po$posterior),x_max_abs=mdiff(pc$x,po$x))
  }
 }
 cvdiff <- NULL
 if(do_cv) {
  cvclass <- character(nrow(as.matrix(xx))); cvpost <- matrix(NA_real_,nrow(as.matrix(xx)),length(levs))
  cvprior <- ref$prior
  for(i in seq_len(nrow(as.matrix(xx)))) {
   take <- setdiff(seq_len(nrow(as.matrix(xx))),i)
   f0 <- MASS::lda(xx[take,,drop=FALSE],gg[take],prior=cvprior,tol=tol0)
   p0 <- predict(f0,xx[i,,drop=FALSE])
   cvclass[i] <- as.character(p0$class[1])
   cvpost[i,] <- as.numeric(p0$posterior[1,levs])
  }
  cvref <- MASS::lda(xx,gg,CV=TRUE,prior=cvprior,tol=tol0)
  cvdiff <- list(class_mismatch=sum(cvclass!=as.character(cvref$class)),
                 posterior_max_abs=mdiff(cvpost,cvref$posterior))
 }
 list(scaling_max_abs_after_sign=mdiff(adj,refsc[,seq_len(ns),drop=FALSE]),
      score_max_abs_after_sign=mdiff(calc_scores,ref_scores),
      signs_to_match_reference=sgn,svd_max_abs=mdiff(calc$svd,ref$svd),
      metric_norm=calc$norm,centroids=calc$centroids,
      largest_abs_centroid_sign=max_centroid_sign,prediction=pred_error,CV=cvdiff,
      reference=list(scaling=tab(ref$scaling),svd=ref$svd,prior=ref$prior,means=tab(ref$means)))
}
xx0 <- as.matrix(iris[,1:4]); gg0 <- iris$Species
mt <- transform(mtcars,cyl=factor(cyl),am=factor(am))
lda_cases <- list(
 iris=function() lda_compare(xx0,gg0,do_cv=TRUE),
 iris_prior=function() lda_compare(xx0,gg0,c(.6,.3,.1),do_cv=TRUE),
 two_classes=function() lda_compare(as.matrix(mt[,c("mpg","hp","wt")]),mt$am,do_cv=TRUE),
 three_cyl=function() lda_compare(as.matrix(mt[,c("mpg","disp","hp","wt")]),mt$cyl),
 class_of_one=function() { g0<-factor(c(as.character(gg0[1:149]),"lone")); lda_compare(xx0,g0) },
 single_variable=function() lda_compare(xx0[,1,drop=FALSE],gg0),
 collinear=function() lda_compare(cbind(xx0,s=xx0[,1]+xx0[,2]),gg0,do_predict=FALSE),
 na_formula=function() { keep<-complete.cases(xx0); keep[5]<-FALSE; lda_compare(xx0[keep,,drop=FALSE],gg0[keep]) },
 scale=function() { xs<-xx0; xs[,1]<-xs[,1]*1e100; lda_compare(xs,gg0,do_predict=FALSE) })
lda_res <- lapply(lda_cases,function(fn) tryCatch(fn(),error=function(e) list(error=conditionMessage(e))))
## Scalar one-variable LDA check, avoiding matrix-dimension edge cases in the generic harness.
lda_scalar <- function() {
 xv <- as.numeric(iris$Sepal.Length); levs <- levels(iris$Species); gg <- iris$Species
 ref <- MASS::lda(matrix(xv,ncol=1,dimnames=list(NULL,"Sepal.Length")),gg)
 mu <- as.numeric(ref$means[,1]); pr <- as.numeric(ref$prior); names(mu)<-levs
 sw <- sum((xv-mu[gg])^2)/(length(xv)-length(levs))
 ctr <- sum(pr*mu); sc <- 1/sqrt(sw)
 sgn <- sign(sc*as.numeric(ref$scaling[1,1])); if(sgn==0) sgn<-1
 sc <- sc*sgn
 mm <- sqrt(pr)*(mu-ctr)/sqrt(sw)
 sv <- sqrt(sum(mm^2))*sqrt(length(xv)/(length(levs)-1))
 logp <- sapply(seq_along(levs),function(j) log(pr[j])-0.5*(xv-mu[j])^2/sw)
 post <- exp(logp-apply(logp,1,max)); post <- post/rowSums(post)
 pred <- predict(ref)
 list(scaling_abs=abs(sc-ref$scaling[1,1]),svd_abs=abs(sv-ref$svd),
      x_abs=mdiff((xv-ctr)*sc,pred$x[,1]),posterior_abs=mdiff(post,pred$posterior),
      class_mismatch=sum(levs[max.col(post)]!=as.character(pred$class)),
      reference_scaling=as.numeric(ref$scaling[1,1]),reference_svd=ref$svd)
}
lda_res$single_variable <- lda_scalar()
## Canonical correlation from SVD of Cholesky-whitened cross-products.
cc_calc <- function(x0,y0,xc=TRUE,yc=TRUE) {
 xmat <- if(is.vector(x0)) matrix(x0,ncol=1) else as.matrix(x0)
 ymat <- if(is.vector(y0)) matrix(y0,ncol=1) else as.matrix(y0)
 if(is.null(colnames(xmat))) colnames(xmat)<-paste0("x",seq_len(ncol(xmat)))
 if(is.null(colnames(ymat))) colnames(ymat)<-paste0("y",seq_len(ncol(ymat)))
 xcen <- if(is.logical(xc)) if(xc) colMeans(xmat) else rep(0,ncol(xmat)) else xc
 ycen <- if(is.logical(yc)) if(yc) colMeans(ymat) else rep(0,ncol(ymat)) else yc
 xa <- sweep(xmat,2,xcen,"-"); ya <- sweep(ymat,2,ycen,"-")
 sx <- apply(abs(xa),2,max); sy <- apply(abs(ya),2,max); sx[sx==0]<-1; sy[sy==0]<-1
 xn <- sweep(xa,2,sx,"/"); yn <- sweep(ya,2,sy,"/")
 qx <- qr(xn); qy <- qr(yn)
 px <- qx$pivot[seq_len(qx$rank)]; py <- qy$pivot[seq_len(qy$rank)]
 xn <- xn[,px,drop=FALSE]; yn <- yn[,py,drop=FALSE]
 rx <- chol(crossprod(xn)); ry <- chol(crossprod(yn))
 zx <- solve(rx); zy <- solve(ry)
 cross0 <- t(zx)%*%crossprod(xn,yn)%*%zy
 ss <- svd(cross0,nu=min(nrow(cross0),ncol(cross0)),nv=min(nrow(cross0),ncol(cross0)))
 xxcoef <- zx%*%ss$u; yycoef <- zy%*%ss$v
 xxcoef <- sweep(xxcoef,1,sx[px],"/"); yycoef <- sweep(yycoef,1,sy[py],"/")
 rownames(xxcoef)<-colnames(xmat)[px]; rownames(yycoef)<-colnames(ymat)[py]
 list(cor=ss$d,xcoef=xxcoef,ycoef=yycoef,xcenter=xcen,ycenter=ycen,px=px,py=py,
      xmat=xmat,ymat=ymat)
}
proj <- function(z) {
 q0<-qr(z); if(q0$rank==0L) return(matrix(0,nrow(z),nrow(z)))
 q1<-qr.Q(q0)[,seq_len(q0$rank),drop=FALSE]; tcrossprod(q1)
}
cc_compare <- function(x0,y0,xc=TRUE,yc=TRUE) {
 ref <- stats::cancor(x0,y0,xcenter=xc,ycenter=yc)
 calc <- cc_calc(x0,y0,xc,yc)
 rx <- as.matrix(ref$xcoef); ry <- as.matrix(ref$ycoef)
 cx <- calc$xcoef; cy <- calc$ycoef
 ncan <- min(ncol(rx),ncol(cx),ncol(ry),ncol(cy))
 sx <- vapply(seq_len(ncan),function(j) sign(sum(rx[,j]*cx[,j])),numeric(1))
 sy <- vapply(seq_len(ncan),function(j) sign(sum(ry[,j]*cy[,j])),numeric(1))
 if(is.null(rownames(rx))) rownames(rx)<-rownames(cx)
 if(is.null(rownames(ry))) rownames(ry)<-rownames(cy)
 xix <- match(rownames(rx),colnames(calc$xmat)); yix <- match(rownames(ry),colnames(calc$ymat))
 xsub <- calc$xmat[,xix,drop=FALSE]; ysub <- calc$ymat[,yix,drop=FALSE]
 xcsub <- sweep(xsub,2,ref$xcenter[xix],"-"); ycsub <- sweep(ysub,2,ref$ycenter[yix],"-")
 xvar_ref <- xcsub%*%rx; yvar_ref <- ycsub%*%ry
 cx_adj <- sweep(cx[,seq_len(ncan),drop=FALSE],2,sx,"*")
 cy_adj <- sweep(cy[,seq_len(ncan),drop=FALSE],2,sy,"*")
 xvar_calc <- sweep(calc$xmat[,calc$px,drop=FALSE],2,calc$xcenter[calc$px],"-")%*%cx_adj
 yvar_calc <- sweep(calc$ymat[,calc$py,drop=FALSE],2,calc$ycenter[calc$py],"-")%*%cy_adj
 list(cor_max_abs=mdiff(calc$cor,ref$cor),xcoef_signs=sx,ycoef_signs=sy,
  xcoef_max_abs=mdiff(cx_adj,rx[,seq_len(ncan),drop=FALSE]),
  ycoef_max_abs=mdiff(cy_adj,ry[,seq_len(ncan),drop=FALSE]),
  xcoef_max_rel=max(abs(cx_adj-rx[,seq_len(ncan),drop=FALSE])/pmax(abs(rx[,seq_len(ncan),drop=FALSE]),1e-300)),
  ycoef_max_rel=max(abs(cy_adj-ry[,seq_len(ncan),drop=FALSE])/pmax(abs(ry[,seq_len(ncan),drop=FALSE]),1e-300)),
  x_scores_max_abs=mdiff(xvar_calc,xvar_ref),y_scores_max_abs=mdiff(yvar_calc,yvar_ref),
  x_metric=crossprod(rx,crossprod(xcsub)%*%rx),y_metric=crossprod(ry,crossprod(ycsub)%*%ry),
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
