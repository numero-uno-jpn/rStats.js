# issue: 527
# Public epiR 3.0.0 calls only; probe nfractional independently for all six methods.
suppressPackageStartupMessages(library(epiR))
suppressPackageStartupMessages(library(jsonlite))
probe <- function(id, f) {
  w <- character()
  value <- tryCatch(withCallingHandlers(f(), warning=function(x) {
    w <<- c(w, conditionMessage(x)); invokeRestart("muffleWarning")
  }), error=function(x) list(error=conditionMessage(x)))
  cat(jsonlite::toJSON(list(id=id, value=value, warnings=unique(w)),
    auto_unbox=TRUE, digits=NA, null="null", na="string", force=TRUE), "\n", sep="")
}
cat("epiR=", as.character(packageVersion("epiR")), "\n", sep="")
probe("ssequb-fractional", function() epi.ssequb(treat=.50,control=.45,delta=.10,n=NA,power=.80,r=1.5,type="equivalence",nfractional=TRUE,alpha=.05))
probe("ssequb-integer", function() epi.ssequb(treat=.50,control=.45,delta=.10,n=NA,power=.80,r=1.5,type="equivalence",nfractional=FALSE,alpha=.05))
probe("ssequc-fractional", function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=NA,power=.80,r=1.5,type="equivalence",nfractional=TRUE,alpha=.05))
probe("ssequc-integer", function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=NA,power=.80,r=1.5,type="equivalence",nfractional=FALSE,alpha=.05))
probe("ssninfb-fractional", function() epi.ssninfb(treat=.85,control=.65,delta=.10,n=NA,power=.80,r=1.5,nfractional=TRUE,alpha=.05))
probe("ssninfb-integer", function() epi.ssninfb(treat=.85,control=.65,delta=.10,n=NA,power=.80,r=1.5,nfractional=FALSE,alpha=.05))
probe("ssninfc-fractional", function() epi.ssninfc(treat=.22,control=.20,sigma=.10,delta=.05,n=NA,power=.80,r=1.5,nfractional=TRUE,alpha=.05))
probe("ssninfc-integer", function() epi.ssninfc(treat=.22,control=.20,sigma=.10,delta=.05,n=NA,power=.80,r=1.5,nfractional=FALSE,alpha=.05))
probe("sssupb-fractional", function() epi.sssupb(treat=.85,control=.65,delta=.05,n=NA,power=.80,r=1.5,sided.test=2,nfractional=TRUE,alpha=.05))
probe("sssupb-integer", function() epi.sssupb(treat=.85,control=.65,delta=.05,n=NA,power=.80,r=1.5,sided.test=2,nfractional=FALSE,alpha=.05))
probe("sssupc-fractional", function() epi.sssupc(treat=20,control=20,sigma=10,delta=5,n=NA,power=.80,r=1.5,sided.test=2,nfractional=TRUE,alpha=.05))
probe("sssupc-integer", function() epi.sssupc(treat=20,control=20,sigma=10,delta=5,n=NA,power=.80,r=1.5,sided.test=2,nfractional=FALSE,alpha=.05))
