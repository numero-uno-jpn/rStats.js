# issue: 525
# Reproduce the five two-group tied-time configurations listed in oracle section 1.6.
# Only the public cmprsk::cuminc() Tests statistic is used.
run_one <- function(label,nA,nB,c2A,c2B,censA,censB,tieA,tieB) {
  time <- c(rep(1,c2A),rep(1,censA),rep(2,tieA),rep(3,nA-c2A-censA-tieA),
            rep(1,c2B),rep(1,censB),rep(2,tieB),rep(3,nB-c2B-censB-tieB))
  status <- c(rep(2,c2A),rep(0,censA),rep(1,tieA),rep(0,nA-c2A-censA-tieA),
              rep(2,c2B),rep(0,censB),rep(1,tieB),rep(0,nB-c2B-censB-tieB))
  group <- c(rep("A",nA),rep("B",nB))
  Y <- c(nA-c2A-censA,nB-c2B-censB)
  S <- c((nA-c2A)/nA,(nB-c2B)/nB)
  h <- Y/S; d <- tieA+tieB; p <- h/sum(h)
  z <- tieA-p[1]*d
  fit <- cmprsk::cuminc(time,status,group,rho=0)
  stat <- unname(fit$Tests["1","stat"])
  V <- z*z/stat
  w <- c(1-p[1],-p[2])*h[1]/h
  A <- sum(p*w*w)
  B <- (A-V/d)*(sum(Y)-1)/(d-1)
  cat(label," Y=",paste(Y,collapse=",")," h=",paste(h,collapse=",")," S=",paste(S,collapse=","),
      " tie=",tieA,",",tieB," z=",sprintf("%.17g",z)," stat=",sprintf("%.17g",stat),
      " A=",sprintf("%.17g",A)," B=",sprintf("%.17g",B)," B/A=",sprintf("%.17g",B/A),"\n",sep="")
}
run_one("case_1",3,2,1,0,0,0,1,1)
run_one("case_2",4,2,1,0,0,0,1,1)
run_one("case_3",3,3,1,0,0,0,2,0)
run_one("case_4",5,2,3,0,0,0,1,1)
run_one("case_5",3,5,1,0,0,0,1,1)
