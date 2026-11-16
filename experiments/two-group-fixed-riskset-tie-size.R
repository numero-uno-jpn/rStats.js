# issue: 525
# Hold the pooled and group-specific risk sets fixed while varying the number of tied cause-1 events.
# The only cmprsk oracle field used is the documented Tests statistic from public cuminc().
one <- function(label,tieA,tieB) {
  nA <- 8; nB <- 7; c2A <- 2; c2B <- 1; censA <- 1; censB <- 2
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
  cat(label," Y=",paste(Y,collapse=",")," S=",paste(sprintf("%.17g",S),collapse=","),
      " h=",paste(sprintf("%.17g",h),collapse=",")," d=",d,
      " z=",sprintf("%.17g",z)," stat=",sprintf("%.17g",stat),
      " V=",sprintf("%.17g",V)," A=",sprintf("%.17g",A),
      " B=",sprintf("%.17g",B)," B/A=",sprintf("%.17g",B/A),"\n",sep="")
}
one("d2",1,1)
one("d3",2,1)
one("d4",2,2)
one("d5",3,2)
