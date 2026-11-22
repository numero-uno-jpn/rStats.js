# issue: 549
# Full Grubbs fixture set, including all pgrubbs/qgrubbs probes and boundaries.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/tests19-small.R", envir=env)))
keep <- startsWith(names(env$out), "grubbs_") |
        startsWith(names(env$out), "pgrubbs_") |
        startsWith(names(env$out), "qgrubbs_")
selected <- env$out[keep]
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
