# issue: 549
# Grubbs independent calculations. Public R calls only; no package implementation inspected.
library(outliers); library(jsonlite)
sample_sets <- list(
 x1=c(199.31,199.53,200.19,200.82,201.92,201.95,202.18,245.57),
 x2=c(-3.1,0.2,0.4,0.5,0.7,0.9,1.1,1.2,1.3,4.8),
 x3=c(8.1,8.3,8.4,8.6,8.8,9.0,9.1,12.4,12.9))
calc_one <- function(v, typ, low=FALSE, both=FALSE) {
 nobs <- length(v); mu <- mean(v); sdv <- sd(v); vv <- sort(v)
 if (typ==10) {
   chosen <- if(low) min(v) else max(v)
   gstat <- abs(chosen-mu)/sdv
   rest <- v[v!=chosen]
   uvar <- (nobs-2)*var(rest)/((nobs-1)*var(v))
   cdf <- pgrubbs(gstat,nobs,type=10)
 } else if (typ==11) {
   gstat <- (max(v)-min(v))/sdv
   rest <- vv[-c(1,nobs)]
   uvar <- (nobs-3)*var(rest)/((nobs-1)*var(v))
   cdf <- pgrubbs(gstat,nobs,type=11)
 } else {
   chosen <- if(low) vv[1:2] else vv[(nobs-1):nobs]
   rest <- if(low) vv[-c(1,2)] else vv[-c(nobs-1,nobs)]
   uvar <- (nobs-3)*var(rest)/((nobs-1)*var(v))
   gstat <- NA_real_
   cdf <- pgrubbs(uvar,nobs,type=20)
 }
 pv <- if(both) 2*min(cdf,1-cdf) else 1-cdf
 if(typ==20) pv <- if(both) 2*min(cdf,1-cdf) else cdf
 list(G=gstat,U=uvar,cdf=cdf,p=pv)
}
all_rows <- list()
for (nm in names(sample_sets)) for (typ in c(10,11,20)) for (low in c(FALSE,TRUE)) for (both in c(FALSE,TRUE)) {
 v <- sample_sets[[nm]]
 rr <- calc_one(v,typ,low,both)
 ref <- grubbs.test(v,type=typ,opposite=low,two.sided=both)
 all_rows[[paste(nm,typ,low,both,sep="_")]] <- list(calc=rr,reference=list(statistic=ref$statistic,p=ref$p.value,alternative=ref$alternative))
}
## Type 10: Pearson-Sekar t transform, evaluated independently at the full q grid.
t10 <- list()
for(nobs in c(3,4,5,7,10,20,30,50)) {
 qs <- c(.5,1,1.5,2,2.5,3,3.5)
 vals <- lapply(qs,function(q) {
   den <- (nobs-1)^2-nobs*q^2
   tv <- if(den>0) q*sqrt(nobs*(nobs-2)/den) else Inf
   cdf <- if(is.finite(tv)) max(0,min(1,1-nobs*pt(-tv,df=nobs-2))) else 1
   c(calc=cdf, reference=pgrubbs(q,nobs,type=10))
 })
 t10[[as.character(nobs)]] <- list(values=vals,max_abs_error=max(abs(vapply(vals,function(z) z[1]-z[2],numeric(1))),na.rm=TRUE))
}
## Type 11: public probability values at every requested grid point, including known uniroot failure.
t11 <- list()
for(nobs in c(3,4,5,7,10,20,30,50)) {
 qs <- c(2,2.5,3,3.5,4,4.5,5)
 t11[[as.character(nobs)]] <- lapply(qs,function(q) {
  z <- tryCatch(pgrubbs(q,nobs,type=11),error=function(e) conditionMessage(e))
  list(q=q,reference=z)
 })
}
## Type 20: create probability table exclusively from public qgrubbs output and test linear interpolation on U.
t20 <- list()
for(nobs in c(4,6,8,9,11,15,16,25,29)) {
 pp <- c(.001,.01,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,.95,.99,.999)
 tabq <- vapply(pp,function(p) tryCatch(qgrubbs(p,nobs,type=20),error=function(e) NA_real_),numeric(1))
 qq <- seq(.02,.98,by=.04)
 direct <- vapply(qq,function(q) pgrubbs(q,nobs,type=20),numeric(1))
 reverse <- vapply(qq,function(q) qgrubbs(q,nobs,type=20,rev=TRUE),numeric(1))
 ok <- is.finite(tabq) & tabq>0
 xx <- c(0,tabq[ok]); yy <- c(0,pp[ok])
 ord <- order(xx); xx <- xx[ord]; yy <- yy[ord]
 keep <- !duplicated(xx,fromLast=TRUE); xx <- xx[keep]; yy <- yy[keep]
 interp <- approx(x=xx,y=yy,xout=qq,rule=2)$y
 back <- vapply(direct,function(p) tryCatch(qgrubbs(p,nobs,type=20),error=function(e) NA_real_),numeric(1))
 ugrid <- seq(0,1,by=.001)
 cdf_tab <- vapply(ugrid,function(u) tryCatch(qgrubbs(u,nobs,type=20,rev=TRUE),error=function(e) NA_real_),numeric(1))
 good <- is.finite(cdf_tab)
 testU <- seq(.017,.983,by=.037)
 test_direct <- vapply(testU,function(u) pgrubbs(u,nobs,type=20),numeric(1))
 test_reverse <- vapply(testU,function(u) qgrubbs(u,nobs,type=20,rev=TRUE),numeric(1))
 interp_rev <- approx(ugrid[good],cdf_tab[good],xout=testU,rule=2)$y
 interp_sqrt <- approx(sqrt(ugrid[good]),cdf_tab[good],xout=sqrt(testU),rule=2)$y
 pos_u <- good & ugrid>0
 interp_log <- approx(log(ugrid[pos_u]),cdf_tab[pos_u],xout=log(testU),rule=2)$y
 eps <- 1e-12
 tab_logit <- qlogis(pmin(1-eps,pmax(eps,cdf_tab[good])))
 interp_logit <- plogis(approx(ugrid[good],tab_logit,xout=testU,rule=2)$y)
 log_ok <- xx>0
 log_interp <- approx(x=log(xx[log_ok]),y=yy[log_ok],xout=log(qq),rule=2)$y
 sample_ix <- match(c(.001,.01,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,.95,.99,.999),pp)
 t20[[as.character(nobs)]] <- list(p_sample=pp[sample_ix],q_sample=tabq[sample_ix],grid=qq,direct=direct,
  linear_on_U=interp,max_abs_error=max(abs(direct-interp),na.rm=TRUE),
  logU_error=max(abs(direct-log_interp),na.rm=TRUE),reverse_qgrubbs_max_abs=max(abs(direct-reverse),na.rm=TRUE),
  reverse_test_max_abs=max(abs(test_direct-test_reverse),na.rm=TRUE),
  reverse_table_linear_U_max_abs=max(abs(test_direct-interp_rev),na.rm=TRUE),
  reverse_table_sqrtU_max_abs=max(abs(test_direct-interp_sqrt),na.rm=TRUE),
  reverse_table_logU_max_abs=max(abs(test_direct-interp_log),na.rm=TRUE),
  reverse_table_logitP_max_abs=max(abs(test_direct-interp_logit),na.rm=TRUE),testU=testU,
  test_direct=test_direct,roundtrip_q=back,roundtrip_max_abs=max(abs(back-qq),na.rm=TRUE))
}
cat(toJSON(list(grubbs=all_rows,type10=t10,type11=t11,type20=t20),
            digits=NA,auto_unbox=TRUE,na="string"))
