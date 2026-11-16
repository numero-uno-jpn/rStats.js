# issue: 525
# Twenty controlled two-group tied-time configurations to isolate the tied-time own variance term.
# Only the public cmprsk::cuminc() result Tests[,"stat"] is used as the oracle.
make_case <- function(nA,nB,c2A,c2B,censA,censB,tieA,tieB) {
  stopifnot(c2A+censA+tieA<=nA,c2B+censB+tieB<=nB)
  time <- c(rep(1,c2A),rep(1,censA),rep(2,tieA),rep(3,nA-c2A-censA-tieA),
            rep(1,c2B),rep(1,censB),rep(2,tieB),rep(3,nB-c2B-censB-tieB))
  status <- c(rep(2,c2A),rep(0,censA),rep(1,tieA),rep(0,nA-c2A-censA-tieA),
              rep(2,c2B),rep(0,censB),rep(1,tieB),rep(0,nB-c2B-censB-tieB))
  group <- c(rep("A",nA),rep("B",nB))
  data.frame(time=time,status=status,group=group)
}
one <- function(label,nA,nB,c2A,c2B,censA,censB,tieA,tieB) {
  dat <- make_case(nA,nB,c2A,c2B,censA,censB,tieA,tieB)
  Y <- c(nA-c2A-censA,nB-c2B-censB)
  S <- c((nA-c2A)/nA,(nB-c2B)/nB)
  h <- Y/S
  d <- tieA+tieB
  p <- h/sum(h)
  z <- tieA-p[1]*d
  fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,rho=0)
  stat <- unname(fit$Tests["1","stat"])
  V <- z*z/stat
  w <- c((1-p[1]),-p[2])*h[1]/h
  A <- sum(p*w*w)
  B <- (A-V/d)*(sum(Y)-1)/(d-1)
  bY <- sum((Y/sum(Y))*w*w)
  bH2 <- sum((Y/S^2)*w*w)/sum(Y/S^2)
  bH <- sum((Y/S)*w*w)/sum(Y/S)
  cat(label," n=",nA,",",nB," Y=",paste(Y,collapse=",")," S=",paste(sprintf("%.8g",S),collapse=","),
      " h=",paste(sprintf("%.8g",h),collapse=",")," d=",d,
      " z=",sprintf("%.17g",z)," stat=",sprintf("%.17g",stat)," V=",sprintf("%.17g",V),
      " A=",sprintf("%.17g",A)," B=",sprintf("%.17g",B)," B/A=",sprintf("%.17g",B/A),
      " BY/A=",sprintf("%.8g",bY/A)," BH2/A=",sprintf("%.8g",bH2/A)," BH/A=",sprintf("%.8g",bH/A),"\n",sep="")
}
cases <- list(
 c("e01",5,5,0,0,0,0,1,1), c("e02",5,5,1,0,0,0,1,1),
 c("e03",5,5,0,1,0,0,1,1), c("e04",5,5,1,1,0,0,1,1),
 c("e05",6,4,1,0,1,0,1,1), c("e06",4,6,0,1,0,1,1,1),
 c("e07",6,4,2,0,0,1,1,1), c("e08",4,6,0,2,1,0,1,1),
 c("e09",7,5,1,2,1,0,1,1), c("e10",5,7,2,1,0,1,1,1),
 c("e11",8,5,2,0,2,1,2,1), c("e12",5,8,0,2,1,2,1,2),
 c("e13",8,6,1,2,1,1,2,1), c("e14",6,8,2,1,1,1,1,2),
 c("e15",9,6,2,1,2,1,2,2), c("e16",6,9,1,2,1,2,2,2),
 c("e17",10,7,3,1,2,1,3,2), c("e18",7,10,1,3,1,2,2,3),
 c("e19",9,9,2,2,2,2,3,3), c("e20",12,8,3,1,3,2,4,3)
)
for (x in cases) do.call(one,as.list(x))
