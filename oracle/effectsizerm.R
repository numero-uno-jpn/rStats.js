source("/oracle/_anova.R")
suppressPackageStartupMessages({library(effectsize); library(afex)})

# Effect sizes of repeated-measures designs (ROADMAP item 1): effectsize's eta_squared, omega_squared and
# epsilon_squared for aov fits with an Error() term (fixture etaSquaredStrata: formula, data) and for afex fits
# (fixture etaSquaredEz: the aov_ez arguments of oracle/aovez.R). Options fn, partial, generalized (eta only), ci,
# alternative. Written: colNames (effectsize's columns after Group/Parameter), groups (the Group column, strata only),
# rowNames (Parameter), table, warnings. No references yet: effectsize's interval limits come from its optimiser
# (about 1e-9 accurate); exact ones are to be added with the specification.

set.seed(20261125)
w1 <- long(10, list(W = c("w1", "w2", "w3")))
w2 <- long(8, list(W1 = c("a", "b"), W2 = c("x", "y", "z")))
mix <- long(12, list(W = c("w1", "w2", "w3")), between = c("g1", "g2"))
scases <- list(); ecases <- list()
for (fn in c("eta_squared", "omega_squared", "epsilon_squared")) for (partial in c(TRUE, FALSE)) {
  scases[[length(scases) + 1]] <- list(fn = fn, partial = partial, formula = "y ~ W + Error(id/W)", data = w1)
  scases[[length(scases) + 1]] <- list(fn = fn, partial = partial, formula = "y ~ W1 * W2 + Error(id/(W1 * W2))", data = w2)
  scases[[length(scases) + 1]] <- list(fn = fn, partial = partial, formula = "y ~ G * W + Error(id/W)", data = mix)
  ecases[[length(ecases) + 1]] <- list(fn = fn, partial = partial, data = w1, id = "id", dv = "y", within = "W")
  ecases[[length(ecases) + 1]] <- list(fn = fn, partial = partial, data = w2, id = "id", dv = "y", within = I(c("W1", "W2")))
  ecases[[length(ecases) + 1]] <- list(fn = fn, partial = partial, data = mix, id = "id", dv = "y", between = "G", within = "W")
}
scases[[length(scases) + 1]] <- list(fn = "eta_squared", generalized = TRUE, formula = "y ~ G * W + Error(id/W)", data = mix)
ecases[[length(ecases) + 1]] <- list(fn = "eta_squared", generalized = TRUE, data = mix, id = "id", dv = "y", between = "G", within = "W")
ecases[[length(ecases) + 1]] <- list(fn = "eta_squared", generalized = "G", data = mix, id = "id", dv = "y", between = "G", within = "W")
scases[[length(scases) + 1]] <- list(fn = "eta_squared", formula = "y ~ W + Error(id/W)", data = w1, ci = 0.9, alternative = "two.sided")

es_out <- function(v) {
  v <- as.data.frame(v)
  cols <- setdiff(colnames(v), c("Group", "Parameter"))
  c(list(colNames = I(cols), rowNames = I(v$Parameter)), if ("Group" %in% colnames(v)) list(groups = I(as.character(v$Group))),
    list(table = lapply(seq_len(nrow(v)), function(i) I(num2str(unname(unlist(v[i, cols])))))))
}
es_call <- function(a, model) {
  args <- list(model = model)
  for (k in c("partial", "generalized", "ci", "alternative")) if (!is.null(a[[k]])) args[[k]] <- a[[k]]
  suppressMessages(do.call(get(a$fn, envir = asNamespace("effectsize")), args))
}
write_anova_fixture("etaSquaredStrata", scases, function(a) {
  r <- with_warnings(function() es_out(es_call(a, aov(as.formula(a$formula), a$data))))
  c(r$value, list(warnings = r$warnings))
})
write_anova_fixture("etaSquaredEz", ecases, function(a) {
  r <- with_warnings(function() {
    args <- list(id = a$id, dv = a$dv, data = a$data)
    if (!is.null(a$between)) args$between <- unclass(a$between)
    if (!is.null(a$within)) args$within <- unclass(a$within)
    es_out(es_call(a, suppressMessages(do.call(aov_ez, args))))
  })
  c(r$value, list(warnings = r$warnings))
})
