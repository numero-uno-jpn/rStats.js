# issue: 525
# Four cause-specific quadratic forms overdetermine a common 3-group inverse covariance matrix.
# The four causes have equal tied-event totals and the same total tied count in each group.
# Only public cmprsk::cuminc() Tests statistics are used.
run_case <- function(label,n,pre,cens,alloc) {
  tt <- ss <- gg <- numeric(0)
  for (r in 1:3) {
    tt <- c(tt,rep(1,pre[r]),rep(1,cens[r]),rep(2,sum(alloc[,r])),
            rep(3,n[r]-pre[r]-cens[r]-sum(alloc[,r])))
    ss <- c(ss,rep(5,pre[r]),rep(0,cens[r]),unlist(lapply(1:4,function(k) rep(k,alloc[k,r]))),
            rep(0,n[r]-pre[r]-cens[r]-sum(alloc[,r])))
    gg <- c(gg,rep(c("A","B","C")[r],n[r]))
  }
  dat <- data.frame(time=tt,status=ss,group=gg)
  Y <- n-pre-cens; S <- (n-pre)/n; h <- Y/S; p <- h/sum(h)
  Z <- t(apply(alloc,1,function(d) d-sum(d)*p))
  fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,rho=0)
  q <- vapply(1:4,function(k) unname(fit$Tests[as.character(k),"stat"]),0)
  X <- cbind(Z[,1]^2,2*Z[,1]*Z[,2],Z[,2]^2)
  coef <- as.vector(qr.solve(X,q))
  residual <- as.vector(X%*%coef-q)
  M <- matrix(c(coef[1],coef[2],coef[2],coef[3]),2,2)
  cat("CASE ",label," Y=",paste(Y,collapse=",")," S=",paste(sprintf("%.17g",S),collapse=","),
      " h=",paste(sprintf("%.17g",h),collapse=","),"\n",sep="")
  for(k in 1:4) cat("cause=",k," z=",paste(sprintf("%.17g",Z[k,]),collapse=","),
      " stat=",sprintf("%.17g",q[k])," fitted=",sprintf("%.17g",sum(X[k,]*coef)),
      " residual=",sprintf("%.17g",residual[k]),"\n",sep="")
  cat("inverse_covariance=",paste(sprintf("%.17g",coef),collapse=","),
      " det=",sprintf("%.17g",det(M))," max_residual=",sprintf("%.17g",max(abs(residual))),"\n",sep="")
}
a1 <- rbind(c(2,1,0),c(0,2,1),c(1,0,2),c(1,1,1))
a2 <- rbind(c(2,0,1),c(1,2,0),c(0,1,2),c(1,1,1))
a3 <- rbind(c(3,0,0),c(0,3,0),c(0,0,3),c(1,1,1))
run_case("unequal_risk_1",c(12,10,9),c(2,1,3),c(1,2,0),a1)
run_case("unequal_risk_2",c(11,12,10),c(1,3,2),c(2,1,1),a2)
run_case("unequal_risk_3",c(12,11,10),c(3,2,1),c(0,2,3),a1)
run_case("asymmetric_tie_4",c(13,12,11),c(2,3,1),c(2,1,2),a3)
