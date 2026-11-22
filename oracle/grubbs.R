# issue: 549
# Full Grubbs fixture set, including all pgrubbs/qgrubbs probes and boundaries.
library(jsonlite)
env <- new.env(parent=globalenv())
invisible(capture.output(sys.source("experiments/tests19-small.R", envir=env)))
keep <- startsWith(names(env$out), "grubbs_") |
        startsWith(names(env$out), "pgrubbs_") |
        startsWith(names(env$out), "qgrubbs_")
selected <- env$out[keep]

# Type-20 table probabilities observed through the public quantile function.
# The numeric q values are collected from R; no package table is embedded here.
table_prob <- c(0.001, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 0.99, 0.999)
table_n <- c(4, 6, 8, 9, 11, 15, 16, 25, 29)
type20_table_grid <- lapply(table_n, function(nn) {
  q <- lapply(table_prob, function(pp) {
    tryCatch(qgrubbs(pp, nn, type=20), error=function(e) list(error=conditionMessage(e)))
  })
  names(q) <- format(table_prob, trim=TRUE, scientific=FALSE)
  list(n=nn, probability=table_prob, quantile=q,
       reverse_cdf_at_quantiles=lapply(q, function(z) {
         if (is.list(z) && !is.null(z$error)) return(z)
         tryCatch(pgrubbs(as.numeric(z), nn, type=20), error=function(e) list(error=conditionMessage(e)))
       }))
})
names(type20_table_grid) <- as.character(table_n)
selected$type20_table_grid <- type20_table_grid
cat(toJSON(selected, digits=NA, auto_unbox=TRUE, null="null", na="string", pretty=FALSE))
