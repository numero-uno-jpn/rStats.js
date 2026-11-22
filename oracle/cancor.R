# issue: 549
# cancor.R: the fixture test/fixtures/cancor.json (1.9.0): every cancor case of oracle/_multivariate19cases.R
# (the same cases as experiments/multivariate19.R). Public calls only; numbers and strings only.
source("/oracle/_multivariate19cases.R")
selected <- out[startsWith(names(out), "cancor_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "cancor.json"))
