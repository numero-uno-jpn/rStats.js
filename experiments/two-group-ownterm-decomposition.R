# issue: 525
# Decompose the two-group Gray variance into known earlier-time terms and the tied-time own term.
# For each rho, compute z and the prior-time variance from oracle section 1.5; subtract those
# from V=z^2/stat. The remainder divided by L(t_tie)^2 is the tied-time own coefficient.
# All oracle values come only from public cmprsk::cuminc() Tests statistics.
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
  one_rho <- function(rho) {
    fit <- cmprsk::cuminc(dat$time,dat$status,dat$group,rho=rho)
    stat <- unname(fit$Tests["1","stat"])
    S <- c(1,1); F1 <- c(0,0); G0 <- 1; z <- 0
    times <- sort(unique(dat$time[dat$status!=0]))
    saved <- vector("list",length(times))
    for (j in seq_along(times)) {
      tt <- times[j]
      Y <- c(sum(dat$group=="A" & dat$time>=tt),sum(dat$group=="B" & dat$time>=tt))
      N1 <- c(sum(dat$group=="A" & dat$time==tt & dat$status==1),
              sum(dat$group=="B" & dat$time==tt & dat$status==1))
      N2 <- c(sum(dat$group=="A" & dat$time==tt & dat$status>1),
              sum(dat$group=="B" & dat$time==tt & dat$status>1))
      Sminus <- S
      h <- ifelse(Y>0,Y/Sminus,0)
      R <- ifelse(Y>0,Y*(1-F1)/Sminus,0)
      d1 <- sum(N1); H <- sum(h); RR <- sum(R); L <- G0^rho
      if (d1>0 && RR>0) z <- z+L*(N1-R*d1/RR)[1]
      dF0 <- if (H>0) d1/H else 0
      Gafter <- G0-dF0
      Safter <- Sminus*ifelse(Y>0,1-(N1+N2)/Y,1)
      q <- ifelse(Safter>0,Gafter/Safter,0)
      dF2 <- ifelse(Y>0,Sminus*N2/Y,0)
      dGamma <- if (G0>0) dF0/G0 else 0
      p <- if (H>0) h/H else c(0,0)
      dvec <- L*h[1]*(c(1,0)-p)
      saved[[j]] <- list(h=h,dvec=dvec,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,
                         Y=Y,L=L,Gbefore=G0)
      F1 <- F1+ifelse(Y>0,Sminus*N1/Y,0)
      S <- Safter
      G0 <- Gafter
    }
    m <- length(saved); future <- c(0,0); Vprior <- 0
    if (m>1) {
      for (j in m:1) {
        cur <- saved[[j]]
        if (j<m) {
          rest <- future
          a <- cur$dvec+(1-cur$q)*rest
          b <- -cur$q*rest
          ok <- cur$h>0
          Vprior <- Vprior+sum((a[ok]^2*cur$dF0+b[ok]^2*cur$dF2[ok])/cur$h[ok])
        }
        future <- future+cur$dvec*cur$dGamma
      }
    }
    last <- saved[[m]]
    V <- z*z/stat
    own <- (V-Vprior)/(last$L^2)
    h <- last$h; H <- sum(h); p <- h/H
    w <- last$dvec/(last$L*h)
    A <- sum(p*w*w)
    d <- tieA+tieB; Ytot <- sum(last$Y)
    B <- (A-own/d)*(Ytot-1)/(d-1)
    c(z=z,stat=stat,V=V,Vprior=Vprior,L=last$L,own=own,A=A,B=B,BoverA=B/A)
  }
  mat <- sapply(rho_values,one_rho)
  cat(label," n=",nA,",",nB," priorA=",priorA," Y=",nA-priorA,",",nB,
      " tie=",tieA,",",tieB," d=",tieA+tieB,"\n",sep="")
  cat("  own range=",sprintf("%.17g",diff(range(mat["own",]))),
      " B/A range=",sprintf("%.17g",diff(range(mat["BoverA",]))),
      " B/A mean=",sprintf("%.17g",mean(mat["BoverA",])),"\n",sep="")
  cat("  rho own B/A Vprior V\n")
  for(i in seq_along(rho_values)) cat(rho_values[i]," ",
      sprintf("%.12g",mat["own",i])," ",sprintf("%.12g",mat["BoverA",i])," ",
      sprintf("%.12g",mat["Vprior",i])," ",sprintf("%.12g",mat["V",i]),"\n",sep="")
}
cases <- list(
 c("o01",3,2,1,1,1), c("o02",4,2,1,1,1), c("o03",3,3,1,2,0), c("o04",5,2,3,1,1),
 c("o05",3,5,1,1,1), c("o06",6,4,2,1,1), c("o07",4,6,1,1,2), c("o08",7,5,2,2,1),
 c("o09",5,7,2,1,2), c("o10",8,5,3,2,1), c("o11",5,8,1,1,3), c("o12",8,6,2,2,2),
 c("o13",6,8,3,1,2), c("o14",9,6,2,3,2), c("o15",6,9,1,2,3), c("o16",10,7,3,3,2),
 c("o17",7,10,2,2,3), c("o18",9,9,4,2,2), c("o19",11,8,3,4,2), c("o20",8,11,2,3,4)
)
for(x in cases) do.call(run_one,as.list(x))
