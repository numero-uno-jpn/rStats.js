# issue: 527
# Public epiR 3.0.0 calls only; second allocation-ratio grid for integer group sizes.
suppressPackageStartupMessages(library(epiR))
suppressPackageStartupMessages(library(jsonlite))
probe <- function(id, f) {
  value <- tryCatch(f(), error=function(x) list(error=conditionMessage(x)))
  cat(jsonlite::toJSON(list(id=id, value=value), auto_unbox=TRUE, digits=NA,
    null="null", na="string", force=TRUE), "\n", sep="")
}
for (ratio in c(0.7, 2.2)) {
  probe(paste0("ssequb-r",ratio), function() epi.ssequb(treat=.50,control=.45,delta=.10,n=NA,power=.80,r=ratio,type="equivalence",nfractional=FALSE,alpha=.05))
  probe(paste0("ssequc-r",ratio), function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=NA,power=.80,r=ratio,type="equivalence",nfractional=FALSE,alpha=.05))
  probe(paste0("ssninfb-r",ratio), function() epi.ssninfb(treat=.85,control=.65,delta=.10,n=NA,power=.80,r=ratio,nfractional=FALSE,alpha=.05))
  probe(paste0("ssninfc-r",ratio), function() epi.ssninfc(treat=.22,control=.20,sigma=.10,delta=.05,n=NA,power=.80,r=ratio,nfractional=FALSE,alpha=.05))
  probe(paste0("sssupb-r",ratio), function() epi.sssupb(treat=.85,control=.65,delta=.05,n=NA,power=.80,r=ratio,sided.test=2,nfractional=FALSE,alpha=.05))
  probe(paste0("sssupc-r",ratio), function() epi.sssupc(treat=20,control=20,sigma=10,delta=5,n=NA,power=.80,r=ratio,sided.test=2,nfractional=FALSE,alpha=.05))
}
