# issue: 556
# Public cmdscale outputs for test/fixtures/cmdscale.json
source("/oracle/_cluster110cases.R")
selected <- out[startsWith(names(out), "cmdscale_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), file.path("/out", "cmdscale.json"))
