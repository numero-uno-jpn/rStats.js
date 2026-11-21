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
    ft <- geeglm(y~offset(log(t))+x+trt+x:trt,id=id,data=sz,family=poisson,corstr=cs,
                 control=geese.control(epsilon=1e-10,maxit=200))
    list(default=capture(f),tight=capture(ft,FALSE))
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
