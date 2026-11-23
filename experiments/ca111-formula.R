# issue: 560
# Independent CA and MCA spectral checks using public fits and base R linear algebra.
library(ca)
library(jsonlite)
N <- as.matrix(smoke); n <- sum(N); P <- N/n; rm <- rowSums(P); cm <- colSums(P)
S <- diag(1/sqrt(rm)) %*% (P - outer(rm,cm)) %*%% diag(1/sqrt(cm))
sv <- svd(S)
fit <- ca::ca(smoke)
rowstd <- diag(1/sqrt(rm)) %*% sv$u
colstd <- diag(1/sqrt(cm)) %*% sv$v
rowprin <- sweep(rowstd,2,sv$d,"*")
colprin <- sweep(colstd,2,sv$d,"*")
rowdist2 <- rowSums((sweep(P,1,rm,"/") - matrix(cm,nrow=nrow(P),ncol=ncol(P),byrow=TRUE))^2 / matrix(cm,nrow=nrow(P),ncol=ncol(P),byrow=TRUE))
# MCA indicator matrix from four wg93 factors
dat <- wg93[,1:4]
Z <- do.call(cbind,lapply(dat,function(v) { lev <- levels(v); out <- sapply(lev,function(a) as.numeric(v==a)); if(is.null(dim(out))) out <- matrix(out,ncol=1); colnames(out)<-paste0("V",seq_along(lev),":",lev); out }))
Q <- ncol(dat); J <- ncol(Z); K <- crossprod(Z)
fit_indicator <- mjca(dat,lambda="indicator")
fit_burt <- mjca(dat,lambda="Burt")
fit_adjusted <- mjca(dat,lambda="adjusted")
fit_jca <- mjca(dat,lambda="JCA")
eig <- svd((diag(1/sqrt(colSums(Z)/(nrow(Z)*Q))) %*%
  (Z/(nrow(Z)*Q) - outer(rep(1,nrow(Z)),colSums(Z)/(nrow(Z)*Q))) %*%
  diag(1/sqrt(colSums(Z)/(nrow(Z)*Q)))))$d^2
ben <- ifelse(eig > 1/Q, (Q/(Q-1))^2*(eig-1/Q)^2, 0)
out <- list(
 ca_smoke_sv=fit$sv, ca_direct_sv=sv$d,
 ca_smoke_rowcoord=fit$rowcoord, ca_direct_rowcoord=rowprin,
 ca_smoke_colcoord=fit$colcoord, ca_direct_colcoord=colprin,
 ca_rowmass=fit$rowmass, ca_colmass=fit$colmass,
 ca_total_inertia=sum(sv$d^2), ca_rowdist2=rowdist2,
 ca_suprow=ca(smoke,suprow=5)$rowcoord[5,,drop=FALSE],
 mjca_indicator_total=fit_indicator$inertia.t, mjca_indicator_eigen=mca$sv^2,
 mjca_indicator_direct_eigen=eig, mjca_indicator_levels=J,
 mjca_variables=Q, mjca_indicator_formula_total=(J-Q)/Q,
 mjca_burt_total=fit_burt$inertia.t, mjca_adjusted_total=fit_adjusted$inertia.t,
 mjca_benzeczi_direct=ben, mjca_adjusted_eigen=adjusted$inertia.e,
 mjca_jca_total=fit_jca$inertia.t, mjca_jca_et=jca$inertia.et
)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
