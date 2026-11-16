# issue: 525
# Hold Y, S, h and the pre-tie history fixed; vary only the tied count and its group allocation.
# The inferred B coefficient should be invariant to d1 and to the allocation of the d1 failures.
run_one<-function(label,tieA,tieB) {
  nA<-8; nB<-7; priorA<-1; tTie<-2
  timeA<-c(1,rep(tTie,tieA),rep(3,nA-priorA-tieA))
  statusA<-c(1,rep(1,tieA),rep(0,nA-priorA-tieA))
  timeB<-c(rep(tTie,tieB),rep(3,nB-tieB))
  statusB<-c(rep(1,tieB),rep(0,nB-tieB))
  dat<-data.frame(time=c(timeA,timeB),status=c(statusA,statusB),
                  group=c(rep("A",nA),rep("B",nB)))
  one_rho<-function(rho) {
    fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
    stat<-unname(fit$Tests["1","stat"])
    S<-c(1,1); F1<-c(0,0); G0<-1; z<-0
    times<-sort(unique(dat$time[dat$status!=0])); saved<-vector("list",length(times))
    for(j in seq_along(times)) {
      tt<-times[j]
      Y<-c(sum(dat$group=="A"&dat$time>=tt),sum(dat$group=="B"&dat$time>=tt))
      N1<-c(sum(dat$group=="A"&dat$time==tt&dat$status==1),sum(dat$group=="B"&dat$time==tt&dat$status==1))
      N2<-c(0,0); Sminus<-S; h<-ifelse(Y>0,Y/Sminus,0); R<-ifelse(Y>0,Y*(1-F1)/Sminus,0)
      d1<-sum(N1); H<-sum(h); RR<-sum(R); L<-G0^rho
      if(d1>0&&RR>0) z<-z+L*(N1-R*d1/RR)[1]
      dF0<-if(H>0)d1/H else 0; Gafter<-G0-dF0
      Safter<-ifelse(Y>0,Sminus*(1-(N1+N2)/Y),0)
      q<-ifelse(Safter>0,Gafter/Safter,0); dF2<-ifelse(Y>0,Sminus*N2/Y,0)
      dGamma<-if(G0>0)dF0/G0 else 0; p<-if(H>0)h/H else c(0,0)
      D<-L*h[1]*(c(1,0)-p)
      saved[[j]]<-list(h=h,Y=Y,D=D,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L,p=p,H=H)
      F1<-F1+ifelse(Y>0,Sminus*N1/Y,0); S<-Safter; G0<-Gafter
    }
    m<-length(saved); future<-c(0,0); Vprior<-0
    for(j in m:1) {
      cur<-saved[[j]]
      if(j<m) {
        rest<-future; aa<-cur$D+(1-cur$q)*rest; bb<--cur$q*rest; ok<-cur$h>0
        Vprior<-Vprior+sum((aa[ok]^2*cur$dF0+bb[ok]^2*cur$dF2[ok])/cur$h[ok])
      }
      future<-future+cur$D*cur$dGamma
    }
    last<-saved[[m]]; h<-last$h; H<-sum(h); p<-h/H
    w<-last$D/(last$L*h); A<-sum(p*w*w)
    Ytot<-sum(last$Y); d<-tieA+tieB; qsub<-last$h/last$Y
    B<-(Ytot-1)/H*sum(last$Y*qsub^2*w^2/(H-qsub))
    own<-(z*z/stat-Vprior)/(last$L^2)
    c(BoverA=B/A,own=own,A=A,B=B)
  }
  M<-sapply(c(-2,-1,0,1,2,3),one_rho)
  cat(label," tie=",tieA,",",tieB," d=",tieA+tieB,
      " B/A=",sprintf("%.17g",mean(M["BoverA",])),
      " B/A_range=",sprintf("%.17g",diff(range(M["BoverA",]))),
      " own_range=",sprintf("%.17g",diff(range(M["own",]))),"\n",sep="")
}
run_one("fixed_d2",1,1)
run_one("fixed_d3_A2",2,1)
run_one("fixed_d3_B2",1,2)
run_one("fixed_d4",2,2)
run_one("fixed_d5_A3",3,2)
run_one("fixed_d5_B3",2,3)
