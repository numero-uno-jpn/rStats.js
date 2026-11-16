# issue: 525
# Three-group Gray experiments for identifying the tied-time covariance matrix from rho sweeps.
score_stat <- function(dat, rho) {
  groups <- sort(unique(dat$group)); z <- rep(0,length(groups))
  for (st in sort(unique(dat$strata))) {
    ix <- dat$strata == st; tt <- dat$time[ix]; ss <- dat$status[ix]; gg <- dat$group[ix]
    ev <- sort(unique(tt[ss != 0])); S <- rep(1,length(groups)); F1 <- rep(0,length(groups)); G <- 1
    for (t in ev) {
      Y <- vapply(groups,function(g) sum(gg==g & tt>=t),0L)
      d1 <- vapply(groups,function(g) sum(gg==g & tt==t & ss==1),0L)
      d2 <- vapply(groups,function(g) sum(gg==g & tt==t & ss!=0 & ss!=1),0L)
      h <- ifelse(Y==0,0,Y/S); R <- ifelse(Y==0,0,Y*(1-F1)/S)
      d <- sum(d1); ht <- sum(h); rt <- sum(R)
      if(rt>0) z <- z + G^rho*(d1-R*d/rt)
      F1 <- F1 + ifelse(Y==0,0,S*d1/Y)
      S <- ifelse(Y==0,0,S*(1-(d1+d2)/Y))
      G <- G - if(ht>0) d/ht else 0
    }
  }
  fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,strata=dat$strata,rho=rho)
  c(z1=z[1],z2=z[2],stat=unname(fit$Tests["1","stat"]))
}
make_case <- function(name,n,p1,p2,t1,t2,o1=0,o2=0,o3=0) {
  time <- status <- group <- character(0)
  for(i in 1:3) {
    time <- c(time,rep(1,p1[i]+p2[i]),rep(2,t1[i]+t2[i]),rep(4,n[i]-p1[i]-p2[i]-t1[i]-t2[i]))
    status <- c(status,rep(1,p1[i]),rep(2,p2[i]),rep(1,t1[i]),rep(2,t2[i]),rep(0,n[i]-p1[i]-p2[i]-t1[i]-t2[i]))
    group <- c(group,rep(c("A","B","C")[i],n[i]))
  }
  data.frame(name=name,time=as.numeric(time),status=as.numeric(status),group=group,strata=rep("s",length(time)))
}
cases <- list(
 make_case("equal_history_tie_111",c(6,6,6),c(0,0,0),c(1,1,1),c(1,1,1),c(0,0,0)),
 make_case("history_A_tie_111",c(6,6,6),c(0,0,0),c(2,0,0),c(1,1,1),c(0,0,0)),
 make_case("history_B_tie_111",c(6,6,6),c(0,0,0),c(0,2,0),c(1,1,1),c(0,0,0)),
 make_case("history_C_tie_111",c(6,6,6),c(0,0,0),c(0,0,2),c(1,1,1),c(0,0,0)),
 make_case("history_AB_tie_211",c(7,7,6),c(0,0,0),c(1,2,0),c(2,1,1),c(0,0,0)),
 make_case("history_AC_tie_121",c(7,7,7),c(0,0,0),c(2,0,1),c(1,2,1),c(0,0,0)),
 make_case("history_BC_tie_112",c(7,7,7),c(0,0,0),c(0,1,2),c(1,1,2),c(0,0,0)),
 make_case("prior_cause1_A_tie_111",c(7,6,6),c(1,0,0),c(0,0,0),c(1,1,1),c(0,0,0)),
 make_case("mixed_history_tie_111",c(7,7,6),c(1,0,0),c(0,1,0),c(1,1,1),c(0,0,0)),
 make_case("tie_211_no_history",c(6,6,6),c(0,0,0),c(0,0,0),c(2,1,1),c(0,0,0))
)
for(dat in cases) {
 cat("CASE ",unique(dat$name),"\n",sep="")
 for(rho in c(-2,-1,-0.5,0,0.5,1,1.5,2,3,4)) {
  v <- score_stat(dat,rho)
  cat("rho=",sprintf("%.17g",rho)," z1=",sprintf("%.17g",v[["z1"]]),
      " z2=",sprintf("%.17g",v[["z2"]])," stat=",sprintf("%.17g",v[["stat"]]),"\n",sep="")
 }
}
