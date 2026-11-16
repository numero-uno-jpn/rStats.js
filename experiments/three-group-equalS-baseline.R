# issue: 525
# Equal-S three-group baseline: the proposed matrix correction must reduce to the
# ordinary multivariate hypergeometric finite-population correction.
run_one<-function(label,n,tie) {
  K<-3; time<-status<-group<-numeric(0)
  for(r in 1:K) {
    time<-c(time,rep(1,tie[r]),rep(2,n[r]-tie[r]))
    status<-c(status,rep(1,tie[r]),rep(0,n[r]-tie[r]))
    group<-c(group,rep(c("A","B","C")[r],n[r]))
  }
  dat<-data.frame(time=time,status=status,group=group)
  Y<-n; H<-sum(Y); p<-Y/H; d<-sum(tie)
  z<-tie[1:2]-p[1:2]*d
  W<-matrix(0,2,3)
  for(k in 1:2) W[k,]<-n[k]*((1:3==k)-p)/n
  A<-W%*%diag(p)%*%t(W)
  B<-A
  Sigma<-d*(A-(d-1)/(H-1)*B)
  pred<-as.numeric(t(z)%*%solve(Sigma,z))
  fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,rho=0)
  stat<-unname(fit$Tests["1","stat"])
  cat(label," n=",paste(n,collapse=",")," tie=",paste(tie,collapse=","),
      " stat=",sprintf("%.17g",stat)," pred=",sprintf("%.17g",pred),
      " resid=",sprintf("%.17g",stat-pred)," det=",sprintf("%.17g",det(Sigma)),"\n",sep="")
}
run_one("eq01",c(6,5,4),c(2,1,1))
run_one("eq02",c(6,6,6),c(2,1,1))
run_one("eq03",c(8,6,5),c(1,2,1))
run_one("eq04",c(7,8,6),c(2,1,2))
run_one("eq05",c(9,7,8),c(3,2,1))
