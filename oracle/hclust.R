# issue: 556
# Public hclust and cutree outputs for test/fixtures/hclust.json
source("/oracle/_cluster110cases.R")
selected <- out[grepl("^(hclust_|cutree_)", names(out))]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), file.path("/out", "hclust.json"))
