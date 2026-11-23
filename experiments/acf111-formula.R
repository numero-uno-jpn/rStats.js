# issue: 560
# Independent formula checks for stats::acf, pacf and ccf; public functions only.
library(jsonlite)
x <- as.numeric(stats::lh)
n <- length(x); z <- x - mean(x)
g <- sapply(0:5, function(k) sum(z[seq_len(n-k)] * z[(k+1):n]) / n)
r <- g / g[1]
# Durbin-Levinson recursion on the directly calculated biased ACF.
phi <- matrix(0, 5, 5)
for (k in 1:5) {
  if (k == 1) phi[k,k] <- r[k+1]
  else {
    prev <- phi[k-1,1:(k-1)]
    phi[k,k] <- (r[k+1] - sum(prev * r[k:2])) / (1 - sum(prev * r[2:k]))
    for (j in 1:(k-1)) phi[k,j] <- prev[j] - phi[k,k] * prev[k-j]
  }
}
pac <- diag(phi)
fit <- stats::acf(stats::lh, lag.max=5, plot=FALSE)
pacfit <- stats::pacf(stats::lh, lag.max=5, plot=FALSE)
xna <- as.numeric(stats::presidents); nmiss <- length(xna); mean_na <- mean(xna,na.rm=TRUE)
zna <- xna-mean_na
gna <- sapply(0:5,function(k) { a <- zna[seq_len(nmiss-k)]; b <- zna[(k+1):nmiss]; sum(a*b,na.rm=TRUE)/nmiss })
rna <- gna/gna[1]
na_public <- as.numeric(stats::acf(stats::presidents,na.action=stats::na.pass,plot=FALSE)$acf[1:6,1,1])
x10 <- c(3,1,4,1,5,9,2,6,5,3); y10 <- c(2,7,1,8,2,8,1,8,2,8)
cc <- stats::ccf(x10,y10,lag.max=3,plot=FALSE)
cc_direct <- sapply(-3:3, function(k) {
  ix <- seq_len(10)
  iy <- ix + k
  ok <- iy >= 1 & iy <= 10
  sum((x10[iy[ok]]-mean(x10))*(y10[ix[ok]]-mean(y10))) / 10 /
    sqrt(sum((x10-mean(x10))^2)/10 * sum((y10-mean(y10))^2)/10)
})
out <- list(
  acf_lh_gamma0=g[1], acf_lh_gamma1=g[2], acf_lh_rho1=r[2],
  acf_lh_public=as.numeric(fit$acf[1:6,1,1]),
  acf_lh_direct=r,
  pacf_lh_public=as.numeric(pacfit$acf[1:5,1,1]),
  pacf_lh_durbin_levinson=pac,
  ccf_small_public=as.numeric(cc$acf[,1,1]),
  ccf_small_direct=cc_direct,
  ccf_small_lags=as.numeric(cc$lag[,1,1]),
  presidents_na_pass=na_public, presidents_na_pass_direct=rna
)
cat(as.character(toJSON(out,digits=I(17),auto_unbox=TRUE,null="null")))
