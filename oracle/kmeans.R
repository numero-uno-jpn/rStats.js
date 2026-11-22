# issue: 556
# Public kmeans outputs for test/fixtures/kmeans.json
source("/oracle/_cluster110cases.R")
selected <- out[startsWith(names(out), "kmeans_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), file.path("/out", "kmeans.json"))
