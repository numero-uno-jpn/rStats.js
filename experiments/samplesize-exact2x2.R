# issue: 527
# Public exact2x2 1.7.0 calls only; no package source inspection.
library(exact2x2)
suppressPackageStartupMessages(library(jsonlite))
probe <- function(id, f) {
  w <- character()
  value <- tryCatch(withCallingHandlers(f(), warning=function(x) {
    w <<- c(w, conditionMessage(x)); invokeRestart("muffleWarning")
  }), error=function(x) list(error=conditionMessage(x)))
  cat(jsonlite::toJSON(list(id=id, value=value, warnings=unique(w)),
    auto_unbox=TRUE, digits=NA, null="null", na="string", force=TRUE), "\n", sep="")
}
cat("exact2x2=", as.character(packageVersion("exact2x2")), "\n", sep="")
probe("default", function() powerPaired2x2(pb=.50,pc=.30,npairs=40))
probe("strict", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,strict=TRUE))
probe("one-sided", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,alternative="one.sided"))
probe("one-sided-reversed", function() powerPaired2x2(pb=.30,pc=.50,npairs=40,alternative="one.sided"))
probe("exact-errbound-zero", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,errbound=0))
probe("errbound-small", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,errbound=1e-8))
probe("errbound-large", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,errbound=.01))
probe("null-odds-ratio-two", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,nullOddsRatio=2))
probe("alpha-small", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,sig.level=1e-6))
probe("alpha-zero", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,sig.level=0))
probe("alpha-one", function() powerPaired2x2(pb=.50,pc=.30,npairs=40,sig.level=1))
probe("zero-pairs", function() powerPaired2x2(pb=.50,pc=.30,npairs=0))
probe("zero-discordance", function() powerPaired2x2(pb=0,pc=0,npairs=40))
probe("near-zero-discordance", function() powerPaired2x2(pb=1e-12,pc=2e-12,npairs=100000))
probe("large-pairs", function() powerPaired2x2(pb=.50,pc=.30,npairs=100000))
