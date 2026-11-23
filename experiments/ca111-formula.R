# issue: 560
# Independent CA and MCA spectral checks using public fits and base R linear algebra.
library(ca)
library(jsonlite)
N <- as.matrix(smoke); n <- sum(N); P <- N/n; rm <- rowSums(P); cm <- colSums(P)
S <- diag(1/sqrt(rm)) %*% (P - outer(rm,cm)) %*% diag(1/sqrt(cm))
sv <- svd(S)
fit <- ca::ca(smoke)
rowstd <- diag(1/sqrt(rm)) %*% sv$u
colstd <- diag(1/sqrt(cm)) %*% sv$v
rowprin <- sweep(rowstd[,1:3,drop=FALSE],2,sv$d[1:3],"*")
colprin <- sweep(colstd[,1:3,drop=FALSE],2,sv$d[1:3],"*")
rowdist2 <- rowSums((sweep(P,1,rm,"/") - matrix(cm,nrow=nrow(P),ncol=ncol(P),byrow=TRUE))^2 / matrix(cm,nrow=nrow(P),ncol=ncol(P),byrow=TRUE))
# MCA indicator matrix from four wg93 factors
dat <- wg93[,1:4]
Z <- do.call(cbind,lapply(dat,function(v) { lev <- levels(v); out <- sapply(lev,function(a) as.numeric(v==a)); if(is.null(dim(out))) out <- matrix(out,ncol=1); colnames(out)<-paste0("V",seq_along(lev),":",lev); out }))
Q <- ncol(dat); J <- ncol(Z); K <- crossprod(Z)
fit_indicator <- mjca(dat,lambda="indicator")
fit_burt <- mjca(dat,lambda="Burt")
fit_adjusted <- mjca(dat,lambda="adjusted")
fit_jca <- mjca(dat,lambda="JCA")
eig <- svd((sqrt(nrow(Z)) *
  (Z/(nrow(Z)*Q) - outer(rep(1/nrow(Z),nrow(Z)),colSums(Z)/(nrow(Z)*Q))) %*%
  diag(1/sqrt(colSums(Z)/(nrow(Z)*Q)))))$d^2
ben <- ifelse(eig > 1/Q, (Q/(Q-1))^2*(eig-1/Q)^2, 0)
out <- list(
 ca_smoke_sv=fit$sv, ca_direct_sv=sv$d,
 ca_smoke_rowcoord=fit$rowcoord, ca_direct_rowcoord=rowstd[,1:3,drop=FALSE], ca_direct_rowprincipal=rowprin,
 ca_smoke_colcoord=fit$colcoord, ca_direct_colcoord=colstd[,1:3,drop=FALSE], ca_direct_colprincipal=colprin,
 ca_summary_row_qlt=rowSums((rowprin[,1:2,drop=FALSE]^2)/rowdist2)*1000,
 ca_summary_row_inr=rm*rowdist2/sum(sv$d^2)*1000,
 ca_summary_row_cor=(rowprin[,1:2,drop=FALSE]^2)/rowdist2*1000,
 ca_summary_row_ctr=sweep(rowprin[,1:2,drop=FALSE]^2,2,sv$d[1:2]^2,"/")*rm*1000,
 ca_summary_col_qlt=rowSums((colprin[,1:2,drop=FALSE]^2)/colSums((sweep(P,2,cm,"/")-matrix(rm,nrow=nrow(P),ncol=ncol(P)))^2/matrix(rm,nrow=nrow(P),ncol=ncol(P))))*1000,
 ca_summary_col_inr=colSums(P)*colSums((sweep(P,2,cm,"/")-matrix(rm,nrow=nrow(P),ncol=ncol(P)))^2/matrix(rm,nrow=nrow(P),ncol=ncol(P)))/sum(sv$d^2)*1000,
 ca_summary_col_cor=(colprin[,1:2,drop=FALSE]^2)/colSums((sweep(P,2,cm,"/")-matrix(rm,nrow=nrow(P),ncol=ncol(P)))^2/matrix(rm,nrow=nrow(P),ncol=ncol(P)))*1000,
 ca_summary_col_ctr=sweep(colprin[,1:2,drop=FALSE]^2,2,sv$d[1:2]^2,"/")*cm*1000,
 ca_rowmass=fit$rowmass, ca_colmass=fit$colmass,
 ca_total_inertia=sum(sv$d^2), ca_rowdist2=rowdist2,
 ca_suprow=ca(smoke,suprow=5)$rowcoord[5,,drop=FALSE],
 ca_suprow_formula=as.numeric((smoke[5,]/sum(smoke[5,])) %*% ca(smoke[-5,])$colcoord) / ca(smoke[-5,])$sv,
 mjca_indicator_total=fit_indicator$inertia.t, mjca_indicator_eigen=fit_indicator$sv^2,
 mjca_indicator_direct_eigen=eig, mjca_indicator_levels=J,
 mjca_variables=Q, mjca_indicator_formula_total=(J-Q)/Q,
 mjca_burt_total=fit_burt$inertia.t, mjca_adjusted_total=fit_adjusted$inertia.t,
 mjca_benzeczi_direct=ben, mjca_benzeczi_total=sum(ben), mjca_benzeczi_share=ben/sum(ben), mjca_adjusted_eigen=fit_adjusted$inertia.e,
 mjca_jca_total=fit_jca$inertia.t, mjca_jca_et=fit_jca$inertia.et
)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
