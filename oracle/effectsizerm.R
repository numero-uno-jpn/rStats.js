source("/oracle/_anova.R")
suppressPackageStartupMessages({library(effectsize); library(afex); library(parameters)})
source("/oracle/_power.R")

# Effect sizes of repeated-measures designs (ROADMAP item 1): effectsize's eta_squared, omega_squared and
# epsilon_squared for aov fits with an Error() term (fixture etaSquaredStrata: formula, data) and for afex fits
# (fixture etaSquaredEz: the aov_ez arguments of oracle/aovez.R). Options fn, partial, generalized (eta only), ci,
# alternative. Written: colNames (effectsize's columns after Group/Parameter), groups (the Group column, strata only),
# rowNames (Parameter), table, warnings. "reference": CI_low and CI_high with the noncentrality limits solved
# accurately (as oracle/effectsize.R; effectsize's optimiser is about 1e-9 accurate), from each row's effect size, its
# df and the residual df of its stratum (strata: the stratum's Residuals row; afex: car's den Df of the row).

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
ref_ncp_f <- function(f, df1, df2, level) {
  probs <- c((1 - level) / 2, (1 + level) / 2)
  r <- function(p) { g <- function(ncp) (if (ncp == 0) pf(f, df1, df2) else acc_pnf(f, df1, df2, ncp, TRUE)) - p
    if (g(0) < 0) return(0)
    uniroot(g, c(0, max(10, f * df1 * 4)), extendInt = "downX", tol = 1e-14 * max(1, f * df1), maxiter = 5000)$root }
  lim <- sort(c(r(probs[2]), r(probs[1])))
  if (f <= qf(probs[1], df1, df2)) lim[2] <- 0
  if (f <= qf(probs[2], df1, df2)) lim[1] <- 0
  lim
}
ref_rows <- function(a, v, dfs) {
  v <- as.data.frame(v); if (!"CI" %in% colnames(v)) return(NULL)
  esc <- setdiff(colnames(v), c("Group", "Parameter", "CI", "CI_low", "CI_high"))[1]
  level <- if (is.null(a$ci)) 0.95 else a$ci; alt <- if (is.null(a$alternative)) "greater" else a$alternative
  L <- if (alt == "two.sided") level else 2 * level - 1
  lims <- lapply(seq_len(nrow(v)), function(i) {
    d <- dfs(v[i, ]); es <- max(0, v[i, esc]); f <- (es / d[1]) / ((1 - es) / d[2])
    lim <- ref_ncp_f(f, d[1], d[2], L); lo <- lim[1] / (lim[1] + d[2]); hi <- lim[2] / (lim[2] + d[2])
    if (alt == "less") lo <- 0
    if (alt == "greater") hi <- 1
    c(lo, hi)
  })
  list(CI_low = I(num2str(vapply(lims, `[`, 0, 1))), CI_high = I(num2str(vapply(lims, `[`, 0, 2))))
}

strata_ref <- function(a) {
  m <- aov(as.formula(a$formula), a$data)
  v <- tryCatch(es_call(a, m), error = function(e) NULL); if (is.null(v)) return(NULL)
  p <- as.data.frame(model_parameters(m, es_type = NULL, include_intercept = FALSE))
  ref_rows(a, v, function(row) { g <- p[p$Group == row$Group, ]
    c(g$df[g$Parameter == row$Parameter], g$df[g$Parameter == "Residuals"]) })
}
ez_ref <- function(a) {
  args <- list(id = a$id, dv = a$dv, data = a$data)
  if (!is.null(a$between)) args$between <- unclass(a$between)
  if (!is.null(a$within)) args$within <- unclass(a$within)
  fit <- suppressMessages(do.call(aov_ez, args))
  v <- tryCatch(es_call(a, fit), error = function(e) NULL); if (is.null(v)) return(NULL)
  u <- unclass(suppressWarnings(summary(fit$Anova, multivariate = FALSE))$univariate.tests)
  ref_rows(a, v, function(row) c(u[row$Parameter, "num Df"], u[row$Parameter, "den Df"]))
}
write_anova_fixture("etaSquaredStrata", scases, function(a) {
  r <- with_warnings(function() es_out(es_call(a, aov(as.formula(a$formula), a$data))))
  c(r$value, list(warnings = r$warnings))
}, ref = strata_ref)
write_anova_fixture("etaSquaredEz", ecases, function(a) {
  r <- with_warnings(function() {
    args <- list(id = a$id, dv = a$dv, data = a$data)
    if (!is.null(a$between)) args$between <- unclass(a$between)
    if (!is.null(a$within)) args$within <- unclass(a$within)
    es_out(es_call(a, suppressMessages(do.call(aov_ez, args))))
  })
  c(r$value, list(warnings = r$warnings))
}, ref = ez_ref)
