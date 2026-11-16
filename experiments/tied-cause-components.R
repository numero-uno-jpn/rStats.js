# issue: 525
# Separate cause-1 tied-event, competing-event tied, and cross-cause finite-population corrections.
make_data <- function(nA,nB,a1,b1,a2,b2,a3,b3) {
  build <- function(g,n,x1,x2,x3) {
    tt<-c(rep(1,x1),rep(2,x2),rep(3,x3),rep(4,n-x1-x2-x3))
    ss<-c(rep(1,x1),rep(2,x2),rep(1,x3),rep(0,n-x1-x2-x3))
    data.frame(time=tt,status=ss,group=rep(g,n))
  }
  rbind(build("A",nA,a1,a2,a3),build("B",nB,b1,b2,b3))
}
one_case <- function(label,dat,rho) {
  fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
  S<-c(1,1); F1<-c(0,0); G0<-1; z<-0
  groups<-c("A","B"); times<-sort(unique(dat$time[dat$status!=0]))
  rec<-vector("list",length(times))
  for(j in seq_along(times)) {
    tt<-times[j]
    Y<-vapply(groups,function(g)sum(dat$group==g&dat$time>=tt),0)
    N1<-vapply(groups,function(g)sum(dat$group==g&dat$time==tt&dat$status==1),0)
    N2<-vapply(groups,function(g)sum(dat$group==g&dat$time==tt&dat$status==2),0)
    h<-ifelse(Y>0,Y/S,0); R<-ifelse(Y>0,Y*(1-F1)/S,0); H<-sum(h)
    d1<-sum(N1); d2<-sum(N2); L<-G0^rho
    if(d1>0&&sum(R)>0) z<-z+L*(N1[1]-R[1]*d1/sum(R))
    dF0<-if(H>0)d1/H else 0; Gafter<-G0-dF0
    Safter<-ifelse(Y>0,S*(1-(N1+N2)/Y),0)
    q<-ifelse(Safter>0,Gafter/Safter,0)
    dF2<-ifelse(Y>0,S*N2/Y,0)
    dGamma<-if(G0>0)dF0/G0 else 0
    D<-L*h[1]*(c(1,0)-if(H>0)h/H else c(0,0))
    rec[[j]]<-list(Y=Y,h=h,H=H,D=D,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L,d1=d1,d2=d2)
    F1<-F1+ifelse(Y>0,S*N1/Y,0); S<-Safter; G0<-Gafter
  }
  V0<-0; corrA<-0; corrB<-0; cross<-0; future<-0
  for(j in length(rec):1) {
    x<-rec[[j]]
    aa<-x$D+(1-x$q[1])*future
    bb<--x$q[1]*future
    if(x$h[1]>0) V0<-V0+(aa^2*x$dF0+bb^2*x$dF2[1])/x$h[1]
    if(x$h[2]>0) V0<-V0+(x$D[2]+(1-x$q[2])*future)^2*x$dF0/x$h[2]+
      (x$q[2]*future)^2*x$dF2[2]/x$h[2]
    # Bilinear finite-population kernel B(u,v), expressed using group-specific q=1/S.
    H<-x$H; Ytot<-sum(x$Y); qsub<-ifelse(x$Y>0,x$h/x$Y,0)
    kern<-function(u,v) {
      wu<-ifelse(x$h>0,u/(x$L*x$h),0)
      wv<-ifelse(x$h>0,v/(x$L*x$h),0)
      (Ytot-1)/H*sum(x$Y*qsub^2*wu*wv/(H-qsub))
    }
    # Current two-group score influence is one-dimensional; group 2 component is negative.
    u<-aa; v<-bb
    if(x$d1>1&&Ytot>1) corrA<-corrA+x$L^2*x$d1*(x$d1-1)/(Ytot-1)*kern(u,u)
    if(x$d2>1&&Ytot>1) corrB<-corrB+x$L^2*x$d2*(x$d2-1)/(Ytot-1)*kern(v,v)
    if(x$d1>0&&x$d2>0&&Ytot>1) cross<-cross+2*x$L^2*x$d1*x$d2/(Ytot-1)*kern(u,v)
    future<-future+x$D*x$dGamma
  }
  actual<-unname(fit$Tests["1","stat"]); Vactual<-z*z/actual
  vals<-c(Vactual=Vactual,V0=V0,corrA=corrA,corrB=corrB,cross=cross,
          onlyA=V0-corrA, AplusB=V0-corrA-corrB,
          AplusBplusCrossMinus=V0-corrA-corrB-cross,
          AplusBplusCrossPlus=V0-corrA-corrB+cross)
  cat(label," rho=",rho," z=",sprintf("%.17g",z)," stat=",sprintf("%.17g",actual),"\n",sep="")
  cat(paste(names(vals),sprintf("%.17g",vals),collapse=" "), "\n")
}
cases<-list(
 list("cause1_tie_only",make_data(7,7,2,0,1, 1,0,1)),
 list("cause2_tie_only",make_data(7,7,1,2,1, 1,1,1)),
 list("both_causes_same_time",make_data(7,7,2,1,1, 1,1,1)),
 list("two_cause1_ties",make_data(8,7,2,0,2, 1,0,1)),
 list("two_competing_ties",make_data(8,7,1,2,1, 1,1,1)),
 list("all_three_times_tied",make_data(9,8,2,2,2, 1,2,1))
)
for(x in cases) for(rho in c(-1,0,1)) one_case(x[[1]],x[[2]],rho)
