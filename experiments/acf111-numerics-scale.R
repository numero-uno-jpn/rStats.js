# issue: 560
# Public-output scale, offset and large-N probes for stats acf/pacf/ccf.
suppressPackageStartupMessages(library(jsonlite))
x <- c(2,-1,4,0,3,7,-2,5,1,6)
y <- c(1,3,-2,5,0,2,7,-1,4,6)
for (e in c(-1000,-500,500,1000)) {
  s <- 2^e
  a <- stats::acf(x*s, lag.max=6, plot=FALSE)
  v <- stats::acf(x*s, lag.max=6, type="covariance", plot=FALSE)
  z <- stats::ccf(x*s, y*s, lag.max=4, plot=FALSE)
  w <- stats::ccf(x*s, y*s, lag.max=4, type="covariance", plot=FALSE)
  cat("scale",e,"acf",paste(signif(as.vector(a$acf),8),collapse=","),"cov0",format(as.vector(v$acf)[1],digits=8),
      "ccf",paste(signif(as.vector(z$acf),8),collapse=","),"ccv0",format(as.vector(w$acf)[5],digits=8),"\n")
}
u <- sin(seq_len(257)*0.17)+(seq_len(257)%%11)/7
v <- cos(seq_len(257)*0.13)-(seq_len(257)%%7)/9
for (off in c(1e8,1e12)) {
  a <- stats::acf(u,lag.max=40,plot=FALSE)
  b <- stats::acf(u+off,lag.max=40,plot=FALSE)
  c <- stats::ccf(u,v,lag.max=40,plot=FALSE)
  d <- stats::ccf(u+off,v-off,lag.max=40,plot=FALSE)
  cat("offset",format(off),"acfMaxDiff",max(abs(a$acf-b$acf)),"ccfMaxDiff",max(abs(c$acf-d$acf)),"\n")
}
long <- sin(seq_len(100000)*0.01)+cos(seq_len(100000)*0.003)
print(system.time(stats::acf(long,lag.max=100,plot=FALSE)))
