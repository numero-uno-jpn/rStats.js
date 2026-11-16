# issue: 525
# Isolate multiple cause-1 tied times with no competing causes or censoring before them.
run_one<-function(label,nA,nB,a1,b1,a2,b2,rho) {
  build<-function(g,n,x1,x2) {
    data.frame(time=c(rep(1,x1),rep(2,x2),rep(3,n-x1-x2)),
      status=c(rep(1,x1),rep(1,x2),rep(0,n-x1-x2)),group=rep(g,n))
  }
  dat<-rbind(build("A",nA,a1,a2),build("B",nB,b1,b2))
  fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
  S<-c(1,1); F1<-c(0,0); G0<-1; z<-0; rec<-list()
  for(tt in c(1,2)) {
    Y<-c(sum(dat$group=="A"&dat$time>=tt),sum(dat$group=="B"&dat$time>=tt))
    N1<-c(sum(dat$group=="A"&dat$time==tt&dat$status==1),sum(dat$group=="B"&dat$time==tt&dat$status==1))
    h<-Y/S; R<-Y*(1-F1)/S; H<-sum(h); d<-sum(N1); L<-G0^rho
    z<-z+L*(N1[1]-R[1]*d/sum(R))
    dF0<-d/H; Gafter<-G0-dF0; Safter<-S*(1-N1/Y)
    q<-Gafter/Safter; dGamma<-dF0/G0
    D<-L*h[1]*(c(1,0)-h/H)
    rec[[length(rec)+1]]<-list(Y=Y,h=h,H=H,D=D,dF0=dF0,q=q,dGamma=dGamma,L=L,d=d)
    F1<-F1+S*N1/Y; S<-Safter; G0<-Gafter
  }
  future<-c(0,0); V0<-0; corrD<-0; corrA<-0
  for(j in 2:1) {
    x<-rec[[j]]; aa<-x$D+(1-x$q)*future
    if(j==1) { } 
    for(r in 1:2) V0<-V0+aa[r]^2*x$dF0/x$h[r]
    Ytot<-sum(x$Y); qsub<-x$h/x$Y
    kernel<-function(u) {
      w<-u/(x$L*x$h)
      (Ytot-1)/x$H*sum(x$Y*qsub^2*w^2/(x$H-qsub))
    }
    if(x$d>1) {
      corrD<-corrD+x$d*(x$d-1)/(Ytot-1)*kernel(x$D)
      corrA<-corrA+x$d*(x$d-1)/(Ytot-1)*kernel(aa)
    }
    future<-future+x$D*x$dGamma
  }
  stat<-unname(fit$Tests["1","stat"]); Vr<-z*z/stat
  cat(label," rho=",rho," z=",sprintf("%.17g",z)," V_R=",sprintf("%.17g",Vr),
      " V0=",sprintf("%.17g",V0)," corrD=",sprintf("%.17g",corrD),
      " corrA=",sprintf("%.17g",corrA)," predD=",sprintf("%.17g",V0-corrD),
      " predA=",sprintf("%.17g",V0-corrA),"\n",sep="")
}
for(rho in c(-2,-1,0,1,2,3)) {
 run_one("m01",6,6,2,1,2,1,rho)
 run_one("m02",7,6,3,1,2,2,rho)
 run_one("m03",8,7,2,2,3,1,rho)
}
