source("/oracle/_robust.R")

# Tests and intervals of coefficients with a given covariance: lmtest::coeftest(fit, vcov., df, ...) and
# lmtest::coefci(fit, parm, level, vcov., df, ...) for lm and glm fits (fixtures coeftest and coefci). Behaviour in
# oracle/robust-behaviour.md. Model arguments as in oracle/_robust.R, and:
#   vcov       absent: vcov. = NULL (the fit's own vcov()); a matrix (rows) with vcovNames as its dimnames (absent: no
#              dimnames); or the name of a function, "vcovHC" or "vcovCL", called by lmtest as vcov.(fit, ...) with
#              vcovArgs (an object: type, cluster, cadjust, ...)
#   df         absent: the method's default (lm: df.residual; glm: Inf); a number (Inf, 0 and negative values included)
#   level, parm   coefci only (parm: 1-based indices or coefficient names)
# Written: coeftest: table (rows of Estimate, Std. Error, t or z value, p-value), rowNames, colNames, method, df (the
# df attribute), nobs; coefci: lower, upper, rowNames, colNames. Both with warnings. Errors as {"error": message}.

set.seed(20261112)
n <- 36
X <- cbind(rnorm(n), runif(n, -1, 1))
g <- rep(1:9, each = 4)
yl <- drop(1 + X %*% c(0.8, -0.6) + rnorm(n) * (1 + abs(X[, 1])))
ypois <- rpois(n, exp(0.5 + 0.4 * X[, 1]))
yqp <- rnbinom(n, mu = exp(0.8 + 0.3 * X[, 1]), size = 1.5)
ybin <- rbinom(n, 1, plogis(0.2 + X[, 1]))
M <- list(
  lm = list(model = "lm", x = X, y = I(yl)),
  lmw = list(model = "lm", x = X, y = I(yl), weights = I(round(runif(n, 0.5, 2), 3))),
  lmalias = list(model = "lm", x = cbind(X, 2 * X[, 1]), y = I(yl)),
  pois = list(model = "glm", x = X, y = I(ypois), family = "poisson"),
  qp = list(model = "glm", x = X, y = I(yqp), family = "quasipoisson"),
  gau = list(model = "glm", x = X, y = I(yl), family = "gaussian"),
  bin = list(model = "glm", x = X, y = I(ybin), family = "binomial"),
  galias = list(model = "glm", x = cbind(X, X[, 1] + X[, 2]), y = I(ypois), family = "poisson"))
VCOVS <- list(
  list(),
  list(vcovFun = "vcovHC"),
  list(vcovFun = "vcovHC", vcovArgs = list(type = "HC0")),
  list(vcovFun = "vcovCL", vcovArgs = list(cluster = I(g))),
  list(vcovFun = "vcovCL", vcovArgs = list(cluster = I(g), type = "HC1", cadjust = FALSE)),
  list(vcovHCMatrix = "HC1"))   # turned into a matrix argument below
DFS <- list(NULL, Inf, 0, 5, -1)

# a matrix argument from vcovHC (with its dimnames)
as_matrix_case <- function(a, type) {
  V <- vcovHC(robust_fit(a), type = type)
  a$vcov <- V; a$vcovNames <- I(rownames(V)); a
}
build <- function(extra) {
  cs <- list()
  for (m in names(M)) for (v in VCOVS) for (df in DFS) {
    a <- c(M[[m]], v[setdiff(names(v), "vcovHCMatrix")], extra)
    if (!is.null(df)) a$df <- df
    if (!is.null(v$vcovHCMatrix)) a <- as_matrix_case(a, v$vcovHCMatrix)
    cs[[length(cs) + 1]] <- a
  }
  cs
}

# the vcov. argument of the case
vcov_arg <- function(a) {
  if (!is.null(a$vcovFun)) return(get(a$vcovFun))
  if (is.null(a$vcov)) return(NULL)
  V <- a$vcov
  if (is.list(V)) V <- do.call(rbind, lapply(V, as.numeric))
  V <- unname(as.matrix(V))
  if (!is.null(a$vcovNames)) dimnames(V) <- list(unclass(a$vcovNames), unclass(a$vcovNames))
  V
}
call_args <- function(a, fit) {
  args <- list(fit, vcov. = vcov_arg(a))
  if (!is.null(a$df)) args$df <- a$df
  if (!is.null(a$vcovArgs)) args <- c(args, lapply(a$vcovArgs, function(v) if (inherits(v, "AsIs")) unclass(v) else v))
  args
}

# ---- coeftest
ct_cases <- build(list())
ct_add <- function(...) ct_cases[[length(ct_cases) + 1]] <<- list(...)
# a covariance matrix without dimnames (used by position), in another order (matched by name), with names for a
# subset of the coefficients only, and with a negative variance
Vlm <- vcovHC(robust_fit(M$lm), type = "HC0")
ct_add(model = "lm", x = X, y = I(yl), vcov = unname(Vlm))
ct_add(model = "lm", x = X, y = I(yl), vcov = Vlm[3:1, 3:1], vcovNames = I(rownames(Vlm)[3:1]))
ct_add(model = "lm", x = X, y = I(yl), vcov = Vlm[2:3, 2:3], vcovNames = I(rownames(Vlm)[2:3]))
ct_add(model = "lm", x = X, y = I(yl), vcov = diag(c(1, -1, 2)), vcovNames = I(rownames(Vlm)))
# realistic uses: modified Poisson (infert), the difference-in-differences of vcovcl.R in short
ix <- cbind(infert$spontaneous, infert$induced, infert$age)
ct_add(model = "glm", x = ix, y = I(infert$case), family = "poisson", vcovFun = "vcovHC", vcovArgs = list(type = "HC0"))
ct_add(model = "glm", x = ix, y = I(infert$case), family = "poisson", vcovFun = "vcovCL", vcovArgs = list(cluster = I(infert$stratum)))

write_htest_fixture("coeftest", ct_cases, function(a) {
  f <- fit_with_warnings(a)
  r <- with_warnings(function() do.call(coeftest, call_args(a, f$value)))
  ct <- r$value
  list(table = mat_out(unclass(ct)[, 1:4, drop = FALSE]), rowNames = I(rownames(ct)), colNames = I(colnames(ct)),
       method = attr(ct, "method"), df = num2str(attr(ct, "df")), nobs = num2str(attr(ct, "nobs")),
       warnings = r$warnings, fitWarnings = f$warnings)
})

# ---- coefci
ci_cases <- build(list())
ci_add <- function(...) ci_cases[[length(ci_cases) + 1]] <<- list(...)
for (lv in c(0.9, 0.99, 0.999, 0.9995, 0.5, 0.123456, 1, 0, 1.5)) {
  ci_add(model = "lm", x = X, y = I(yl), level = lv, vcovFun = "vcovHC")
  ci_add(model = "glm", x = X, y = I(yqp), family = "quasipoisson", level = lv, vcovFun = "vcovHC", vcovArgs = list(type = "HC0"))
}
ci_add(model = "lm", x = X, y = I(yl), parm = I(c(3, 1)), vcovFun = "vcovHC")
ci_add(model = "lm", x = X, y = I(yl), parm = I(c("x2", "(Intercept)")), vcovFun = "vcovHC")
ci_add(model = "lm", x = X, y = I(yl), parm = I(4), vcovFun = "vcovHC")                 # out of range: R's error
ci_add(model = "lm", x = X, y = I(yl), parm = I("zz"), vcovFun = "vcovHC")              # unknown name: no rows
ci_add(model = "lm", x = cbind(X, 2 * X[, 1]), y = I(yl), parm = I("x3"))               # an aliased coefficient
ci_add(model = "lm", x = cbind(X, 2 * X[, 1]), y = I(yl), parm = I("x3"), vcovFun = "vcovHC")
ci_add(model = "lm", x = X, y = I(yl), vcov = unname(Vlm))
ci_add(model = "lm", x = X, y = I(yl), vcov = Vlm[3:1, 3:1], vcovNames = I(rownames(Vlm)[3:1]))
ci_add(model = "glm", x = ix, y = I(infert$case), family = "poisson", vcovFun = "vcovCL", vcovArgs = list(cluster = I(infert$stratum)))

write_htest_fixture("coefci", ci_cases, function(a) {
  f <- fit_with_warnings(a)
  args <- call_args(a, f$value)
  if (!is.null(a$level)) args$level <- a$level
  if (!is.null(a$parm)) args$parm <- unclass(a$parm)
  r <- with_warnings(function() do.call(coefci, args))
  ci <- r$value
  list(lower = vec_out(ci[, 1]), upper = vec_out(ci[, 2]), rowNames = I(rownames(ci) %||% character(0)),
       colNames = I(colnames(ci)), warnings = r$warnings, fitWarnings = f$warnings)
})
