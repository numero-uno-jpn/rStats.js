# issue: 545
# Public-output probes for quantile-regression inference (no implementation inspection).
suppressMessages(library(quantreg))
library(jsonlite)

data(engel)
n <- nrow(engel)
tau <- 0.5
fit <- rq(foodexp ~ income, tau = tau, data = engel, method = "br")
h.hs <- bandwidth.rq(tau, n, hs = TRUE)
h.bofinger <- bandwidth.rq(tau, n, hs = FALSE)
fit.lo <- rq(foodexp ~ income, tau = tau - h.hs, data = engel, method = "br")
fit.hi <- rq(foodexp ~ income, tau = tau + h.hs, data = engel, method = "br")
r <- residuals(fit)
f.lo <- fitted(fit.lo)
f.hi <- fitted(fit.hi)

tab <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.matrix(x) || is.data.frame(x)) {
    return(list(rows = rownames(x), cols = colnames(x), values = unname(as.matrix(x))))
  }
  x
}
capture <- function(expr) {
  warnings <- character()
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) list(error = conditionMessage(e))),
    warning = function(w) { warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  list(value = value, warnings = warnings)
}

out <- list(
  bandwidth = list(hs = h.hs, bofinger = h.bofinger),
  iid = capture({
    s <- summary(fit, se = "iid", covariance = TRUE)
    list(table = tab(coef(s)), cov = s$cov)
  }),
  nid = capture({
    s <- summary(fit, se = "nid", covariance = TRUE)
    list(table = tab(coef(s)), cov = s$cov, Hinv = s$Hinv, J = s$J)
  }),
  ker = capture({
    s <- summary(fit, se = "ker", covariance = TRUE)
    list(table = tab(coef(s)), cov = s$cov, Hinv = s$Hinv, J = s$J)
  }),
  rank = capture(list(
    iid = tab(coef(summary(fit, se = "rank", alpha = 0.05))),
    noniid = tab(coef(summary(fit, se = "rank", iid = FALSE, alpha = 0.05))),
    alpha10 = tab(coef(summary(fit, se = "rank", alpha = 0.1)))
  )),
  densityProbes = list(
    tauMinus = tau - h.hs,
    tauPlus = tau + h.hs,
    betaMinus = coef(fit.lo),
    betaPlus = coef(fit.hi),
    fittedMinus = f.lo,
    fittedPlus = f.hi,
    residualQuantilesType1 = quantile(r, c(tau - h.hs, tau + h.hs), type = 1),
    residualQuantilesType7 = quantile(r, c(tau - h.hs, tau + h.hs), type = 7),
    residuals = r
  )
)

X <- cbind(1, engel$income)
for (method in c("xy", "pwy", "mcmb", "wxy")) {
  set.seed(1)
  out[[paste0("boot_", method)]] <- capture({
    z <- boot.rq(X, engel$foodexp, tau = tau, R = 5, bsmethod = method)
    list(B = z$B, U = z$U)
  })
}

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
