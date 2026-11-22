# issue: 549
# grubbs.R: the fixture test/fixtures/grubbs.json (1.9.0): every grubbs, pgrubbs, qgrubbs case of oracle/_tests19cases.R
# (the same cases as experiments/tests19-small.R). Public calls only; numbers and strings only.
source("/oracle/_tests19cases.R")
selected <- out[startsWith(names(out), "grubbs_") | startsWith(names(out), "pgrubbs_") | startsWith(names(out), "qgrubbs_")]
# Type 20's quantiles at the probabilities of its table, as R returns them (types 11 and 20 are not supported in
# 1.9.0; kept as a record)
table_prob <- c(0.001, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 0.99, 0.999)
selected$type20_table_grid <- lapply(c(4, 6, 8, 9, 11, 15, 16, 25, 29), function(nn)
  list(n = nn, probability = table_prob, quantile = lapply(table_prob, function(pp) run(qgrubbs(pp, nn, type = 20)))))
writeLines(toJSON(selected, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "grubbs.json"))
