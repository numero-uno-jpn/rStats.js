# issue: 556
# Public data matrices used as inputs for the cluster/MDS fixture tests.
library(jsonlite)
payload <- list(
  iris = unname(as.matrix(iris[, 1:4])),
  usarrests = unname(as.matrix(USArrests)),
  swiss = unname(as.matrix(swiss)),
  eurodist = unname(as.matrix(eurodist))
)
cat(as.character(toJSON(payload, auto_unbox = TRUE, digits = NA)))
