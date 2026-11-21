# extend formula checks and public-output coverage
# rerun after output-size and seed-stream corrections
# rerun after independent formula probes
# rerun after stage1 formula verification
# batch rerun after reserved-token fix
# batch rerun after clean-room script correction
# Corrected GEE oracle. All tabular results are reduced to plain numeric matrices before JSON encoding.
suppressMessages(library(geepack))
library(jsonlite)
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(tryCatch(expr,error=function(e) structure(list(message=conditionMessage(e)),class="caught")),
    warning=function(w){warns<<-c(warns,conditionMessage(w));invokeRestart("muffleWarning")},
    message=function(m){msgs<<-c(msgs,conditionMessage(m));invokeRestart("muffleMessage")})
  if(inherits(value,"caught")) return(list(error=value$message,warnings=warns,messages=msgs))
  list(value=value,warnings=warns,messages=msgs)
}
tab <- function(m) {
  z <- as.matrix(m)
  list(rows=as.character(rownames(z)),cols=as.character(colnames(z)),
       nrow=nrow(z),ncol=ncol(z),values=as.numeric(z))
}
anovaTable <- function(a) {
  d <- as.data.frame(a)
  list(rows=as.character(rownames(d)),columns=lapply(d,function(z)as.numeric(z)))
}
plain <- function(x) {
  if (is.null(x)) return(NULL)
  if (inherits(x,"lm")) return(NULL)
  if (is.data.frame(x)) return(lapply(x,plain))
  if (is.matrix(x)) return(list(nrow=nrow(x),ncol=ncol(x),values=as.vector(x)))
  if (is.list(x)) return(lapply(x,plain))
  if (is.factor(x)) return(as.character(x))
  if (is.atomic(x)) return(as.vector(x))
  NULL
}
capture <- function(f,includeQIC=TRUE) {
  s <- summary(f)
  ans <- list(coefficients=unname(coef(f)),vcov=tab(vcov(f)),
              corr=tab(s$corr),dispersion=tab(s$dispersion),
              alphaVar=as.numeric(diag(f$geese$valpha)),gammaVar=as.numeric(diag(f$geese$vgamma)))
  if (includeQIC) ans$qic <- unname(as.numeric(QIC(f)))
  ans
}
out <- list(control_default=geese.control())
data(dietox);data(ohio);data(seizure);data(respiratory)
dietox$Cu <- factor(dietox$Cu)
for (cs in c("independence","exchangeable","ar1","unstructured")) {
  out[[paste0("dietox_",cs)]] <- run({
    f <- geeglm(Weight~Time+Cu,id=Pig,data=dietox,corstr=cs)
    ft <- geeglm(Weight~Time+Cu,id=Pig,data=dietox,corstr=cs,
                 control=geese.control(epsilon=1e-10,maxit=200))
    a <- anova(f)
    list(default=capture(f),tight=capture(ft,FALSE),anova=anovaTable(a))
  })
  out[[paste0("ohio_",cs)]] <- run({
    f <- geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr=cs)
    ft <- geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr=cs,
                 control=geese.control(epsilon=1e-10,maxit=200))
    list(default=capture(f),tight=capture(ft,FALSE))
  })
}
for (cs in c("independence","exchangeable","ar1")) out[[paste0("gamma_",cs)]] <- run({
  f <- geeglm(Weight~Time+Cu,id=Pig,data=dietox,family=Gamma(link="log"),corstr=cs)
  ft <- geeglm(Weight~Time+Cu,id=Pig,data=dietox,family=Gamma(link="log"),corstr=cs,
               control=geese.control(epsilon=1e-10,maxit=200))
  list(default=capture(f),tight=capture(ft,FALSE))
})
sz <- reshape(seizure,varying=list(c("base","y1","y2","y3","y4")),v.names="y",times=0:4,direction="long")
sz <- sz[order(sz$id,sz$time),];sz$t <- ifelse(sz$time==0,8,2);sz$x <- ifelse(sz$time==0,0,1)
for (cs in c("independence","exchangeable","ar1","unstructured")) {
  out[[paste0("poisson_offset_",cs)]] <- run({
    f <- geeglm(y~offset(log(t))+x+trt+x:trt,id=id,data=sz,family=poisson,corstr=cs)
    # the tight refit with corstr = "unstructured" did not finish in 60 s although maxit = 200 (geepack 1.3.13; the
    # default fit takes 0.04 s), so that case has no tight refit
    if (cs == "unstructured") list(default=capture(f),tight="skipped") else {
      ft <- geeglm(y~offset(log(t))+x+trt+x:trt,id=id,data=sz,family=poisson,corstr=cs,
                   control=geese.control(epsilon=1e-10,maxit=200))
      list(default=capture(f),tight=capture(ft,FALSE))
    }
  })
}
out$poisson_offset <- out$poisson_offset_exchangeable
out$inputs <- list(
  dietox=plain(dietox),
  ohio=plain(ohio),
  seizure=plain(seizure),
  respiratory=plain(respiratory),
  poisson_offset=plain(sz)
)

# Deterministic public-output check data used for independent formula validation.
gee_check <- data.frame(
  id=rep(1:12,each=3),
  wave=rep(1:3,12),
  x=rep(c(-1,0,1),12),
  y=c(
    1.7534,2.9203,2.5018,2.8479,3.1191,3.3040,1.9940,2.9519,3.3162,
    2.0370,3.1600,3.7074,2.1179,2.7573,3.5305,1.8430,2.5981,3.7241,
    2.0848,2.1128,3.2114,2.4783,2.6839,3.3756,2.4709,3.7123,3.0934,
    2.8241,2.1850,3.5375,1.5652,3.4757,3.8670,2.7189,2.3572,3.7923
  )
)
out$gee_check <- list()
for (cs in c("independence","exchangeable","ar1","unstructured")) {
  out$gee_check[[cs]] <- run({
    f <- geeglm(y~x,id=id,waves=wave,data=gee_check,family=gaussian,corstr=cs)
    ft <- geeglm(y~x,id=id,waves=wave,data=gee_check,family=gaussian,corstr=cs,
                 control=geese.control(epsilon=1e-12,maxit=500))
    list(
      default=capture(f),
      tight=capture(ft,FALSE),
      fitted=unname(fitted(f)),
      pearson=unname(residuals(f,type="pearson"))
    )
  })
}
set.seed(1729)
jackknife_binomial <- data.frame(
  id=rep(1:20,each=3),
  wave=rep(1:3,20),
  age=rep(seq(20,58,length.out=20),each=3)+rep(c(-1,0,1),20),
  smoke=rep(rep(c(0,1),each=10),each=3)
)
eta <- -2.8 + 0.04*jackknife_binomial$age + 0.9*jackknife_binomial$smoke + 0.15*jackknife_binomial$wave
jackknife_binomial$resp <- rbinom(nrow(jackknife_binomial),1,plogis(eta))
out$jackknife_binomial <- list()
for (st in c("jack","j1s","fij")) {
  out$jackknife_binomial[[st]] <- run({
    f <- geeglm(resp~age+smoke,id=id,waves=wave,data=jackknife_binomial,
                family=binomial,corstr="exchangeable",std.err=st)
    list(
      coefficients=unname(coef(f)),
      vcov=tab(vcov(f)),
      summary=tab(coef(summary(f))),
      corr=tab(summary(f)$corr),
      dispersion=tab(summary(f)$dispersion)
    )
  })
}
out$inputs$gee_check <- plain(gee_check)
out$inputs$jackknife_binomial <- plain(jackknife_binomial)

for (st in c("jack","j1s","fij")) out[[paste0("jack_",st)]] <- run({
 f <- geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="exchangeable",std.err=st)
 capture(f)
})
out$fixed_scale <- run(capture(geeglm(Weight~Time,id=Pig,data=dietox,corstr="ar1",scale.fix=TRUE,scale.value=4)))
out$weights <- run(capture(geeglm(Weight~Time,id=Pig,data=dietox,corstr="exchangeable",
                                  weights=rep(c(1,2),length.out=nrow(dietox)))))
out$waves <- run(capture(geeglm(outcome~treat+sex+age+baseline,id=interaction(center,id),waves=visit,
                                data=respiratory,family=binomial,corstr="ar1")))
out$userdefined <- run({
 z <- genZcor(clusz=table(dietox$Pig),waves=dietox$Time,corstrv=4)
 capture(geeglm(Weight~Time,id=Pig,data=dietox,corstr="userdefined",zcor=z))
})
out$fixed <- run({
 cm <- matrix(c(1,.5,.3,.2,.5,1,.5,.3,.3,.5,1,.5,.2,.3,.5,1),4,4)
 z <- fixed2Zcor(cm,id=ohio$id,waves=ohio$age+3)
 f <- geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="fixed",zcor=z)
 list(default=capture(f),tight=unname(coef(geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,
      corstr="fixed",zcor=z,control=geese.control(epsilon=1e-10,maxit=200)))))
})
out$nested_anova <- run({
 a <- geeglm(resp~age,id=id,data=ohio,family=binomial,corstr="exchangeable")
 b <- geeglm(resp~age+smoke+age:smoke,id=id,data=ohio,family=binomial,corstr="exchangeable")
 anovaTable(anova(b,a))
})
out$predict <- run({
 f <- geeglm(resp~age+smoke,id=id,data=ohio,family=binomial,corstr="ar1")
 nd <- data.frame(age=c(-2,0,1),smoke=c(0,1,1))
 list(link=unname(predict(f,newdata=nd)),response=unname(predict(f,newdata=nd,type="response")))
})
out$unsorted_id <- run(capture(geeglm(Weight~Time,id=Pig,data=dietox[order(dietox$Time,-dietox$Pig),],corstr="exchangeable")))
out$singletons <- run(capture(geeglm(mpg~wt,id=seq_len(nrow(mtcars)),data=mtcars,corstr="exchangeable")))
out$missing <- run(capture(geeglm(Weight~Time,id=Pig,data=transform(dietox,Weight=replace(Weight,c(3,50),NA)),corstr="ar1")))
out$separation <- run(capture(geeglm(y~x,id=g,family=binomial,corstr="exchangeable",
 data=data.frame(x=1:12,y=rep(0:1,each=6),g=rep(1:4,3)))))
writeLines(toJSON(plain(out),digits=NA,auto_unbox=TRUE,null="null",na="string",pretty=FALSE),file.path("/out","gee.json"))
