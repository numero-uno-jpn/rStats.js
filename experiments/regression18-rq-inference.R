# issue: 545
# One compact public-output experiment for unresolved rq inference formulae.
suppressMessages(library(quantreg))
library(jsonlite)

tab <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.matrix(x) || is.data.frame(x)) return(list(rows = rownames(x), cols = colnames(x), values = unname(as.matrix(x))))
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

data(engel)
n <- nrow(engel)
tau <- 0.5
fit <- rq(foodexp ~ income, tau = tau, data = engel, method = "br")
h.hs <- bandwidth.rq(tau, n, hs = TRUE)
h.bofinger <- bandwidth.rq(tau, n, hs = FALSE)
s.iid <- summary(fit, se = "iid", covariance = TRUE)
s.iid.b <- summary(fit, se = "iid", covariance = TRUE, hs = FALSE)
s.nid <- summary(fit, se = "nid", covariance = TRUE)
s.ker <- summary(fit, se = "ker", covariance = TRUE)
s.rank <- summary(fit, se = "rank", alpha = 0.05)
s.rank.noniid <- summary(fit, se = "rank", iid = FALSE, alpha = 0.05)
s.rank.10 <- summary(fit, se = "rank", alpha = 0.1)

small <- data.frame(
  x = -3:12,
  y = c(2, 1, 4, 2, 5, 3, 8, 5, 9, 7, 11, 8, 14, 10, 15, 13)
)
small.fit <- rq(y ~ x, data = small, tau = tau, method = "br")
small.res <- residuals(small.fit)
small.nonzero <- small.res[abs(small.res) > 1e-8]
small.hs <- bandwidth.rq(tau, nrow(small), hs = TRUE)
small.iid <- summary(small.fit, se = "iid", covariance = TRUE)
small.iid.b <- summary(small.fit, se = "iid", covariance = TRUE, hs = FALSE)
small.nid <- summary(small.fit, se = "nid", covariance = TRUE)
small.ker <- summary(small.fit, se = "ker", covariance = TRUE)
small.rank <- summary(small.fit, se = "rank", alpha = 0.05)
small.rank.noniid <- summary(small.fit, se = "rank", iid = FALSE, alpha = 0.05)
small.fit.lo <- rq(y ~ x, data = small, tau = tau - small.hs, method = "br")
small.fit.hi <- rq(y ~ x, data = small, tau = tau + small.hs, method = "br")
small.qlo <- lapply(1:9, function(type) quantile(small.nonzero, tau - small.hs, type = type))
small.qhi <- lapply(1:9, function(type) quantile(small.nonzero, tau + small.hs, type = type))
small.density <- function(v, bw) {
  d <- density(v, bw = bw)
  approx(d$x, d$y, xout = 0)$y
}
small.probes <- list(
  residuals = small.res,
  nonzeroResiduals = small.nonzero,
  bandwidth = small.hs,
  betaMinus = coef(small.fit.lo),
  betaPlus = coef(small.fit.hi),
  fittedMinus = fitted(small.fit.lo),
  fittedPlus = fitted(small.fit.hi),
  iid = list(table = tab(coef(small.iid)), cov = small.iid$cov, scale = small.iid$scale, residuals = small.iid$residuals, names = names(small.iid)),
  iidBofinger = list(table = tab(coef(small.iid.b)), cov = small.iid.b$cov, scale = small.iid.b$scale),
  nid = list(table = tab(coef(small.nid)), cov = small.nid$cov, Hinv = small.nid$Hinv, J = small.nid$J, scale = small.nid$scale),
  ker = list(table = tab(coef(small.ker)), cov = small.ker$cov, Hinv = small.ker$Hinv, J = small.ker$J, scale = small.ker$scale),
  rank = tab(coef(small.rank)),
  rankNoniid = tab(coef(small.rank.noniid)),
  quantileTypeLower = small.qlo,
  quantileTypeUpper = small.qhi,
  densityNrd = small.density(small.nonzero, "nrd"),
  densityNrd0 = small.density(small.nonzero, "nrd0"),
  densityAllNrd = small.density(small.res, "nrd"),
  densityAllNrd0 = small.density(small.res, "nrd0")
)

Xsmall <- model.matrix(y ~ x, small)
bootProbes <- list()
for (method in c("xy", "pwy", "mcmb", "wxy")) {
  set.seed(1)
  raw <- switch(
    method,
    xy = sample.int(nrow(small), nrow(small) * 4, replace = TRUE),
    pwy = runif(nrow(small) * 4),
    mcmb = rnorm(nrow(small) * 4),
    wxy = rexp(nrow(small) * 4, rate = 1)
  )
  set.seed(1)
  bootProbes[[method]] <- capture({
    b <- boot.rq(Xsmall, small$y, tau = tau, R = 4, bsmethod = method)
    list(B = b$B, U = b$U, rawDraws = raw, seedIndex = .Random.seed[1])
  })
}

out <- list(
  bandwidth = list(hs = h.hs, bofinger = h.bofinger),
  engel = list(
    coef = coef(fit),
    iid = list(table = tab(coef(s.iid)), cov = s.iid$cov, scale = s.iid$scale, names = names(s.iid)),
    iidBofinger = list(table = tab(coef(s.iid.b)), cov = s.iid.b$cov, scale = s.iid.b$scale),
    nid = list(table = tab(coef(s.nid)), cov = s.nid$cov, Hinv = s.nid$Hinv, J = s.nid$J, scale = s.nid$scale, names = names(s.nid)),
    ker = list(table = tab(coef(s.ker)), cov = s.ker$cov, Hinv = s.ker$Hinv, J = s.ker$J, names = names(s.ker)),
    rank = tab(coef(s.rank)),
    rankNoniid = tab(coef(s.rank.noniid)),
    rankAlpha10 = tab(coef(s.rank.10)),
    residuals = residuals(fit)
  ),
  small = small.probes,
  bootstrap = bootProbes
)
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
