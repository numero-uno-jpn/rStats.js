# multinom114-edge.R: edge cases of multinom (1.14.0), public calls only. Settles what R does with extreme scales and a
# large common offset of a covariate, extreme scales of the weights, collinear and constant columns, a response with
# many levels, a level with very few cases, a large sample, and separated data.
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
info <- function(m) list(coef = mat(coef(m)), se = mat(summary(m)$standard.errors), deviance = m$deviance,
                         convergence = m$convergence, lev = m$lev)
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

## x1 on extreme scales and with a large common offset (R converged tightly)
for (cs in list(c(1, 0), c(1e150, 0), c(1e-150, 0), c(1e300, 0), c(1e-300, 0), c(1, 1e15), c(1, 1e8))) {
  dd <- d; dd$x1 <- dd$x1 * cs[1] + cs[2]
  out[[sprintf("x_%g_%g", cs[1], cs[2])]] <- run(info(fitq(multinom(y ~ x1 + x2, data = dd, Hess = TRUE, maxit = 10000,
                                                                     reltol = 1e-16, abstol = 1e-300))))
}
## weights on extreme scales
for (sc in c(1, 1e200, 1e-200)) {
  dd <- d; dd$ws <- dd$w * sc
  out[[sprintf("w_%g", sc)]] <- run(info(fitq(multinom(y ~ x1 + x2, data = dd, weights = ws, Hess = TRUE, maxit = 10000,
                                                        reltol = 1e-16, abstol = 1e-300))))
}
## collinear and constant columns
dd <- d; dd$x3 <- 2 * dd$x1 - 1; dd$k <- 5
out$collinear <- run(info(fitq(multinom(y ~ x1 + x2 + x3, data = dd, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))))
out$constant <- run(info(fitq(multinom(y ~ x1 + k, data = dd, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))))
## a level with two cases; many levels
dd <- d; dd$y <- factor(as.character(d$y), levels = c("A", "B", "C", "D")); dd$y[c(5, 9)] <- "D"
out$rareLevel <- run(info(fitq(multinom(y ~ x1 + x2, data = dd, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))))
set.seed(11)
nm <- 400; z <- round(rnorm(nm), 3)
ym <- factor(sapply(z, function(v) { e <- c(0, 0.3 * (1:9) * v); p <- exp(e) / sum(exp(e)); sample(letters[1:10], 1, prob = p) }))
out$many <- list(y = as.character(ym), z = z,
                 fit = run(info(fitq(multinom(ym ~ z, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300)))))
## a large sample
set.seed(12)
N <- 20000; u1 <- rnorm(N); u2 <- rbinom(N, 1, 0.4)
pu <- cbind(1, exp(0.2 + 0.5 * u1), exp(-0.3 + 0.4 * u2 - 0.2 * u1)); pu <- pu / rowSums(pu)
yu <- factor(apply(pu, 1, function(p) sample(c("A", "B", "C"), 1, prob = p)))
out$big <- list(y = as.character(yu), u1 = u1, u2 = u2, seconds = system.time(
  big <- fitq(multinom(yu ~ u1 + u2, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300)))[["elapsed"]],
  fit = info(big))
## separation: iris on the sepals, and a response decided by x1
iris2 <- data.frame(y = iris$Species, sl = iris$Sepal.Length, sw = iris$Sepal.Width)
out$iris_default <- run(info(fitq(multinom(y ~ sl + sw, data = iris2, Hess = TRUE))))
d7 <- data.frame(y = factor(c(rep("A", 5), rep("B", 5), rep("C", 5))), x1 = c(1:5, 11:15, c(2, 4, 3, 1, 5) + 0.5))
out$separated <- list(data = list(y = as.character(d7$y), x1 = d7$x1),
                      fit = run(info(fitq(multinom(y ~ x1, data = d7, Hess = TRUE)))))

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
