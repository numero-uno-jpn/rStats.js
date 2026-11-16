# issue: 525
# Twenty two-group configurations: untied cause-1 history followed by a tied cause-1 time.
# For each, fit V=z^2/stat as a quadratic in x=G0(t_tie-)^rho and isolate the tied-time
# own coefficient c11. z is independently calculated from oracle section 1.5.
run_one <- function(label,nA,nB,priorA,tieA,tieB) {
  nA <- as.integer(nA); nB <- as.integer(nB); priorA <- as.integer(priorA)
  tieA <- as.integer(tieA); tieB <- as.integer(tieB)
  tTie <- priorA+1
  timeA <- c(seq_len(priorA),rep(tTie,tieA),rep(tTie+1,nA-priorA-tieA))
  statusA <- c(rep(1,priorA+tieA),rep(0,nA-priorA-tieA))
  timeB <- c(rep(tTie,tieB),rep(tTie+1,nB-tieB))
  statusB <- c(rep(1,tieB),rep(0,nB-tieB))
  dat <- data.frame(time=c(timeA,timeB),status=c(statusA,statusB),
                    group=c(rep("A",nA),rep("B",nB)))
  rho_values <- c(-2,-1,0,1,2,3)
  z_at <- function(rho) {
    S <- c(1,1); F1 <- c(0,0); G0 <- 1; z <- 0
    times <- sort(unique(dat$time[dat$status!=0]))
    for (tt in times) {
      Y <- c(sum(dat$group=="A" & dat$time>=tt),sum(dat$group=="B" & dat$time>=tt))
      N1 <- c(sum(dat$group=="A" & dat$time==tt & dat$status==1),
              sum(dat$group=="B" & dat$time==tt & dat$status==1))
      h <- ifelse(Y>0,Y/S,0); R <- ifelse(Y>0,Y*(1-F1)/S,0)
      d1 <- sum(N1); H <- sum(h); RR <- sum(R); L <- G0^rho
      if (d1>0 && RR>0) z <- z + L*(N1-R*d1/RR)[1]
      dF0 <- if (H>0) d1/H else 0
      G0 <- G0-dF0
      F1 <- F1+ifelse(Y>0,S*N1/Y,0)
      S <- S*ifelse(Y>0,1-N1/Y,1)
    }
    z
  }
  stats <- vapply(rho_values,function(rho) {
    fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
    unname(fit$Tests["1","stat"])
  },0)
  z <- vapply(rho_values,z_at,0); V <- z*z/stats
  Gtie <- 1-priorA/(nA+nB); x <- Gtie^rho_values
  X <- cbind(1,2*x,x*x); cf <- as.vector(qr.solve(X,V))
  residual <- as.vector(X%*%cf-V)
  Y <- c(nA-priorA,nB); Sminus <- c((nA-priorA)/nA,1)
  h <- Y/Sminus; p <- h/sum(h)
  w <- c(1-p[1],-p[2])*h[1]/h; A <- sum(p*w*w)
  d <- tieA+tieB
  B <- (A-cf[3]/d)*(sum(Y)-1)/(d-1)
  cat(label," n=",nA,",",nB," priorA=",priorA," Y=",paste(Y,collapse=","),
      " S=",paste(sprintf("%.8g",Sminus),collapse=",")," tie=",tieA,",",tieB,
      " Gtie=",sprintf("%.12g",Gtie)," z0=",sprintf("%.12g",z[3]-x[3]*(tieA-Y[1]*d/sum(Y))),
      " zTie=",sprintf("%.12g",tieA-Y[1]*d/sum(Y)),
      " c00=",sprintf("%.17g",cf[1])," c01=",sprintf("%.17g",cf[2]),
      " c11=",sprintf("%.17g",cf[3])," resid=",sprintf("%.8g",max(abs(residual))),
      " A=",sprintf("%.17g",A)," B=",sprintf("%.17g",B)," B/A=",sprintf("%.17g",B/A),"\n",sep="")
}
cases <- list(
 c("g01",3,2,1,1,1), c("g02",4,2,1,1,1), c("g03",3,3,1,2,0), c("g04",5,2,3,1,1),
 c("g05",3,5,1,1,1), c("g06",6,4,2,1,1), c("g07",4,6,1,1,2), c("g08",7,5,2,2,1),
 c("g09",5,7,2,1,2), c("g10",8,5,3,2,1), c("g11",5,8,1,1,3), c("g12",8,6,2,2,2),
 c("g13",6,8,3,1,2), c("g14",9,6,2,3,2), c("g15",6,9,1,2,3), c("g16",10,7,3,3,2),
 c("g17",7,10,2,2,3), c("g18",9,9,4,2,2), c("g19",11,8,3,4,2), c("g20",8,11,2,3,4)
)
for(x in cases) do.call(run_one,as.list(x))
