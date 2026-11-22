# issue: 549
# Full MANOVA fixture set, including every term table, SSP matrix and boundary error.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/multivariate19.R", envir=env)))
selected <- env$out[startsWith(names(env$out), "manova_")]
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
