# mediation116-edge2.R: the second pass over mediate's edges (1.16.0), public functions only. A binary mediator
# separated by a covariate (glm does not converge), sims = 1 and 2 with the bootstrap, robustSE with the bootstrap, a
# logit outcome on scales x 1e+-150, a covariate value for a variable not in the models, a factor treatment, a rare
# factor level that resamples lose, a total effect near 0 (proportions), sims = 1 quasi-Bayes, conf.level near 0 and 1,
# and mvrnorm with n = 0, a nonsymmetric Sigma and a semi-definite one. Results for test/mediationEdge.test.ts.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch)
set.seed(1162)
n <- 50
C <- rnorm(n); X <- rbinom(n, 1, 0.5); Xf <- factor(ifelse(X == 1, "t", "c"))
Ms <- as.integer(C > 0)                                   # separated by C
M <- 0.6 * X + 0.3 * C + rnorm(n)
Y <- 0.5 * M + 0.4 * X + 0.2 * C + rnorm(n)
Ybin <- rbinom(n, 1, plogis(-0.3 + 0.8 * M + 0.5 * X))
Yt <- 0.5 * M - 0.3 * X + rnorm(n)                        # total effect near 0
R3 <- factor(c("r", rep("s", n - 1)))                     # a level with one row
d <- data.frame(C, X, Xf, Ms, M, Y, Ybin, Yt, R3)
assign("d", d, envir = globalenv())
out$data <- list(C = C, X = X, Xf = as.character(Xf), Ms = Ms, M = M, Y = Y, Ybin = Ybin, Yt = Yt, R3 = as.character(R3))
keys <- c("d0", "d1", "z0", "z1", "tau", "n0", "n1", "d.avg", "z.avg", "n.avg")
grab <- function(r) { o <- list(); for (k in keys) { pk <- if (k == "tau") "tau.coef" else k; sk <- if (k == "tau") "tau" else k
  o[[k]] <- list(est = r[[pk]], ci = unname(r[[paste0(k, ".ci")]]), p = r[[paste0(k, ".p")]], sims = as.vector(r[[paste0(sk, ".sims")]])) }; o }
med <- function(fm, fy, treat = "X", ...) { set.seed(1234); r <- run(mediate(fm, fy, treat = treat, mediator = names(model.frame(fm))[1], ...))
  if (!is.null(r$error)) return(r); list(result = grab(r$value), warnings = r$warnings) }

fs <- run(glm(Ms ~ X + C, family = binomial, data = d))
out$separation_fit <- list(coef = unname(coef(fs$value)), converged = fs$value$converged, iter = fs$value$iter, warnings = fs$warnings)
out$separation <- med(fs$value, lm(Y ~ X + Ms + C, data = d), sims = 100)
out$boot_sims1 <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), boot = TRUE, sims = 1)
out$boot_sims2 <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), boot = TRUE, sims = 2)
out$quasi_sims1 <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), sims = 1)
out$boot_robust <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), boot = TRUE, sims = 30, robustSE = TRUE)
out$logit_scales <- lapply(c(1e-150, 1e150), function(s) {
  dd <- transform(d, M = M * s, C = C * s); assign("dd", dd, envir = globalenv())
  list(s = s, quasi = med(lm(M ~ X + C, data = dd), glm(Ybin ~ X + M + C, family = binomial, data = dd), sims = 100),
       boot = med(lm(M ~ X + C, data = dd), glm(Ybin ~ X + M + C, family = binomial, data = dd), boot = TRUE, sims = 30))
})
out$covariate_absent <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), covariates = list(C = 1), sims = 50)
out$factor_treat <- med(lm(M ~ Xf, data = d), lm(Y ~ Xf + M, data = d), treat = "Xf", sims = 50)
out$rare_level_boot <- med(lm(M ~ X + R3, data = d), lm(Y ~ X + M, data = d), boot = TRUE, sims = 30)
out$tau_near_zero <- med(lm(M ~ X, data = d), lm(Yt ~ X + M, data = d), sims = 200)
out$conf_tiny <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), sims = 100, conf.level = 0.001)
out$conf_huge <- med(lm(M ~ X, data = d), lm(Y ~ X + M, data = d), sims = 100, conf.level = 0.999)
set.seed(42); out$mvrnorm_n0 <- run(mvrnorm(0, c(0, 0), diag(2)))
set.seed(42); out$mvrnorm_nonsym <- run(mvrnorm(3, c(0, 0), matrix(c(2, 0.5, 0.9, 1), 2)))   # lower 0.5, upper 0.9
set.seed(42); out$mvrnorm_semidef <- run(mvrnorm(3, c(0, 0, 0), tcrossprod(c(1, 2, 3))))
set.seed(42); out$mvrnorm_neg_tol <- run(mvrnorm(2, c(0, 0), matrix(c(1, 1 + 1e-9, 1 + 1e-9, 1), 2)))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", pretty = FALSE))
