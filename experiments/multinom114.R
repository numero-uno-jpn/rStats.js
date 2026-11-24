# multinom114.R: nnet's multinom and its methods on small data, public functions only (1.14.0). Settles: how far R's
# default stopping is from the maximum, what Hess = TRUE holds (and with decay), the parts of summary(Wald = TRUE),
# confint, logLik's df, AIC, anova of nested models, predict (probabilities, classes and their ties), case weights,
# decay, a two-level response, and the errors and warnings.
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
# multinom prints its iterations; each fit is made inside capture.output, which drops them (its argument for that shares
# a name the checker keeps out, and a wrapper with ... breaks multinom's own evaluation of weights)
q <- function(e) invisible(capture.output(e))
fitq <- function(e) { r <- NULL; invisible(capture.output(r <- e)); r }
mat <- function(m) if (is.null(m)) NULL else list(dim = dim(m), dimnames = dimnames(m), values = as.vector(as.matrix(m)))
out <- list(R = R.version.string, arch = R.version$arch, nnet = as.character(packageVersion("nnet")))

## data: 150 subjects, a continuous, a binary and a 3-level factor predictor, a 3-level response from a multinomial logit
set.seed(20261126)
n <- 150
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.5); f <- factor(sample(c("p", "q", "r"), n, replace = TRUE))
eta2 <- -0.2 + 0.8 * x1 + 0.5 * x2 - 0.4 * (f == "q"); eta3 <- 0.3 - 0.6 * x1 + 0.3 * (f == "r")
pr <- cbind(1, exp(eta2), exp(eta3)); pr <- pr / rowSums(pr)
y <- factor(apply(pr, 1, function(p) sample(c("A", "B", "C"), 1, prob = p)))
w <- round(runif(n, 0.5, 2), 2)
d <- data.frame(y = y, x1 = x1, x2 = x2, f = f, w = w)
out$data <- list(y = as.character(y), x1 = x1, x2 = x2, f = as.character(f), w = w)

fitInfo <- function(m) list(coef = mat(coef(m)), value = m$value, deviance = m$deviance, AIC = m$AIC, edf = m$edf,
  convergence = m$convergence, logLik = as.numeric(logLik(m)), logLikDf = attr(logLik(m), "df"),
  hessian = mat(m$Hessian), vcov = mat(vcov(m)), lev = m$lev, fitted = mat(fitted(m)), weightsOut = m$weights,
  decay = m$decay, censored = m$censored)
out$default <- run(fitInfo(fitq(multinom(y ~ x1 + x2 + f, data = d, Hess = TRUE))))
out$tight <- run(fitInfo(fitq(multinom(y ~ x1 + x2 + f, data = d, Hess = TRUE, maxit = 10000,
                                  reltol = 1e-16, abstol = 1e-300))))
q(mt <- multinom(y ~ x1 + x2 + f, data = d, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
s <- summary(mt, Wald.ratios = TRUE)
out$summary <- list(coefficients = mat(s$coefficients), standard.errors = mat(s$standard.errors),
                    Wald.ratios = mat(s$Wald.ratios), names = names(s))
out$confint <- run(mat(confint(mt)))
out$confint90 <- run(mat(confint(mt, level = 0.9)))
# the null model, the pseudo R² of ReactiveStat, anova
q(m0 <- multinom(y ~ 1, data = d, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
q(m1 <- multinom(y ~ x1, data = d, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
out$null <- run(fitInfo(m0))
out$anova <- run({ a <- anova(m0, m1, mt); list(cols = names(a), rows = lapply(a, function(c) if (is.factor(c)) as.character(c) else c)) })
out$anova2 <- run({ a <- anova(mt, m1); list(cols = names(a), rows = lapply(a, function(c) if (is.factor(c)) as.character(c) else c)) })
# predict: probabilities, classes, newdata
nd <- data.frame(x1 = c(-1, 0, 1.5), x2 = c(0, 1, 1), f = factor(c("p", "q", "r"), levels = levels(f)))
out$predict <- run(list(probs = mat(predict(mt, type = "probs")), class = as.character(predict(mt, type = "class")),
                        newProbs = mat(predict(mt, newdata = nd, type = "probs")),
                        newClass = as.character(predict(mt, newdata = nd, type = "class"))))
# ties of the predicted probabilities: an intercept-only model with equal counts; the random numbers used
tie <- data.frame(y = factor(rep(c("A", "B", "C"), each = 4)))
q(mtie <- multinom(y ~ 1, data = tie, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
set.seed(1); before <- .Random.seed
cls <- as.character(predict(mtie, type = "class"))
out$ties <- list(probs = mat(predict(mtie, type = "probs")), class = cls, randomUsed = !identical(before, .Random.seed),
                 classAgain = { set.seed(2); as.character(predict(mtie, type = "class")) })
# case weights (non-integer)
out$weights <- run(fitInfo(fitq(multinom(y ~ x1 + x2 + f, data = d, weights = w, Hess = TRUE, maxit = 10000,
                                    reltol = 1e-16, abstol = 1e-300))))
out$weightsSummary <- run({ m <- fitq(multinom(y ~ x1 + x2 + f, data = d, weights = w, Hess = TRUE,
                                          maxit = 10000, reltol = 1e-16, abstol = 1e-300))
  list(se = mat(summary(m)$standard.errors)) })
# decay
for (dec in c(0.1, 1)) {
  out[[sprintf("decay_%g", dec)]] <- run(fitInfo(fitq(multinom(y ~ x1 + x2 + f, data = d, decay = dec,
    Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))))
}
# a two-level response, and the binomial glm
d2 <- d; d2$y2 <- factor(ifelse(d$y == "A", "A", "notA"))
out$twoLevel <- run(c(fitInfo(fitq(multinom(y2 ~ x1 + x2 + f, data = d2, Hess = TRUE, maxit = 10000,
                                       reltol = 1e-16, abstol = 1e-300))),
                      list(glm = unname(coef(glm(y2 ~ x1 + x2 + f, data = d2, family = binomial()))))))
# four levels, one of them unused; numeric response; a single level; missing values
d4 <- d; d4$y4 <- factor(as.character(d$y), levels = c("A", "B", "C", "D"))
out$unusedLevel <- run(fitInfo(fitq(multinom(y4 ~ x1, data = d4, Hess = TRUE))))
d5 <- d; d5$yn <- as.integer(d$y)
out$numericResponse <- run(list(lev = fitq(multinom(yn ~ x1, data = d5))$lev))
out$oneLevel <- run(fitInfo(fitq(multinom(factor(rep("A", 10)) ~ seq_len(10)))))
d6 <- d; d6$x1[c(3, 7)] <- NA
out$missing <- run({ m <- fitq(multinom(y ~ x1 + x2, data = d6)); list(n = nrow(fitted(m)), deviance = m$deviance) })
# separation: x1 decides B against the others
d7 <- data.frame(y = factor(c(rep("A", 5), rep("B", 5), rep("C", 5))), x1 = c(1:5, 11:15, c(2, 4, 3, 1, 5) + 0.5))
out$separation <- run(fitInfo(fitq(multinom(y ~ x1, data = d7, Hess = TRUE))))

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
