# issue: 556
# oracle-platform: amd64
# Public kmeans outputs for test/fixtures/kmeans.json
source("/oracle/_cluster110cases.R")
selected <- out[startsWith(names(out), "kmeans_")]
writeLines(toJSON(selected, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), file.path("/out", "kmeans.json"))
