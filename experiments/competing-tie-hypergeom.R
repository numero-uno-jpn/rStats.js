# issue: 525
# Test a uniform-without-replacement correction for competing-cause ties (d2).
# The designs have one cause-1 event at t=1 and one at t=3, with a cause-2 tie at t=2.
make_data<-function(nA,nB,a1,b1,a2,b2,a3,b3) {
  build<-function(g,n,x1,x2,x3) data.frame(
    time=c(rep(1,x1),rep(2,x2),rep(3,x3),rep(4,n-x1-x2-x3)),
    status=c(rep(1,x1),rep(2,x2),rep(1,x3),rep(0,n-x1-x2-x3)),group=rep(g,n))
  rbind(build("A",nA,a1,a2,a3),build("B",nB,b1,b2,b3))
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
    rec[[length(rec)+1]]<-list(Y=Y,S=S,h=h,H=H,D=D,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L,d1=d1,d2=d2,N2=N2)
    F1<-F1+ifelse(Y>0,S*N1/Y,0); S<-Safter; G0<-Gafter
  }
  future<-c(0,0); V0<-0; corrHyper<-0; corrPPS<-0; corrGroup<-0
  for(j in length(rec):1) {
    x<-rec[[j]]; aa<-x$D+(1-x$q)*future; bb<--x$q*future; ok<-x$h>0
    V0<-V0+sum((aa^2*x$dF0+bb^2*x$dF2)[ok]/x$h[ok])
    Ytot<-sum(x$Y)
    if(x$d2>1&&Ytot>1) {
      # Uniform finite-population variance for the per-subject competing-event influence.
      per<-ifelse(x$Y>0,x$S*bb/x$Y,0); p<-x$Y/Ytot
      vhyper<-x$d2*(Ytot-x$d2)/(Ytot-1)*(sum(p*per^2)-sum(p*per)^2)
      vbase<-sum(bb^2*x$dF2/x$h)
      corrHyper<-corrHyper+vbase-vhyper
      for(r in 1:2) if(x$N2[r]>1 && x$Y[r]>1) {
        corrGroup<-corrGroup+bb[r]^2*x$dF2[r]/x$h[r]*(x$N2[r]-1)/(x$Y[r]-1)
      }
      # Alternative weighted-PPS candidate from the target-cause derivation.
      qsub<-ifelse(x$Y>0,x$h/x$Y,0); w<-ifelse(x$h>0,bb/(x$L*x$h),0)
      B<-(Ytot-1)/x$H*sum(x$Y*qsub^2*w^2/(x$H-qsub))
      corrPPS<-corrPPS+x$L^2*x$d2*(x$d2-1)/(Ytot-1)*B
    }
    future<-future+x$D*x$dGamma
  }
  stat<-unname(fit$Tests["1","stat"]); Vr<-z*z/stat
  cat(label," rho=",rho," V_R=",sprintf("%.17g",Vr)," V0=",sprintf("%.17g",V0),
      " corrHyper=",sprintf("%.17g",corrHyper)," corrPPS=",sprintf("%.17g",corrPPS)," corrGroup=",sprintf("%.17g",corrGroup),
      " predHyper=",sprintf("%.17g",V0-corrHyper)," predPPS=",sprintf("%.17g",V0-corrPPS)," predGroup=",sprintf("%.17g",V0-corrGroup),"\n",sep="")
}
cases<-list(
 list("d2_2",make_data(7,7,1,0,1,1,0,1)),
 list("d2_3",make_data(8,8,1,0,2,1,0,1)),
 list("d2_4",make_data(9,8,1,0,2,2,0,1)),
 list("d2_5",make_data(10,9,1,0,3,2,0,1)),
 list("d2_6_asym",make_data(10,8,1,0,4,2,0,1))
)
for(x in cases) for(rho in c(-1,0,1)) one(x[[1]],x[[2]],rho)
