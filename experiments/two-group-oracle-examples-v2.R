# issue: 525
# Reproduce oracle section 1.6 examples using untied prior cause-1 events followed by one tied time.
# Fit V=z^2/stat as c00 + 2*c01*x + c11*x^2, x=G0(t_tie-)^rho.
# The score z and L=G0^rho are computed independently from oracle section 1.5.
run_one <- function(label,nA,nB,priorA,tieA,tieB) {
  tTie <- priorA+1
  timeA <- c(seq_len(priorA),rep(tTie,tieA),rep(tTie+1,nA-priorA-tieA))
  statusA <- c(rep(1,priorA),rep(1,tieA),rep(0,nA-priorA-tieA))
  timeB <- c(rep(tTie,tieB),rep(tTie+1,nB-tieB))
  statusB <- c(rep(1,tieB),rep(0,nB-tieB))
  dat <- data.frame(time=c(timeA,timeB),status=c(statusA,statusB),
                    group=c(rep("A",nA),rep("B",nB)))
  times <- sort(unique(dat$time[dat$status!=0]))
  S <- c(1,1); F1 <- c(0,0); G0 <- 1
  z0 <- 0; xval <- G0
  tieY <- tieH <- tieS <- tieR <- NULL
  rho_values <- c(-2,-1,0,1,2,3)
  z_at <- function(rho) {
    S <- c(1,1); F1 <- c(0,0); G0 <- 1; z <- 0
    for (tt in times) {
      Y <- c(sum(dat$group=="A" & dat$time>=tt),sum(dat$group=="B" & dat$time>=tt))
      N1 <- c(sum(dat$group=="A" & dat$time==tt & dat$status==1),
              sum(dat$group=="B" & dat$time==tt & dat$status==1))
      h <- ifelse(Y>0,Y/S,0)
      R <- ifelse(Y>0,Y*(1-F1)/S,0)
      d1 <- sum(N1); H <- sum(h); RR <- sum(R)
      L <- G0^rho
      if (d1>0 && RR>0) z <- z + L*(N1-R*d1/RR)[1]
      dF0 <- if (H>0) d1/H else 0
      G0 <- G0-dF0
      F1 <- F1 + ifelse(Y>0,S*N1/Y,0)
      dAll <- N1
      S <- S*ifelse(Y>0,1-dAll/Y,1)
    }
    z
  }
  stats <- vapply(rho_values,function(rho) {
    fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
    unname(fit$Tests["1","stat"])
  },0)
  z <- vapply(rho_values,z_at,0)
  V <- z*z/stats
  Gtie <- 1-priorA/(nA+nB)
  x <- Gtie^rho_values
  X <- cbind(1,2*x,x*x)
  cf <- as.vector(qr.solve(X,V))
  residual <- as.vector(X%*%cf-V)
  Y <- c(nA-priorA,nB)
  Sminus <- c((nA-priorA)/nA,1)
  h <- Y/Sminus; p <- h/sum(h)
  w <- c(1-p[1],-p[2])*h[1]/h
  A <- sum(p*w*w)
  d <- tieA+tieB
  B <- (A-cf[3]/d)*(sum(Y)-1)/(d-1)
  cat("CASE ",label," Y=",paste(Y,collapse=",")," h=",paste(h,collapse=","),
      " Gtie=",sprintf("%.17g",Gtie)," tie=",tieA,",",tieB,"\n",sep="")
  for(i in seq_along(rho_values)) cat("rho=",rho_values[i]," x=",sprintf("%.17g",x[i]),
      " z=",sprintf("%.17g",z[i])," stat=",sprintf("%.17g",stats[i]),
      " V=",sprintf("%.17g",V[i]),"\n",sep="")
  cat("c00=",sprintf("%.17g",cf[1])," c01=",sprintf("%.17g",cf[2]),
      " c11=",sprintf("%.17g",cf[3])," fit_residual=",sprintf("%.17g",max(abs(residual))),
      " A=",sprintf("%.17g",A)," B=",sprintf("%.17g",B),
      " B/A=",sprintf("%.17g",B/A),"\n",sep="")
}
run_one("case_1",3,2,1,1,1)
run_one("case_2",4,2,1,1,1)
run_one("case_3",3,3,1,2,0)
run_one("case_4",5,2,3,1,1)
run_one("case_5",3,5,1,1,1)
