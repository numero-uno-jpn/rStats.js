# issue: 525
# Validate tied covariance correction on future-adjusted influence columns for three groups.
# The earlier-time covariance uses equation (2.10); the final tied-time own matrix uses
# the sequential-without-replacement B formula. Compare the resulting quadratic-form stat
# with public cmprsk::cuminc(), both unstratified and with two strata.
make_stratum <- function(n,tie,label) {
  out <- vector("list",3)
  for(r in 1:3) {
    tt <- c(1,rep(2,tie[r]),rep(3,n[r]-1-tie[r]))
    ss <- c(r,rep(1,tie[r]),rep(0,n[r]-1-tie[r]))
    out[[r]] <- data.frame(time=tt,status=ss,group=rep(c("A","B","C")[r],n[r]),
                           strata=rep(label,n[r]))
  }
  do.call(rbind,out)
}
components <- function(dat,rho) {
  K<-3; S<-rep(1,K); F1<-rep(0,K); G0<-1; z<-rep(0,K-1)
  times<-sort(unique(dat$time[dat$status!=0])); saved<-vector("list",length(times))
  for(j in seq_along(times)) {
    tt<-times[j]
    Y<-vapply(c("A","B","C"),function(g)sum(dat$group==g&dat$time>=tt),0)
    N1<-vapply(c("A","B","C"),function(g)sum(dat$group==g&dat$time==tt&dat$status==1),0)
    N2<-vapply(c("A","B","C"),function(g)sum(dat$group==g&dat$time==tt&dat$status>1),0)
    Sminus<-S; h<-ifelse(Y>0,Y/Sminus,0); R<-ifelse(Y>0,Y*(1-F1)/Sminus,0)
    d1<-sum(N1); H<-sum(h); RR<-sum(R); L<-G0^rho
    if(d1>0&&RR>0) z<-z+L*(N1[1:2]-R[1:2]*d1/RR)
    dF0<-if(H>0)d1/H else 0; Gafter<-G0-dF0
    Safter<-Sminus*ifelse(Y>0,1-(N1+N2)/Y,1)
    q<-ifelse(Safter>0,Gafter/Safter,0)
    dF2<-ifelse(Y>0,Sminus*N2/Y,0)
    dGamma<-if(G0>0)dF0/G0 else 0
    p<-if(H>0)h/H else rep(0,K)
    D<-matrix(0,K-1,K)
    for(k in 1:(K-1)) D[k,]<-L*h[k]*((1:K==k)-p)
    saved[[j]]<-list(h=h,Y=Y,D=D,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L,N2=N2)
    F1<-F1+ifelse(Y>0,Sminus*N1/Y,0); S<-Safter; G0<-Gafter
  }
  m<-length(saved); future<-matrix(0,K-1,K); Sigma<-matrix(0,K-1,K-1)
  if(m>0) for(j in m:1) {
    cur<-saved[[j]]
    rest<-future
    aa<-cur$D+sweep(rest,2,1-cur$q,"*")
    bb<--sweep(rest,2,cur$q,"*")
    for(r in 1:K) if(cur$h[r]>0) {
      Sigma<-Sigma+tcrossprod(aa[,r])*cur$dF0/cur$h[r]+
        tcrossprod(bb[,r])*cur$dF2[r]/cur$h[r]
    }
    Ytot<-sum(cur$Y); d<-sum(cur$N2)*0+sum(dat$status==1 & dat$time==times[j])
    if(d>1 && Ytot>1 && cur$H>0) {
      W<-matrix(0,K-1,K)
      for(r in 1:K) if(cur$L*cur$h[r]>0) W[,r]<-aa[,r]/(cur$L*cur$h[r])
      qsub<-ifelse(cur$Y>0,cur$h/cur$Y,0)
      Bweights<-ifelse(cur$H>qsub,cur$Y*qsub^2/(cur$H-qsub),0)
      Bown<-(Ytot-1)/cur$H*(W%*%diag(Bweights)%*%t(W))
      Sigma<-Sigma-cur$L^2*d*(d-1)/(Ytot-1)*Bown
    }
    for(r in 1:K) if(cur$N2[r]>1 && cur$Y[r]>1 && cur$h[r]>0) {
      Sigma<-Sigma-tcrossprod(bb[,r])*cur$dF2[r]/cur$h[r]*(cur$N2[r]-1)/(cur$Y[r]-1)
    }
    future<-future+cur$D*cur$dGamma
  }
  list(z=z,Sigma=Sigma,
       stat_pred=as.numeric(t(z)%*%solve(Sigma,z)),det=det(Sigma))
}
run_one <- function(label,dat,stratified=FALSE) {
  rhos<-c(-2,-1,0,1,2,3); residual<-numeric(length(rhos)); dets<-numeric(length(rhos))
  for(i in seq_along(rhos)) {
    rho<-rhos[i]
    if(stratified) {
      fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,dat$strata,rho=rho)
      ztot<-rep(0,2); Stot<-matrix(0,2,2)
      for(s in unique(dat$strata)) {
        dsub<-dat[dat$strata==s,]
        cc<-components(dsub,rho); ztot<-ztot+cc$z; Stot<-Stot+cc$Sigma
      }
      pred<-as.numeric(t(ztot)%*%solve(Stot,ztot)); dets[i]<-det(Stot)
    } else {
      fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
      cc<-components(dat,rho); pred<-cc$stat_pred; dets[i]<-cc$det
    }
    stat<-unname(fit$Tests["1","stat"])
    residual[i]<-stat-pred
  }
  cat(label," stratified=",stratified," max_abs_residual=",sprintf("%.17g",max(abs(residual))),
      " min_det=",sprintf("%.17g",min(dets)),"\n",sep="")
  for(i in seq_along(rhos)) cat(" rho=",rhos[i]," residual=",sprintf("%.17g",residual[i])," det=",sprintf("%.12g",dets[i]),"\n",sep="")
}
cases<-list(
 list("k01",c(6,5,4),c(2,1,1)),list("k02",c(8,6,5),c(1,2,1)),
 list("k03",c(7,8,6),c(2,1,2)),list("k04",c(9,7,8),c(3,2,1)),
 list("k05",c(8,9,7),c(1,3,2))
)
for(x in cases) run_one(x[[1]],make_stratum(x[[2]],x[[3]],"S1"),FALSE)
d1<-make_stratum(c(6,5,4),c(2,1,1),"S1")
d2<-make_stratum(c(7,6,5),c(1,2,1),"S2")
run_one("k06_two_strata",rbind(d1,d2),TRUE)
d3<-make_stratum(c(9,7,8),c(3,2,1),"S1")
d4<-make_stratum(c(8,10,7),c(1,3,2),"S2")
run_one("k07_two_strata_asymmetric",rbind(d3,d4),TRUE)  m<-length(saved); future<-matrix(0,K-1,K); Sigma<-matrix(0,K-1,K-1)
  if(m>0) for(j in m:1) {
    cur<-saved[[j]]
    rest<-future
    aa<-cur$D+sweep(rest,2,1-cur$q,"*")
    bb<--sweep(rest,2,cur$q,"*")
    if(j<m) for(r in 1:K) if(cur$h[r]>0) {
      Sigma<-Sigma+tcrossprod(aa[,r])*cur$dF0/cur$h[r]+
        tcrossprod(bb[,r])*cur$dF2[r]/cur$h[r]
    }
    Ytot<-sum(cur$Y); d<-cur$d1
    if(d>1 && Ytot>1 && cur$H>0) {
      W<-sweep(aa,2,cur$L*cur$h,"/")
      qsub<-ifelse(cur$Y>0,cur$h/cur$Y,0)
      Bweights<-ifelse(cur$H>qsub,cur$Y*qsub^2/(cur$H-qsub),0)
      Bown<-(Ytot-1)/cur$H*(W%*%diag(Bweights)%*%t(W))
      Sigma<-Sigma-cur$L^2*d*(d-1)/(Ytot-1)*Bown
    for(r in 1:K) if(cur$N2[r]>1 && cur$Y[r]>1 && cur$h[r]>0) {
      Sigma<-Sigma-tcrossprod(bb[,r])*cur$dF2[r]/cur$h[r]*(cur$N2[r]-1)/(cur$Y[r]-1)
    }
    }
    future<-future+cur$D*cur$dGamma
  }
  last<-saved[[m]]; own<-Sigma-Sigma

  list(z=z,Sigma=Sigma,SigmaPrior=SigmaPrior,own=own,L=last$L,
       stat_pred=as.numeric(t(z)%*%solve(Sigma,z)),det=det(Sigma))
}
run_one <- function(label,dat,stratified=FALSE) {
  rhos<-c(-2,-1,0,1,2,3); residual<-numeric(length(rhos)); dets<-numeric(length(rhos))
  for(i in seq_along(rhos)) {
    rho<-rhos[i]
    if(stratified) {
      fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,dat$strata,rho=rho)
      ztot<-rep(0,2); Stot<-matrix(0,2,2)
      for(s in unique(dat$strata)) {
        dsub<-dat[dat$strata==s,]
        cc<-components(dsub,rho); ztot<-ztot+cc$z; Stot<-Stot+cc$Sigma
      }
      pred<-as.numeric(t(ztot)%*%solve(Stot,ztot)); dets[i]<-det(Stot)
    } else {
      fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
      cc<-components(dat,rho); pred<-cc$stat_pred; dets[i]<-cc$det
    }
    stat<-unname(fit$Tests["1","stat"])
    residual[i]<-stat-pred
  }
  cat(label," stratified=",stratified," max_abs_residual=",sprintf("%.17g",max(abs(residual))),
      " min_det=",sprintf("%.17g",min(dets)),"\n",sep="")
  for(i in seq_along(rhos)) cat(" rho=",rhos[i]," residual=",sprintf("%.17g",residual[i])," det=",sprintf("%.12g",dets[i]),"\n",sep="")
}
cases<-list(
 list("k01",c(6,5,4),c(2,1,1)),list("k02",c(8,6,5),c(1,2,1)),
 list("k03",c(7,8,6),c(2,1,2)),list("k04",c(9,7,8),c(3,2,1)),
 list("k05",c(8,9,7),c(1,3,2))
)
for(x in cases) run_one(x[[1]],make_stratum(x[[2]],x[[3]],"S1"),FALSE)
d1<-make_stratum(c(6,5,4),c(2,1,1),"S1")
d2<-make_stratum(c(7,6,5),c(1,2,1),"S2")
run_one("k06_two_strata",rbind(d1,d2),TRUE)
d3<-make_stratum(c(9,7,8),c(3,2,1),"S1")
d4<-make_stratum(c(8,10,7),c(1,3,2),"S2")
run_one("k07_two_strata_asymmetric",rbind(d3,d4),TRUE)

# Re-run after correcting the tied covariance derivation and scale.
