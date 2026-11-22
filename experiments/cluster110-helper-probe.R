# issue: 556
# cluster110-helper-probe.R: execute the shared oracle cases once and report case inventory
source("oracle/_cluster110cases.R")
cat(toJSON(list(case_count = length(out), first = names(out)[1], last = names(out)[length(out)]),
           digits = NA, auto_unbox = TRUE, pretty = FALSE))
