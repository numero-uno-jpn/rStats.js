# issue: 549
# tamhane.R: the fixture test/fixtures/tamhane.json (1.9.0): every t2 case of oracle/_tests19cases.R
# (the same cases as experiments/tests19-small.R). Public calls only; numbers and strings only.
source("/oracle/_tests19cases.R")
selected <- out[startsWith(names(out), "t2_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "tamhane.json"))
