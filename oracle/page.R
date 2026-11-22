# issue: 549
# page.R: the fixture test/fixtures/page.json (1.9.0): every page case of oracle/_tests19cases.R
# (the same cases as experiments/tests19-small.R). Public calls only; numbers and strings only.
source("/oracle/_tests19cases.R")
selected <- out[startsWith(names(out), "page_")]
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "page.json"))
