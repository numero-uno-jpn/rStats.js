# issue: 567
# Public outputs of stats' loglin and MASS's loglm (with anova and residuals) for test/fixtures/loglin.json (1.17.0).
# The behaviour is in oracle/tobit-betareg-loglin-behaviour.md; the experiments behind it in
# experiments/regression117-loglin.R and regression117-loglm.R. Public calls only. Tables are written as counts in R's
# order (first index fastest) with dim, names and levels; the printed "N iterations: deviation X" line is parsed.
library(jsonlite)
suppressPackageStartupMessages(library(MASS))
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, MASS = as.character(packageVersion("MASS")))
tab_out <- function(t) list(counts = as.vector(t), dim = dim(t), names = names(dimnames(t)),
                            levels = unname(lapply(dimnames(t), as.character)))

set.seed(20261130)
t2 <- array(rpois(12, 8), c(3, 4), dimnames = list(A = c("a1", "a2", "a3"), B = c("b1", "b2", "b3", "b4")))
t3 <- array(as.vector(HairEyeColor), dim(HairEyeColor), dimnames = dimnames(HairEyeColor))
t3z <- t3; t3z[1, 1, 1] <- 0; t3z[2, 3, 2] <- 0
t4 <- array(rpois(36, 5), c(3, 3, 2, 2), dimnames = list(P = c("p1", "p2", "p3"), Q = c("q1", "q2", "q3"),
                                                          R = c("r1", "r2"), S = c("s1", "s2")))
t2u <- array(c(3.5, 0, 2, 7, 1.25, 4), c(2, 3))   # no dimnames, non-integer counts and a zero
st <- array(1, dim(t3)); st[4, 4, 2] <- 0
tables <- list(t2 = t2, t3 = t3, t3z = t3z, t4 = t4, t2u = t2u)
out$tables <- lapply(tables, tab_out)
out$start_structural <- as.vector(st)

loglin_case <- function(tn, margin, start = NULL, eps = 0.1, iter = 20, startname = NULL) {
  tab <- tables[[tn]]
  if (is.null(start)) start <- array(1, dim(tab))
  printed <- character(0)
  r <- run({ printed <- capture.output(v <- loglin(tab, margin, start = start, fit = TRUE, param = TRUE, eps = eps, iter = iter)); v })
  res <- list(table = tn, margin = margin, start = startname, eps = eps, iter = iter, warnings = r$warnings, printed = printed)
  if (!is.null(r$error)) return(c(res, list(error = r$error)))
  v <- r$value
  m <- regmatches(printed, regexec("^([0-9]+) iterations(: deviation (.*))?$", printed))[[1]]
  c(res, list(lrt = v$lrt, pearson = v$pearson, df = v$df, margin_out = v$margin, fit = as.vector(v$fit),
              iterations = as.integer(m[2]), deviation = if (nzchar(m[4])) as.numeric(m[4]) else NULL,
              param = lapply(v$param, as.vector), param_dim = lapply(v$param, function(p) if (is.null(dim(p))) length(p) else dim(p)),
              param_names = names(v$param)))
}
out$loglin <- list(
  loglin_case("t2", list(1, 2)),
  loglin_case("t2", list(c(1, 2))),
  loglin_case("t2", list()),
  loglin_case("t3", list(c(1, 2), c(1, 3), c(2, 3))),
  loglin_case("t3", list(c(2, 3), c(1, 3), c(1, 2))),
  loglin_case("t3", list(c(1, 2), c(1, 3))),
  loglin_case("t3", list(1, 2, 3)),
  loglin_case("t3", list(c("Hair", "Eye"), c("Sex"))),
  loglin_case("t3", list(c(1, 2), c(1, 3), c(2, 3)), eps = 1e-8, iter = 100),
  loglin_case("t3", list(c(1, 2), c(1, 3), c(2, 3)), iter = 2),
  loglin_case("t3", list(c(1, 2, 3))),
  loglin_case("t3z", list(c(1, 2), c(1, 3), c(2, 3))),
  loglin_case("t3", list(c(1, 2), c(1, 3), c(2, 3)), start = st, startname = "start_structural"),
  loglin_case("t4", list(c(1, 2), c(2, 3), c(3, 4), c(1, 4))),
  loglin_case("t4", list(c(1, 2, 3), c(3, 4))),
  loglin_case("t2u", list(1, 2)),
  loglin_case("t3", list(c(1, 4))),
  loglin_case("t3", list(c("Hair", "Colour")))
)

loglm_out <- function(g) list(lrt = g$lrt, pearson = g$pearson, df = g$df, deviance = deviance(g),
  margin = unname(g$margin), fitted = as.vector(fitted(g)),
  residuals = lapply(c(deviance = "deviance", pearson = "pearson", response = "response"), function(ty) as.vector(residuals(g, type = ty))),
  param = lapply(coef(g), as.vector), param_names = names(coef(g)), nobs = g$nobs, printed = capture.output(print(g)))
assign("t3", t3, envir = globalenv()); assign("t4", t4, envir = globalenv())
out$loglm <- lapply(list(
  list(formula = "~ Hair * Eye + Hair * Sex + Eye * Sex", table = "t3"),
  list(formula = "~ (Hair + Eye + Sex)^2", table = "t3"),
  list(formula = "~ Eye:Sex + Hair:Sex + Hair:Eye", table = "t3"),
  list(formula = "~ Hair + Eye:Sex + Hair:Eye", table = "t3"),
  list(formula = "~ Hair + Eye + Sex", table = "t3"),
  list(formula = "~ 1 + 2 + 3", table = "t3"),
  list(formula = "~ Hair/Eye + Sex", table = "t3"),
  list(formula = "~ P*Q + Q*R + R*S", table = "t4")
), function(cs) {
  r <- run(loglm(as.formula(cs$formula), data = tables[[cs$table]], fitted = TRUE))
  if (!is.null(r$error)) c(cs, list(error = r$error)) else c(cs, loglm_out(r$value))
})
# frequencies in a data frame, complete and with missing cells (structural zeros)
df3 <- as.data.frame(as.table(t3)); df3m <- df3[-c(5, 20), ]
assign("df3", df3, envir = globalenv()); assign("df3m", df3m, envir = globalenv())
out$data <- list(df3 = lapply(as.list(df3), function(v) if (is.factor(v)) as.character(v) else v),
                 df3m = lapply(as.list(df3m), function(v) if (is.factor(v)) as.character(v) else v))
out$loglm_frame <- list(
  c(list(formula = "Freq ~ Hair * Eye + Hair * Sex + Eye * Sex", data = "df3"),
    loglm_out(loglm(Freq ~ Hair * Eye + Hair * Sex + Eye * Sex, data = df3, fitted = TRUE))),
  c(list(formula = "Freq ~ Hair * Eye + Hair * Sex + Eye * Sex", data = "df3m"),
    loglm_out(loglm(Freq ~ Hair * Eye + Hair * Sex + Eye * Sex, data = df3m, fitted = TRUE))),
  c(list(formula = "Freq ~ Hair + Eye + Sex", data = "df3m"),
    loglm_out(loglm(Freq ~ Hair + Eye + Sex, data = df3m, fitted = TRUE))))
# anova
g0 <- loglm(~ Hair + Eye + Sex, data = t3); g1 <- loglm(~ Hair * Eye + Sex, data = t3); g2 <- loglm(~ (Hair + Eye + Sex)^2, data = t3)
a <- anova(g0, g1, g2); a1 <- anova(g2)
out$anova <- list(
  list(formulas = c("~ Hair + Eye + Sex", "~ Hair * Eye + Sex", "~ (Hair + Eye + Sex)^2"), table = "t3",
       values = matrix(as.numeric(as.matrix(a)), nrow(a)), rows = rownames(a), cols = colnames(a), printed = capture.output(print(a))),
  # a single model: anova is not a matrix; its parts and the printed table are kept
  list(formulas = "~ (Hair + Eye + Sex)^2", table = "t3", parts = lapply(Filter(is.numeric, as.list(a1)), as.vector),
       printed = capture.output(print(a1))))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE),
           file.path("/out", "loglin.json"))
