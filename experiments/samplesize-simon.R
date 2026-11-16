# issue: 527
# Public clinfun 1.1.6 calls and documented return/print values only; no package source inspection.
suppressPackageStartupMessages(library(clinfun))
suppressPackageStartupMessages(library(jsonlite))
probe <- function(id, f) {
  w <- character()
  value <- tryCatch(withCallingHandlers(f(), warning=function(x) {
    w <<- c(w, conditionMessage(x)); invokeRestart("muffleWarning")
  }), error=function(x) list(error=conditionMessage(x)))
  cat(jsonlite::toJSON(list(id=id, value=value, warnings=unique(w)),
    auto_unbox=TRUE, digits=NA, null="null", na="string", force=TRUE), "\n", sep="")
}
cat("clinfun=", as.character(packageVersion("clinfun")), "\n", sep="")
probe("standard-return", function() {
  x <- ph2simon(pu=.20,pa=.40,ep1=.05,ep2=.10,nmax=100)
  list(pu=x$pu,pa=x$pa,alpha=x$alpha,beta=x$beta,nmax=x$nmax,
       out=x$out,printed=utils::capture.output(print(x)))
})
probe("standard-nmax-50", function() {
  x <- ph2simon(pu=.20,pa=.40,ep1=.05,ep2=.10,nmax=50)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("nmax-minimum", function() ph2simon(pu=.20,pa=.40,ep1=.05,ep2=.10,nmax=1))
probe("nmax-maximum", function() {
  x <- ph2simon(pu=.20,pa=.40,ep1=.05,ep2=.10,nmax=1000)
  list(rows=nrow(x$out),first=x$out[1,],last=x$out[nrow(x$out),])
})
probe("nmax-over-limit", function() ph2simon(pu=.20,pa=.40,ep1=.05,ep2=.10,nmax=1001))
probe("minimax-also-optimal", function() {
  x <- ph2simon(pu=.80,pa=.95,ep1=.05,ep2=.20)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("no-feasible-design", function() ph2simon(pu=.20,pa=.21,ep1=.0001,ep2=.0001,nmax=10))
probe("invalid-pa-not-greater", function() ph2simon(pu=.40,pa=.20,ep1=.05,ep2=.10))
probe("boundary-pu-zero", function() {
  x <- ph2simon(pu=0,pa=.20,ep1=.05,ep2=.10,nmax=100)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
probe("boundary-pa-one", function() {
  x <- ph2simon(pu=.20,pa=1,ep1=.05,ep2=.10,nmax=100)
  list(out=x$out,printed=utils::capture.output(print(x)))
})
