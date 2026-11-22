# issue: 549
# lda.R: the fixture test/fixtures/lda.json (1.9.0): every lda case of oracle/_multivariate19cases.R
# (the same cases as experiments/multivariate19.R). Public calls only; numbers and strings only.
source("/oracle/_multivariate19cases.R")
selected <- out[startsWith(names(out), "lda_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "lda.json"))
