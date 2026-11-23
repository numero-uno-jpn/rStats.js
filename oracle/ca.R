# oracle-platform: amd64
# issue: 560
library(jsonlite)
source("_ca111cases.R")
selected <- out[grepl("^ca_", names(out))]
writeLines(as.character(toJSON(selected, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE)), "/out/ca.json")
