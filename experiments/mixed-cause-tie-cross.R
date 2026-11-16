# issue: 525
# Mixed same-time cause-1 and competing-cause ties: test cross-covariance candidates.
make_data<-function(nA,nB,a1,b1,a2,b2,c1,c2) {
  build<-function(g,n,x1,x2,x3) data.frame(
    time=c(rep(1,x1),rep(1,x2),rep(2,x3),rep(3,n-x1-x2-x3)),
    status=c(rep(1,x1),rep(2,x2),rep(1,x3),rep(0,n-x1-x2-x3)),group=rep(g,n))
  rbind(build("A",nA,a1,a2,c1),build("B",nB,b1,b2,c2))
}
one<-function(label,dat,rho) {
  fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
  S<-c(1,1); F1<-c(0,0); G0<-1; z<-0; rec<-list()
  for(tt in sort(unique(dat$time[dat$status!=0]))) {
    Y<-c(sum(dat$group=="A"&dat$time>=tt),sum(dat$group=="B"&dat$time>=tt))
    N1<-c(sum(dat$group=="A"&dat$time==tt&dat$status==1),sum(dat$group=="B"&dat$time==tt&dat$status==1))
    N2<-c(sum(dat$group=="A"&dat$time==tt&dat$status==2),sum(dat$group=="B"&dat$time==tt&dat$status==2))
    h<-ifelse(Y>0,Y/S,0); R<-ifelse(Y>0,Y*(1-F1)/S,0); H<-sum(h); d1<-sum(N1); d2<-sum(N2); L<-G0^rho
    if(d1>0&&sum(R)>0) z<-z+L*(N1[1]-R[1]*d1/sum(R))
    dF0<-if(H>0)d1/H else 0; Gafter<-G0-dF0; Safter<-ifelse(Y>0,S*(1-(N1+N2)/Y),0)
    q<-ifelse(Safter>0,Gafter/Safter,0); dF2<-ifelse(Y>0,S*N2/Y,0)
    dGamma<-if(G0>0)dF0/G0 else 0
    D<-L*h[1]*(c(1,0)-if(H>0)h/H else c(0,0))
    rec[[length(rec)+1]]<-list(Y=Y,S=S,h=h,H=H,D=D,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L,d1=d1,d2=d2,N1=N1,N2=N2)
    F1<-F1+ifelse(Y>0,S*N1/Y,0); S<-Safter; G0<-Gafter
  }
  future<-c(0,0); V0<-0; corrA<-0; corrB<-0; crossPPS<-0; crossWithin<-0
  for(j in length(rec):1) {
    x<-rec[[j]]; aa<-x$D+(1-x$q)*future; bb<--x$q*future; ok<-x$h>0
    V0<-V0+sum((aa^2*x$dF0+bb^2*x$dF2)[ok]/x$h[ok])
    Ytot<-sum(x$Y); qsub<-ifelse(x$Y>0,x$h/x$Y,0)
    kernel<-function(u,v) {
      wu<-ifelse(x$h>0,u/(x$L*x$h),0); wv<-ifelse(x$h>0,v/(x$L*x$h),0)
      (Ytot-1)/x$H*sum(x$Y*qsub^2*wu*wv/(x$H-qsub))
    }
    if(x$d1>1&&Ytot>1) corrA<-corrA+x$L^2*x$d1*(x$d1-1)/(Ytot-1)*kernel(aa,aa)
    for(r in 1:2) if(x$N2[r]>1&&x$Y[r]>1&&x$h[r]>0)
      corrB<-corrB+bb[r]^2*x$dF2[r]/x$h[r]*(x$N2[r]-1)/(x$Y[r]-1)
    if(x$d1>0&&x$d2>0&&Ytot>1)
      crossPPS<-crossPPS+2*x$L^2*x$d1*x$d2/(Ytot-1)*kernel(aa,bb)
    for(r in 1:2) if(x$N1[r]>0&&x$N2[r]>0&&x$Y[r]>1) {
      w1<-aa[r]/(x$L*x$h[r]); w2<-x$S[r]*bb[r]/x$Y[r]
      crossWithin<-crossWithin+2*x$N1[r]*x$N2[r]/(x$Y[r]-1)*w1*w2
    }
    future<-future+x$D*x$dGamma
  }
  actual<-unname(fit$Tests["1","stat"]); Vr<-z*z/actual
  need<-V0-corrA-corrB-Vr
  cat(label," rho=",rho," VR=",sprintf("%.17g",Vr)," V0=",sprintf("%.17g",V0),
      " A=",sprintf("%.17g",corrA)," B=",sprintf("%.17g",corrB),
      " needCross=",sprintf("%.17g",need),
      " PPS=",sprintf("%.17g",crossPPS),
      " within=",sprintf("%.17g",crossWithin),
      " predA+B+PPS=",sprintf("%.17g",V0-corrA-corrB-crossPPS),
      " predA+B+within=",sprintf("%.17g",V0-corrA-corrB-crossWithin),"\n",sep="")
}
cases<-list(
 list("mix01",make_data(8,8,2,1,1,2,1,1)),
 list("mix02",make_data(9,8,3,1,2,2,1,1)),
 list("mix03",make_data(10,9,2,2,2,1,2,1)),
 list("mix04",make_data(9,10,1,2,2,3,1,2)),
 list("mix05",make_data(10,10,3,2,2,2,1,1))
)
for(x in cases) for(rho in c(-1,0,1)) one(x[[1]],x[[2]],rho)
