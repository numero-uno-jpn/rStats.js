# issue: 549
# Independent T2/T2' and Page formulas, compared with public R outputs.
library(PMCMRplus); library(jsonlite)
mdiff <- function(a,b) {
 if(length(a)!=length(b)) return(Inf)
 if(!length(a)) return(0)
 max(abs(as.numeric(a)-as.numeric(b)),na.rm=TRUE)
}
pair_calc <- function(d,welch=TRUE) {
 nm <- names(d); k <- length(d); m <- k*(k-1)/2
 rows <- list()
 for(i in seq_len(k-1)) for(j in (i+1):k) {
  a<-d[[i]]; b<-d[[j]]; na<-length(a); nb<-length(b)
  va<-var(a)/na; vb<-var(b)/nb
  tv<-(mean(b)-mean(a))/sqrt(va+vb)
  df<-if(welch) (va+vb)^2/(va^2/(na-1)+vb^2/(nb-1)) else na+nb-2
  p0<-2*pt(-abs(tv),df=df); pa<-1-(1-p0)^m
  rows[[paste(nm[j],nm[i],sep="|")]]<-c(t=tv,df=df,p0=p0,p=pa)
 }
 rows
}
compare_pw <- function(d,welch=TRUE) {
 ref <- tamhaneT2Test(unlist(d),factor(rep(names(d),lengths(d)),levels=names(d)),welch=welch)
 calc <- pair_calc(d,welch)
 got <- unlist(lapply(seq_along(calc),function(i) calc[[i]][c("t","p")]))
 obs <- c(); for(i in seq_len(length(d)-1)) for(j in (i+1):length(d)) {
  obs<-c(obs,ref$statistic[j,i],ref$p.value[j,i])
 }
 list(max_abs=mdiff(got,obs),pairs=calc,method=ref$method)
}
dsets <- list(PlantGrowth=split(PlantGrowth$weight,PlantGrowth$group),
 InsectSprays=split(InsectSprays$count,InsectSprays$spray),
 chickwts=split(chickwts$weight,chickwts$feed))
t2_res <- list()
for(nm in names(dsets)) for(w in c(TRUE,FALSE)) {
 key<-paste(nm,if(w)"T2" else "T2prime",sep="_")
 t2_res[[key]]<-compare_pw(dsets[[nm]],w)
}
## Degenerate cases and the overflow mechanism in the reference Welch-df expression.
one <- c(1,2,3); two <- c(10,11,12); singleton <- c(5)
zero <- c(1,1,1); variable <- c(5,6,7)
a <- var(PlantGrowth$weight[PlantGrowth$group=="ctrl"])/sum(PlantGrowth$group=="ctrl")
b <- var(PlantGrowth$weight[PlantGrowth$group=="trt1"])/sum(PlantGrowth$group=="trt1")
as <- a*1e200; bs <- b*1e200
raw_num <- (as+bs)^2
raw_den <- as^2/(sum(PlantGrowth$group=="ctrl")-1)+bs^2/(sum(PlantGrowth$group=="trt1")-1)
stable_a <- as/max(as,bs); stable_b <- bs/max(as,bs)
stable_df <- (stable_a+stable_b)^2/(stable_a^2/(sum(PlantGrowth$group=="ctrl")-1)+stable_b^2/(sum(PlantGrowth$group=="trt1")-1))
base_df <- (a+b)^2/(a^2/(sum(PlantGrowth$group=="ctrl")-1)+b^2/(sum(PlantGrowth$group=="trt1")-1))
degenerate <- list(singleton=pair_calc(list(A=one,B=two,C=singleton)),
 zero_variance=pair_calc(list(A=zero,B=variable)),
 all_equal=pair_calc(list(A=rep(2,3),B=rep(2,3))),
 large_scale=list(raw_num=raw_num,raw_den=raw_den,raw_df=raw_num/raw_den,
                  stable_df=stable_df,unscaled_df=base_df))
## Page statistic: average within-block ranks, L, null moments, continuity correction and normal tails.
page_calc <- function(mm,alt="two.sided") {
 nr<-nrow(mm); nc<-ncol(mm)
 rr<-t(apply(mm,1,function(z) rank(z,na.last="keep",ties.method="average")))
 cj<-colSums(rr,na.rm=TRUE); ll<-sum(seq_len(nc)*cj)
 ee<-nr*nc*(nc+1)^2/4; vv<-nr*nc^2*(nc-1)*(nc+1)^2/144
 zz<-(ll-ee-.5*sign(ll-ee))/sqrt(vv)
 pp<-if(alt=="greater") pnorm(zz,lower.tail=FALSE) else if(alt=="less") pnorm(zz) else 2*pnorm(-abs(zz))
 c(L=ll,E=ee,V=vv,z=zz,p=pp)
}
mm0 <- matrix(c(3.4,4.1,4.8,5.0,2.9,3.0,3.8,4.4,3.1,3.9,3.7,4.9,
 2.5,3.6,4.0,4.1,3.0,2.8,4.5,4.6),nrow=5,byrow=TRUE)
pg_res <- list()
set.seed(19)
for(k in 3:8) for(n in c(2,3,4,5,8,12,20)) {
 mm<-matrix(round(rnorm(n*k)+rep(seq_len(k)/3,each=n),2),nrow=n)
 ref<-pageTest(mm)
 cal<-page_calc(mm)
 pg_res[[sprintf("k%d_n%d",k,n)]]<-list(calc=cal,reference=c(L=ref$estimate,z=ref$statistic,p=ref$p.value),
  abs_error=mdiff(cal[c("L","z","p")],c(ref$estimate,ref$statistic,ref$p.value)))
}
ties_m <- matrix(c(1,2,2,3,1,1,2,2,2,3,3,4,1,2,3,3,4,4,4,4,1,3,2,4),nrow=6,byrow=TRUE)
na_m <- mm0; na_m[2,3]<-NA
pg_special <- list(
 m1=page_calc(mm0), ties=page_calc(ties_m),
 one_block=page_calc(matrix(c(1,2,3,4),nrow=1)),
 na=page_calc(na_m),
 reversed=page_calc(mm0[,4:1]),
 greater=page_calc(mm0,"greater"),less=page_calc(mm0,"less"))
pg_ref <- list(m1=pageTest(mm0),ties=pageTest(ties_m),
 one_block=pageTest(matrix(c(1,2,3,4),nrow=1)),
 na=pageTest(na_m),reversed=pageTest(mm0[,4:1]),
 greater=pageTest(mm0,alternative="greater"),less=pageTest(mm0,alternative="less"))
pg_special_errors <- lapply(names(pg_special),function(nm) {
 a0<-pg_special[[nm]]; b0<-pg_ref[[nm]]
 list(name=nm,estimate_error=abs(a0["L"]-b0$estimate),
      z_error=abs(a0["z"]-b0$statistic),p_error=abs(a0["p"]-b0$p.value))
})
names(pg_special_errors)<-names(pg_special)
cat(toJSON(list(tamhane=t2_res,degenerate=degenerate,page_grid=pg_res,
 page_special=pg_special,page_special_errors=pg_special_errors),
 digits=NA,auto_unbox=TRUE,na="string",null="null"))
