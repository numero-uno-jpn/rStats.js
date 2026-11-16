# issue: 525
# Recover a candidate 3-group covariance matrix from three cause-specific quadratic forms.
# For each case, three causes have cyclic tied allocations with equal total and equal per-group
# all-cause tie counts. Only public cuminc() Tests statistics are read from cmprsk.
run_case <- function(label,n,pre,cens,alloc) {
  tt <- ss <- gg <- numeric(0)
  for (r in 1:3) {
    tt <- c(tt,rep(1,pre[r]),rep(1,cens[r]),rep(2,sum(alloc[,r])),
            rep(3,n[r]-pre[r]-cens[r]-sum(alloc[,r])))
    ss <- c(ss,rep(4,pre[r]),rep(0,cens[r]),unlist(lapply(1:3,function(k) rep(k,alloc[k,r]))),
            rep(0,n[r]-pre[r]-cens[r]-sum(alloc[,r])))
    gg <- c(gg,rep(c("A","B","C")[r],n[r]))
  }
  dat <- data.frame(time=tt,status=ss,group=gg)
  Y <- n-pre-cens
  S <- (n-pre)/n
  h <- Y/S; p <- h/sum(h)
  Z <- t(apply(alloc,1,function(d) d-sum(d)*p))
  fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,rho=0)
  q <- vapply(1:3,function(k) unname(fit$Tests[as.character(k),"stat"]),0)
  X <- cbind(Z[,1]^2,2*Z[,1]*Z[,2],Z[,2]^2)
  coef <- as.vector(solve(X,q))
  residual <- as.vector(X%*%coef-q)
  M <- matrix(c(coef[1],coef[2],coef[2],coef[3]),2,2)
  cat("CASE ",label," Y=",paste(Y,collapse=",")," S=",paste(sprintf("%.17g",S),collapse=","),
      " h=",paste(sprintf("%.17g",h),collapse=","),"\n",sep="")
  for(k in 1:3) cat("cause=",k," z=",paste(sprintf("%.17g",Z[k,]),collapse=","),
      " stat=",sprintf("%.17g",q[k]),"\n",sep="")
  cat("inverse_covariance=",paste(sprintf("%.17g",coef),collapse=","),
      " det=",sprintf("%.17g",det(M))," max_residual=",sprintf("%.17g",max(abs(residual))),"\n",sep="")
}
a1 <- rbind(c(2,1,0),c(0,2,1),c(1,0,2))
a2 <- rbind(c(2,0,1),c(1,2,0),c(0,1,2))
a3 <- rbind(c(3,0,0),c(0,3,0),c(0,0,3))
run_case("unequal_risk_cyclic_1",c(10,8,7),c(2,1,3),c(1,2,0),a1)
run_case("unequal_risk_cyclic_2",c(11,9,8),c(1,3,2),c(2,1,1),a2)
run_case("unequal_risk_cyclic_3",c(9,11,8),c(3,2,1),c(0,2,3),a1)
run_case("equal_risk_diagonal",c(10,10,10),c(2,2,2),c(1,1,1),a3)
