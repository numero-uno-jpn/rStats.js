# issue: 549
# manova.R: the fixture test/fixtures/manova.json (1.9.0): every manova case of oracle/_multivariate19cases.R
# (the same cases as experiments/multivariate19.R). Public calls only; numbers and strings only.
source("/oracle/_multivariate19cases.R")
selected <- out[startsWith(names(out), "manova_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "manova.json"))
