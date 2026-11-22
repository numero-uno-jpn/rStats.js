# issue: 549
# Full Page fixture set, including every grid size, alternative and boundary case.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/tests19-small.R", envir=env)))
selected <- env$out[startsWith(names(env$out), "page_")]
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
