# issue: 556
# Public dist/as.dist outputs for test/fixtures/dist.json
source("/oracle/_cluster110cases.R")
selected <- out[grepl("^(dist_|as_dist)", names(out))]
writeLines(toJSON(selected, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE), file.path("/out", "dist.json"))
