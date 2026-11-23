# oracle-platform: amd64
# issue: 560
library(jsonlite)
source("/oracle/_acf111cases.R")
selected <- out[grepl("^(acf_|pacf_|ccf_|clim_)", names(out))]
writeLines(as.character(toJSON(selected, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE)), "/out/acf.json")
