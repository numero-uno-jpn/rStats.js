# issue: 560
# Independent missing-pair covariance checks for acf, pacf and ccf.
library(jsonlite)
x <- as.numeric(presidents); n <- length(x)
mu <- mean(x, na.rm=TRUE); z <- x-mu
cov_lag <- function(a,b,k) {
  ok <- !is.na(a) & !is.na(b)
  c(sum=a[ok] |> sum(), pairs=sum(ok), divisor=sum(ok)+k,
    covariance=sum(a[ok]*b[ok])/(sum(ok)+k))
}
ac <- lapply(0:10,function(k) cov_lag(z[seq_len(n-k)],z[(k+1):n],k))
g <- vapply(ac,function(a) a[["covariance"]],numeric(1))
rho <- g/g[1]
dl <- function(r) {
  m <- length(r)-1L; phi <- matrix(0,m,m)
  for(k in seq_len(m)) {
    if(k==1) phi[k,k] <- r[k+1]
    else {
      prev <- phi[k-1,seq_len(k-1)]
      phi[k,k] <- (r[k+1]-sum(prev*r[k:2]))/(1-sum(prev*r[2:k]))
      for(j in seq_len(k-1)) phi[k,j] <- prev[j]-phi[k,k]*prev[k-j]
    }
  }
  diag(phi)
}
ap <- stats::acf(presidents,na.action=stats::na.pass,plot=FALSE,lag.max=10)
pp <- stats::pacf(presidents,na.action=stats::na.pass,plot=FALSE,lag.max=10)
# Cross-correlation with deliberately staggered missing pairs; means omit NA independently.
xx <- c(3,1,NA,1,5,9,2,6,5,3,NA,4)
yy <- c(2,7,1,8,2,NA,1,8,2,8,4,NA)
mx <- mean(xx,na.rm=TRUE); my <- mean(yy,na.rm=TRUE)
zx <- xx-mx; zy <- yy-my; nn <- length(xx)
cc <- lapply(-5:5,function(k) {
  ti <- seq_len(nn); xi <- ti+k
  ok <- xi>=1 & xi<=nn
  t <- ti[ok]; i <- xi[ok]
  good <- !is.na(zx[i]) & !is.na(zy[t])
  c(pairs=sum(good), divisor=sum(good)+abs(k),
    numerator=sum(zx[i[good]]*zy[t[good]]))
})
gx0 <- sum(zx[!is.na(zx)]^2)/sum(!is.na(zx))
gy0 <- sum(zy[!is.na(zy)]^2)/sum(!is.na(zy))
ccov <- vapply(cc,function(a) a[["numerator"]]/a[["divisor"]],numeric(1))
ccor <- ccov/sqrt(gx0*gy0)
rc <- stats::ccf(xx,yy,na.action=stats::na.pass,plot=FALSE,lag.max=5)
out <- list(
 presidents_mean=mu, lag_counts=vapply(ac,function(a)a[["pairs"]],numeric(1)),
 lag_divisors=vapply(ac,function(a)a[["divisor"]],numeric(1)),
 acf_public=as.numeric(ap$acf[,1,1]), acf_direct=rho,
 pacf_public=as.numeric(pp$acf[,1,1]), pacf_dl=dl(rho),
 ccf_lags=as.numeric(rc$lag[,1,1]), ccf_public=as.numeric(rc$acf[,1,1]),
 ccf_pairs=vapply(cc,function(a)a[["pairs"]],numeric(1)),
 ccf_divisors=vapply(cc,function(a)a[["divisor"]],numeric(1)),
 ccf_direct=ccor
)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE)))
