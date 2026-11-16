# issue: 525
# Three-group mixed-cause tied-time validation, including within-group competing ties.
make_data<-function(n,n1a,n2a,n1b,stratum="S1") {
  groups<-c("A","B","C")
  out<-vector("list",3)
  for(r in 1:3) {
    tt<-c(rep(1,n1a[r]),rep(1,n2a[r]),rep(2,n1b[r]),rep(3,n[r]-n1a[r]-n2a[r]-n1b[r]))
    ss<-c(rep(1,n1a[r]),rep(2,n2a[r]),rep(1,n1b[r]),rep(0,n[r]-n1a[r]-n2a[r]-n1b[r]))
    out[[r]]<-data.frame(time=tt,status=ss,group=rep(groups[r],n[r]),strata=rep(stratum,n[r]))
  }
  do.call(rbind,out)
}
components<-function(dat,rho) {
  groups<-c("A","B","C"); K<-3; S<-rep(1,K); F1<-rep(0,K); G0<-1
  z<-rep(0,K-1); times<-sort(unique(dat$time[dat$status!=0])); saved<-vector("list",length(times))
  for(j in seq_along(times)) {
    tt<-times[j]
    Y<-vapply(groups,function(g)sum(dat$group==g&dat$time>=tt),0)
    N1<-vapply(groups,function(g)sum(dat$group==g&dat$time==tt&dat$status==1),0)
    N2<-vapply(groups,function(g)sum(dat$group==g&dat$time==tt&dat$status>1),0)
    Sm<-S; h<-ifelse(Y>0,Y/Sm,0); R<-ifelse(Y>0,Y*(1-F1)/Sm,0)
    H<-sum(h); RR<-sum(R); d1<-sum(N1); L<-G0^rho
    if(d1>0&&RR>0) z<-z+L*(N1[1:2]-R[1:2]*d1/RR)
    dF0<-if(H>0)d1/H else 0; Gafter<-G0-dF0
    Safter<-ifelse(Y>0,Sm*(1-(N1+N2)/Y),0)
    q<-ifelse(Safter>0,Gafter/Safter,0)
    dF2<-ifelse(Y>0,Sm*N2/Y,0); dGamma<-if(G0>0)dF0/G0 else 0
    p<-if(H>0)h/H else rep(0,K); D<-matrix(0,K-1,K)
    for(k in 1:(K-1)) D[k,]<-L*h[k]*((1:K==k)-p)
    saved[[j]]<-list(Y=Y,h=h,H=H,N2=N2,D=D,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L,d1=d1)
    F1<-F1+ifelse(Y>0,Sm*N1/Y,0); S<-Safter; G0<-Gafter
  }
  future<-matrix(0,K-1,K); Sigma<-matrix(0,K-1,K-1)
  if(length(saved)>0) for(j in length(saved):1) {
    x<-saved[[j]]; aa<-x$D+sweep(future,2,1-x$q,"*"); bb<--sweep(future,2,x$q,"*")
    for(r in 1:K) if(x$h[r]>0)
      Sigma<-Sigma+tcrossprod(aa[,r])*x$dF0/x$h[r]+tcrossprod(bb[,r])*x$dF2[r]/x$h[r]
    Ytot<-sum(x$Y)
    if(x$d1>1&&Ytot>1&&x$H>0) {
      W<-matrix(0,K-1,K)
      for(r in 1:K) if(x$L*x$h[r]>0) W[,r]<-aa[,r]/(x$L*x$h[r])
      qsub<-ifelse(x$Y>0,x$h/x$Y,0)
      bw<-ifelse(x$H>qsub,x$Y*qsub^2/(x$H-qsub),0)
      B<-(Ytot-1)/x$H*(W%*%diag(bw)%*%t(W))
      Sigma<-Sigma-x$L^2*x$d1*(x$d1-1)/(Ytot-1)*B
    }
    for(r in 1:K) if(x$N2[r]>1&&x$Y[r]>1&&x$h[r]>0)
      Sigma<-Sigma-tcrossprod(bb[,r])*x$dF2[r]/x$h[r]*(x$N2[r]-1)/(x$Y[r]-1)
    future<-future+x$D*x$dGamma
  }
  list(z=z,Sigma=Sigma,pred=as.numeric(t(z)%*%solve(Sigma,z)),det=det(Sigma))
}
check_case<-function(label,dat,stratified=FALSE) {
  rhos<-c(-2,-1,0,1,2,3); res<-numeric(length(rhos))
  for(i in seq_along(rhos)) {
    rho<-rhos[i]; fit<-if(stratified)cmprsk::cuminc(dat$time,dat$status,dat$group,dat$strata,rho=rho) else cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
    if(stratified) {
      z<-rep(0,2); Sigma<-matrix(0,2,2)
      for(s in unique(dat$strata)) { cc<-components(dat[dat$strata==s,],rho); z<-z+cc$z; Sigma<-Sigma+cc$Sigma }
      pred<-as.numeric(t(z)%*%solve(Sigma,z))
    } else pred<-components(dat,rho)$pred
    stat<-unname(fit$Tests["1","stat"]); res[i]<-stat-pred
  }
  cat(label," max_abs_residual=",sprintf("%.17g",max(abs(res))),"\n",sep="")
  for(i in seq_along(rhos))cat(" rho=",rhos[i]," residual=",sprintf("%.17g",res[i]),"\n",sep="")
}
cases<-list(
 list("m3_01",c(9,8,7),c(2,1,1),c(2,1,3),c(1,1,1)),
 list("m3_02",c(10,9,8),c(3,1,2),c(2,2,1),c(1,2,1)),
 list("m3_03",c(8,10,9),c(1,2,1),c(3,2,2),c(2,1,1)),
 list("m3_04",c(12,10,9),c(2,3,1),c(4,2,2),c(1,1,2))
)
for(x in cases) check_case(x[[1]],make_data(x[[2]],x[[3]],x[[4]],x[[5]]))
s1<-make_data(c(9,8,7),c(2,1,1),c(2,1,3),c(1,1,1),"S1")
s2<-make_data(c(10,9,8),c(1,2,1),c(1,2,2),c(2,1,1),"S2")
check_case("m3_two_strata",rbind(s1,s2),TRUE)
# End of three-group mixed-cause validation.
invisible(NULL)
