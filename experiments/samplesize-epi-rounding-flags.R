# issue: 527
# Compare nfractional TRUE and FALSE for the ratio-grid anomalies using public calls only.
suppressPackageStartupMessages(library(epiR))
suppressPackageStartupMessages(library(jsonlite))
probe <- function(id, f) {
  value <- tryCatch(f(), error=function(x) list(error=conditionMessage(x)))
  cat(jsonlite::toJSON(list(id=id, value=value), auto_unbox=TRUE, digits=NA,
    null="null", na="string", force=TRUE), "\n", sep="")
}
for (ratio in c(0.7, 2.2)) {
  probe(paste0("ssequc-fractional-r",ratio), function() epi.ssequc(treat=20,control=21,sigma=10,delta=5,n=NA,power=.80,r=ratio,type="equivalence",nfractional=TRUE,alpha=.05))
  probe(paste0("ssninfb-fractional-r",ratio), function() epi.ssninfb(treat=.85,control=.65,delta=.10,n=NA,power=.80,r=ratio,nfractional=TRUE,alpha=.05))
}
