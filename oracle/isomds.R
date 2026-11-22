# issue: 556
# Public MASS::isoMDS outputs for test/fixtures/isomds.json
source("/oracle/_cluster110cases.R")
selected <- out[startsWith(names(out), "isomds_")]
writeLines(toJSON(selected, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), file.path("/out", "isomds.json"))
