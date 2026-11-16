# issue: 525
# Three-group, three-event-time experiments: create two distinct Gray weights before a final cause-1 tie.
score_stat <- function(dat, rho) {
  groups <- sort(unique(dat$group)); z <- rep(0,length(groups))
  for (st in sort(unique(dat$strata))) {
    ix <- dat$strata==st; tt<-dat$time[ix]; ss<-dat$status[ix]; gg<-dat$group[ix]
    ev<-sort(unique(tt[ss!=0])); S<-rep(1,length(groups)); F1<-rep(0,length(groups)); G<-1
    for(t in ev) {
      Y<-vapply(groups,function(g)sum(gg==g & tt>=t),0L)
      d1<-vapply(groups,function(g)sum(gg==g & tt==t & ss==1),0L)
      d2<-vapply(groups,function(g)sum(gg==g & tt==t & ss!=0 & ss!=1),0L)
      h<-ifelse(Y==0,0,Y/S); R<-ifelse(Y==0,0,Y*(1-F1)/S)
      d<-sum(d1); ht<-sum(h); rt<-sum(R)
      if(rt>0) z<-z+G^rho*(d1-R*d/rt)
      F1<-F1+ifelse(Y==0,0,S*d1/Y)
      S<-ifelse(Y==0,0,S*(1-(d1+d2)/Y))
      G<-G-if(ht>0)d/ht else 0
    }
  }
  fit<-cmprsk::cuminc(dat$time,dat$status,dat$group,strata=dat$strata,rho=rho)
  c(z1=unname(z[1]),z2=unname(z[2]),stat=unname(fit$Tests["1","stat"]))
}
make_case <- function(n,p1,p2,q1,q2,tie1,tie2) {
  tm<-st<-gr<-character(0)
  for(i in 1:3) {
    tm<-c(tm,rep(1,p1[i]+p2[i]),rep(2,q1[i]+q2[i]),rep(3,tie1[i]+tie2[i]),rep(4,n[i]-p1[i]-p2[i]-q1[i]-q2[i]-tie1[i]-tie2[i]))
    st<-c(st,rep(1,p1[i]),rep(2,p2[i]),rep(1,q1[i]),rep(2,q2[i]),rep(1,tie1[i]),rep(2,tie2[i]),rep(0,n[i]-p1[i]-p2[i]-q1[i]-q2[i]-tie1[i]-tie2[i]))
    gr<-c(gr,rep(c("A","B","C")[i],n[i]))
  }
  data.frame(time=as.numeric(tm),status=as.numeric(st),group=gr,strata=rep("s",length(tm)))
}
cases<-list(
 list(name="three_distinct_G_base",dat=make_case(c(10,10,10),c(1,0,0),c(0,0,0),c(0,1,0),c(1,0,0),c(2,1,1),c(0,1,0))),
 list(name="three_distinct_G_reverse",dat=make_case(c(10,10,10),c(0,1,0),c(0,0,0),c(1,0,0),c(0,0,1),c(1,2,1),c(1,0,0))),
 list(name="three_ties_A_heavy",dat=make_case(c(12,10,9),c(2,0,0),c(0,1,0),c(0,1,0),c(1,0,0),c(3,1,1),c(0,1,0))),
 list(name="three_ties_B_heavy",dat=make_case(c(9,12,10),c(0,2,0),c(0,0,1),c(1,0,0),c(0,1,0),c(1,3,1),c(1,0,0))),
 list(name="three_ties_C_heavy",dat=make_case(c(10,9,12),c(0,0,2),c(1,0,0),c(0,0,1),c(0,1,0),c(1,1,3),c(0,0,1))),
 list(name="three_group_cause2_ties",dat=make_case(c(10,10,10),c(1,0,0),c(0,0,0),c(0,1,0),c(1,0,0),c(1,1,1),c(1,2,1))),
 list(name="three_group_unequal_n",dat=make_case(c(8,11,13),c(1,0,0),c(0,1,0),c(0,2,0),c(1,0,1),c(2,1,2),c(0,1,0))),
 list(name="three_group_more_pre",dat=make_case(c(14,12,11),c(2,1,0),c(1,0,1),c(1,0,2),c(0,1,0),c(2,2,1),c(1,0,1)))
)
for(x in cases) {
 cat("CASE ",x$name,"\n",sep="")
 for(rho in c(-2,-1,-0.5,0,0.5,1,1.5,2,3,4)) {
  v<-score_stat(x$dat,rho)
  cat("rho=",sprintf("%.17g",rho)," z1=",sprintf("%.17g",v[["z1"]]),
      " z2=",sprintf("%.17g",v[["z2"]])," stat=",sprintf("%.17g",v[["stat"]]),"\n",sep="")
 }
}
