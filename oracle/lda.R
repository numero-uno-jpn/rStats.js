# issue: 549
# Full LDA fixture set: fit, predict, CV, priors, and all boundary cases.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/multivariate19.R", envir=env)))
selected <- env$out[startsWith(names(env$out), "lda_")]
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
