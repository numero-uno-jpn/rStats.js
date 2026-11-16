# issue: 525
# Test whether the tied-time own-term correction also changes earlier-time cross terms.
# Each design has one untied cause-1 event in A and one competing event in B at t=1,
# followed by a tied cause-1 time at t=2. The earlier b-part is therefore nonzero.
# Compare public cmprsk::cuminc() V=z^2/stat with equation (2.10) prior terms plus
# the proposed sequential-without-replacement own-term correction.
run_one <- function(label,nA,nB,tieA,tieB) {
  nA<-as.integer(nA); nB<-as.integer(nB); tieA<-as.integer(tieA); tieB<-as.integer(tieB)
  timeA<-c(1,rep(2,tieA),rep(3,nA-1-tieA))
  statusA<-c(1,rep(1,tieA),rep(0,nA-1-tieA))
  timeB<-c(1,rep(2,tieB),rep(3,nB-1-tieB))
  statusB<-c(2,rep(1,tieB),rep(0,nB-1-tieB))
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
      N2<-c(sum(dat$group=="A"&dat$time==tt&dat$status>1),sum(dat$group=="B"&dat$time==tt&dat$status>1))
      Sminus<-S; h<-ifelse(Y>0,Y/Sminus,0); R<-ifelse(Y>0,Y*(1-F1)/Sminus,0)
      d1<-sum(N1); H<-sum(h); RR<-sum(R); L<-G0^rho
      if(d1>0&&RR>0) z<-z+L*(N1-R*d1/RR)[1]
      dF0<-if(H>0)d1/H else 0; Gafter<-G0-dF0
      Safter<-Sminus*ifelse(Y>0,1-(N1+N2)/Y,1)
      q<-ifelse(Safter>0,Gafter/Safter,0)
      dF2<-ifelse(Y>0,Sminus*N2/Y,0)
      dGamma<-if(G0>0)dF0/G0 else 0
      p<-if(H>0)h/H else c(0,0)
      dvec<-L*h[1]*(c(1,0)-p)
      saved[[j]]<-list(h=h,Y=Y,dvec=dvec,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,L=L)
      F1<-F1+ifelse(Y>0,Sminus*N1/Y,0); S<-Safter; G0<-Gafter
    }
    m<-length(saved); future<-c(0,0); Vprior<-0
    if(m>1) for(j in m:1) {
      cur<-saved[[j]]
      if(j<m) {
        rest<-future; a<-cur$dvec+(1-cur$q)*rest; b<--cur$q*rest; ok<-cur$h>0
        Vprior<-Vprior+sum((a[ok]^2*cur$dF0+b[ok]^2*cur$dF2[ok])/cur$h[ok])
      }
      future<-future+cur$dvec*cur$dGamma
    }
    last<-saved[[m]]; h<-last$h; H<-sum(h); p<-h/H
    w<-last$dvec/(last$L*h); A<-sum(p*w*w)
    Ytot<-sum(last$Y); d<-tieA+tieB; qsub<-1/(last$Y/h)
    B<-(Ytot-1)/H*sum(last$Y*qsub^2*w^2/(H-qsub))
    own<-d*(A-(d-1)/(Ytot-1)*B)
    V<-z*z/stat; pred<-Vprior+last$L^2*own
    c(V=V,Vprior=Vprior,L=last$L,own=own,pred=pred,resid=V-pred,BoverA=B/A)
  }
  rhos<-c(-2,-1,0,1,2,3); M<-sapply(rhos,one_rho)
  cat(label," n=",nA,",",nB," tie=",tieA,",",tieB," d=",tieA+tieB,
      " max_abs_resid=",sprintf("%.17g",max(abs(M["resid",]))),
      " B/A=",sprintf("%.12g",M["BoverA",1]),"\n",sep="")
  for(i in seq_along(rhos)) cat(" rho=",rhos[i]," V=",sprintf("%.12g",M["V",i]),
      " prior=",sprintf("%.12g",M["Vprior",i])," own=",sprintf("%.12g",M["own",i]),
      " pred=",sprintf("%.12g",M["pred",i])," resid=",sprintf("%.12g",M["resid",i]),"\n",sep="")
}
cases<-list(
 c("x01",3,3,1,1),c("x02",4,3,1,1),c("x03",3,4,2,0),c("x04",5,3,1,1),
 c("x05",3,5,1,1),c("x06",6,4,1,1),c("x07",4,6,1,2),c("x08",7,5,2,1),
 c("x09",5,7,1,2),c("x10",8,5,2,1),c("x11",5,8,1,3),c("x12",8,6,2,2),
 c("x13",6,8,1,2),c("x14",9,6,3,2),c("x15",6,9,2,3),c("x16",10,7,3,2),
 c("x17",7,10,2,3),c("x18",9,9,2,2),c("x19",11,8,4,2),c("x20",8,11,3,4)
)
for(x in cases) do.call(run_one,as.list(x))
