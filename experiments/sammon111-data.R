# issue: 560
# Export the public dissimilarity inputs and cmdscale starts for Sammon comparisons.
library(MASS)
library(jsonlite)
pack <- function(d) list(size = attr(d, "Size"), labels = attr(d, "Labels"), values = as.vector(d),
                         start2 = cmdscale(d, k = 2), start1 = cmdscale(d, k = 1), start3 = cmdscale(d, k = 3))
out <- list(swiss = pack(dist(swiss)), eurodist = pack(eurodist), usarrests = pack(dist(USArrests)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
