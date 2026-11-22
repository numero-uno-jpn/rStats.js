# issue: 549
# Full T2/T2' fixture set. Reuse the checked public-call experiment; retain every T2 case.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/tests19-small.R", envir=env)))
selected <- env$out[startsWith(names(env$out), "t2_")]
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
