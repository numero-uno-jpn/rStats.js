# issue: 560
# Export the categorical observations needed to independently exercise the public mjca interface.
library(ca)
library(jsonlite)
dat <- wg93[, 1:4, drop = FALSE]
values <- unname(as.matrix(as.data.frame(lapply(dat, as.character))))
out <- list(rows = rownames(dat), cols = names(dat), values = values)
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE))
