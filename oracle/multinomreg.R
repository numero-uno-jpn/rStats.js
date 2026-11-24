# issue: 564
# oracle-platform: amd64
# Public outputs of nnet's multinom and its methods for test/fixtures/multinomreg.json (1.14.0). The behaviour and the
# choices are in oracle/multinom-behaviour.md. Public calls only. R is converged tightly (reltol = 1e-16,
# abstol = 1e-300, maxit = 10000): rStats.js gives the exact maximum, which R's default stopping misses by about 1e-5.
library(jsonlite)
suppressPackageStartupMessages({ library(nnet); library(MASS) })
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
out <- list(versions = c(nnet = as.character(packageVersion("nnet")), MASS = as.character(packageVersion("MASS"))))

## data sets
set.seed(20261126)
n <- 150
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.5); f <- factor(sample(c("p", "q", "r"), n, replace = TRUE))
eta2 <- -0.2 + 0.8 * x1 + 0.5 * x2 - 0.4 * (f == "q"); eta3 <- 0.3 - 0.6 * x1 + 0.3 * (f == "r")
pr <- cbind(1, exp(eta2), exp(eta3)); pr <- pr / rowSums(pr)
y <- factor(apply(pr, 1, function(p) sample(c("A", "B", "C"), 1, prob = p)))
sim <- data.frame(y = y, x1 = x1, x2 = x2, f = f, w = round(runif(n, 0.5, 2), 2))
set.seed(5)
m5 <- 200
z1 <- round(rnorm(m5), 3); z2 <- round(runif(m5, 0, 10), 2)
e <- sapply(1:4, function(k) 0.2 * k - 0.3 * k * z1 + 0.05 * (k - 2) * z2)
p5 <- cbind(1, exp(e)); p5 <- p5 / rowSums(p5)
five <- data.frame(y = factor(apply(p5, 1, function(p) sample(c("v", "w", "x", "y", "z"), 1, prob = p))), z1 = z1, z2 = z2)
# MASS's survey: smoking (4 levels) by sex, age and exercise, with missing values (rows dropped)
surv <- data.frame(y = survey$Smoke, sex = survey$Sex, age = survey$Age, exer = survey$Exer)
# iris on the sepals only: setosa is separated from the others (the maximum does not exist; for the edge cases)
iris2 <- data.frame(y = iris$Species, sl = iris$Sepal.Length, sw = iris$Sepal.Width)
house <- data.frame(y = housing$Sat, infl = housing$Infl, type = housing$Type, cont = housing$Cont, freq = housing$Freq)
out$data <- list(
  sim = lapply(sim, function(c) if (is.factor(c)) as.character(c) else c),
  five = lapply(five, function(c) if (is.factor(c)) as.character(c) else c),
  iris = lapply(iris2, function(c) if (is.factor(c)) as.character(c) else c),
  survey = lapply(surv, function(c) if (is.factor(c)) as.character(c) else c),
  housing = lapply(house, function(c) if (is.factor(c)) as.character(c) else c))
out$levels <- list(housing = list(y = levels(house$y), infl = levels(house$infl), type = levels(house$type),
                                  cont = levels(house$cont)), iris = list(y = levels(iris2$y)),
                   survey = list(y = levels(surv$y), sex = levels(surv$sex), exer = levels(surv$exer)))

tight <- function(...) fitq(multinom(..., Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
fitInfo <- function(m) {
  s <- summary(m, Wald.ratios = TRUE)
  list(coef = mat(coef(m)), se = mat(s$standard.errors), wald = mat(s$Wald.ratios), value = m$value,
       deviance = m$deviance, AIC = m$AIC, edf = m$edf, logLik = as.numeric(logLik(m)), hessian = mat(m$Hessian),
       vcov = mat(vcov(m)), lev = m$lev, fitted = mat(fitted(m)), confint = mat(confint(m)),
       confint90 = mat(confint(m, level = 0.9)), class123 = { set.seed(123); as.character(predict(m, type = "class")) },
       nextUniform = runif(1))
}
r2 <- function(m, m0, n) list(mcfadden = 1 - as.numeric(logLik(m) / logLik(m0)),
                              coxSnell = 1 - exp(2 / n * (as.numeric(logLik(m0)) - as.numeric(logLik(m)))),
                              nagelkerke = (1 - exp(2 / n * (as.numeric(logLik(m0)) - as.numeric(logLik(m))))) /
                                (1 - exp(2 / n * as.numeric(logLik(m0)))))

## the cases
cases <- list(
  sim = list(f = y ~ x1 + x2 + f, d = sim, w = NULL),
  sim_x1 = list(f = y ~ x1, d = sim, w = NULL),
  sim_w = list(f = y ~ x1 + x2 + f, d = sim, w = "w"),
  five = list(f = y ~ z1 + z2, d = five, w = NULL),
  survey = list(f = y ~ sex + age + exer, d = surv, w = NULL),
  housing = list(f = y ~ infl + type + cont, d = house, w = "freq"))
for (k in names(cases)) {
  cs <- cases[[k]]
  out[[paste0("fit_", k)]] <- run({
    # weights go in as a column of the data (multinom evaluates them there; a wrapper with ... cannot pass them)
    dd <- cs$d; dd$.w <- if (is.null(cs$w)) rep(1, nrow(dd)) else dd[[cs$w]]
    # the null model on the rows the model uses (those without missing values), n their number (rStats.js's choice;
    # ReactiveStat fits it to every row with a response and divides by nrow(data))
    dd <- dd[complete.cases(dd[, all.vars(cs$f)]), ]
    f1 <- cs$f; f0 <- update(cs$f, . ~ 1)
    m <- fitq(multinom(f1, data = dd, weights = .w, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
    m0 <- fitq(multinom(f0, data = dd, weights = .w, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
    c(fitInfo(m), list(null = list(deviance = m0$deviance, logLik = as.numeric(logLik(m0))), r2 = r2(m, m0, nrow(dd))))
  })
}
# iris (separated): R stops at maxit = 10000 or earlier
out$separated_iris <- run({ m <- tight(y ~ sl + sw, data = iris2); list(coef = mat(coef(m)), deviance = m$deviance, convergence = m$convergence) })
# R's default stopping, for the record of the difference
out$default_sim <- run({ m <- fitq(multinom(y ~ x1 + x2 + f, data = sim, Hess = TRUE)); list(coef = mat(coef(m)), deviance = m$deviance) })
# decay
for (dec in c(0.01, 0.5)) out[[sprintf("decay_%g", dec)]] <- run(fitInfo(tight(y ~ x1 + x2 + f, data = sim, decay = dec)))
# two levels
sim2 <- sim; sim2$y <- factor(ifelse(sim$y == "A", "A", "notA"))
out$twoLevel <- run(fitInfo(tight(y ~ x1 + x2 + f, data = sim2)))
# predict with newdata
out$predict_new <- run({
  m <- tight(y ~ x1 + x2 + f, data = sim)
  nd <- data.frame(x1 = c(-1, 0, 1.5, 2), x2 = c(0, 1, 1, 0), f = factor(c("p", "q", "r", "q"), levels = c("p", "q", "r")))
  list(probs = mat(predict(m, newdata = nd, type = "probs")), class = as.character(predict(m, newdata = nd, type = "class")),
       newdata = lapply(nd, function(c) if (is.factor(c)) as.character(c) else c)) })
# anova of nested models (given in any order)
out$anova <- run({
  m0 <- tight(y ~ 1, data = sim); m1 <- tight(y ~ x1, data = sim); m2 <- tight(y ~ x1 + x2 + f, data = sim)
  a <- anova(m2, m0, m1); list(cols = names(a), rows = lapply(a, function(c) if (is.factor(c)) as.character(c) else c)) })
out$anova_housing <- run({
  m1 <- fitq(multinom(y ~ infl, data = house, weights = freq, Hess = TRUE, maxit = 10000, reltol = 1e-16, abstol = 1e-300))
  m2 <- fitq(multinom(y ~ infl + type + cont, data = house, weights = freq, Hess = TRUE, maxit = 10000, reltol = 1e-16,
                      abstol = 1e-300))
  a <- anova(m1, m2); list(cols = names(a), rows = lapply(a, function(c) if (is.factor(c)) as.character(c) else c)) })
# inputs R rejects or warns about
out$err_one_level <- run(fitInfo(tight(y ~ x1, data = data.frame(y = factor(rep("A", 10)), x1 = 1:10))))
out$warn_unused <- run({ d <- sim; d$y <- factor(as.character(sim$y), levels = c("A", "B", "C", "D")); m <- tight(y ~ x1, data = d)
  list(lev = m$lev, deviance = m$deviance) })
out$missing <- run({ d <- sim; d$x1[c(3, 7)] <- NA; m <- tight(y ~ x1 + x2, data = d); list(n = nrow(fitted(m)), deviance = m$deviance) })
out$numeric_response <- run({ d <- sim; d$y <- as.integer(sim$y); m <- tight(y ~ x1, data = d); list(lev = m$lev, coef = mat(coef(m))) })

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE),
           file.path("/out", "multinomreg.json"))
