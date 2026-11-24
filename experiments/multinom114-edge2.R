# multinom114-edge2.R: the second round of edge cases of multinom (1.14.0), public calls only. Settles what R does with
# decay together with scaled or offset covariates, rows of weight zero, quasi-complete and complete separation, a model
# with many coefficients, and the intercept's standard error when a covariate has a common offset.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages(library(nnet))
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
mat <- function(m) if (is.null(m)) NULL else list(dim = dim(m), dimnames = dimnames(m), values = as.vector(as.matrix(m)))
fitq <- function(e) { r <- NULL; invisible(capture.output(r <- e)); r }
info <- function(m) list(coef = mat(coef(m)), se = mat(summary(m)$standard.errors), deviance = m$deviance, AIC = m$AIC,
                         edf = m$edf, convergence = m$convergence, n = nrow(fitted(m)), lev = m$lev)
out <- list(R = R.version.string, arch = R.version$arch)

set.seed(20261126)
n <- 150
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.5)
eta2 <- -0.2 + 0.8 * x1 + 0.5 * x2; eta3 <- 0.3 - 0.6 * x1
pr <- cbind(1, exp(eta2), exp(eta3)); pr <- pr / rowSums(pr)
y <- factor(apply(pr, 1, function(p) sample(c("A", "B", "C"), 1, prob = p)))
w <- round(runif(n, 0.5, 2), 2)
d <- data.frame(y = y, x1 = x1, x2 = x2, w = w)
out$data <- list(y = as.character(y), x1 = x1, x2 = x2, w = w)
tight <- function(dd, f, ...) fitq(multinom(f, data = dd, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300, ...))

## decay with a scaled or offset covariate (the penalty is on the original coefficients)
for (cs in list(c(1, 0), c(1e3, 0), c(1e-3, 0), c(1, 100), c(1, 1e4))) {
  dd <- d; dd$x1 <- dd$x1 * cs[1] + cs[2]
  out[[sprintf("decay_x%g_off%g", cs[1], cs[2])]] <- run(info(tight(dd, y ~ x1 + x2, decay = 0.1)))
}
## the intercept's standard error with an offset covariate (no decay)
for (off in c(0, 100, 1e4)) {
  dd <- d; dd$x1 <- dd$x1 + off
  out[[sprintf("off_%g", off)]] <- run(c(info(tight(dd, y ~ x1 + x2)),
    list(vcov = mat(vcov(tight(dd, y ~ x1 + x2))))))
}
## rows of weight zero
dd <- d; dd$wz <- dd$w; dd$wz[c(2, 5, 11, 40)] <- 0
out$zeroWeights <- run({ m <- fitq(multinom(y ~ x1 + x2, data = dd, weights = wz, Hess = TRUE, maxit = 10000,
                                            reltol = 1e-16, abstol = 1e-300))
  m0 <- fitq(multinom(y ~ 1, data = dd, weights = wz, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
  c(info(m), list(nullLogLik = as.numeric(logLik(m0)), fittedRows = nrow(fitted(m)),
                  class = { set.seed(3); as.character(predict(m, type = "class")) })) })
## quasi-complete separation: level C only where x1 > 1, A and B overlap elsewhere
d3 <- d; d3$y <- factor(ifelse(d$x1 > 1, "C", ifelse(d$y == "C", "A", as.character(d$y))))
out$quasi <- list(y = as.character(d3$y), fit = run(info(tight(d3, y ~ x1 + x2))),
                  default = run(info(fitq(multinom(y ~ x1 + x2, data = d3, Hess = TRUE)))))
## iris on the sepals (setosa separated)
iris2 <- data.frame(y = iris$Species, sl = iris$Sepal.Length, sw = iris$Sepal.Width)
out$iris <- list(data = lapply(iris2, function(c) if (is.factor(c)) as.character(c) else c),
                 fit = run(info(fitq(multinom(y ~ sl + sw, data = iris2, Hess = TRUE)))))
## many coefficients: ten levels, twenty predictors, n = 3000
set.seed(21)
N <- 3000; P <- 20
X <- matrix(round(rnorm(N * P), 3), N, P); colnames(X) <- paste0("v", 1:P)
B <- matrix(round(rnorm(9 * P, 0, 0.3), 2), 9, P)
E <- cbind(0, X %*% t(B)); PR <- exp(E - apply(E, 1, max)); PR <- PR / rowSums(PR)
yy <- factor(apply(PR, 1, function(p) sample(letters[1:10], 1, prob = p)))
dm <- data.frame(y = yy, X)
fm <- as.formula(paste("y ~", paste(colnames(X), collapse = " + ")))
out$many <- list(y = as.character(yy), X = lapply(seq_len(P), function(j) X[, j]),
                 seconds = system.time(mm <- fitq(multinom(fm, data = dm, Hess = TRUE, maxit = 10000, reltol = 1e-16,
                                                           abstol = 1e-300, MaxNWts = 10000)))[["elapsed"]],
                 fit = info(mm))

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
