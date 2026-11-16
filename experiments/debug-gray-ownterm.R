# issue: 525
# Debug the hand calculation of the untied prior-time variance contribution in a two-time case.
nA <- 3; nB <- 2; tieA <- 1; tieB <- 1
time <- c(1,2,3,2,3); status <- c(1,1,0,1,0); group <- c("A","A","A","B","B")
dat <- data.frame(time=time,status=status,group=group)
rho <- 0
S <- c(1,1); F1 <- c(0,0); G0 <- 1
times <- sort(unique(dat$time[dat$status!=0]))
saved <- vector("list",length(times))
for (j in seq_along(times)) {
 tt <- times[j]
 Y <- c(sum(dat$group=="A" & dat$time>=tt),sum(dat$group=="B" & dat$time>=tt))
 N1 <- c(sum(dat$group=="A" & dat$time==tt & dat$status==1),sum(dat$group=="B" & dat$time==tt & dat$status==1))
 N2 <- c(sum(dat$group=="A" & dat$time==tt & dat$status>1),sum(dat$group=="B" & dat$time==tt & dat$status>1))
 Sminus <- S; h <- ifelse(Y>0,Y/Sminus,0); R <- ifelse(Y>0,Y*(1-F1)/Sminus,0)
 d1 <- sum(N1); H <- sum(h); RR <- sum(R); L <- G0^rho
 dF0 <- if(H>0)d1/H else 0; Gafter <- G0-dF0
 Safter <- Sminus*ifelse(Y>0,1-(N1+N2)/Y,1)
 q <- ifelse(Safter>0,Gafter/Safter,0)
 dF2 <- ifelse(Y>0,Sminus*N2/Y,0)
 dGamma <- if(G0>0)dF0/G0 else 0
 p <- if (H>0) h/H else c(0,0)
 dvec <- L*h[1]*(c(1,0)-p)
 saved[[j]] <- list(h=h,H=H,frac=h/H,base=c(1,0)-p,dvec=dvec,dF0=dF0,dF2=dF2,q=q,dGamma=dGamma,Y=Y,Sminus=Sminus,Safter=Safter,N1=N1,N2=N2,Gbefore=G0,Gafter=Gafter)
 F1 <- F1+ifelse(Y>0,Sminus*N1/Y,0); S <- Safter; G0 <- Gafter
}
for(j in seq_along(saved)) cat("TIME ",times[j]," ",paste(capture.output(str(saved[[j]])),collapse=" "), "\n")
future <- c(0,0); cur <- saved[[2]]; future <- future+cur$dvec*cur$dGamma
cur <- saved[[1]]; rest <- future; a <- cur$dvec+(1-cur$q)*rest; b <- -cur$q*rest
cat("rest=",paste(rest,collapse=",")," a=",paste(a,collapse=",")," b=",paste(b,collapse=","),"\n")
cat("Vprior=",sum((a^2*cur$dF0+b^2*cur$dF2)/cur$h),"\n")
