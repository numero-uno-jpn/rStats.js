# issue: 549
# Full canonical-correlation fixture set, including centers, rank and scale cases.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/multivariate19.R", envir=env)))
selected <- env$out[startsWith(names(env$out), "cancor_")]
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
