source("/oracle/_glm.R")

# Analysis of deviance for glm, R's anova.glm (fixture glmAnova). See oracle/_glm.R for the model arguments; each
# column of x is one term, added in order (x1, x1 + x2, ...). Also:
#   test        "Chisq", "LRT", "Rao", "F", "Cp" or FALSE (omitted: R's default, which since R 4.4.0 is "Chisq"
#               when the dispersion is known and "F" otherwise)
#   dispersion  dispersion used by the tests instead of the estimate from the largest model
#   compare     models compared by anova(fit_1, fit_2, ...) instead of the sequential table: each entry lists the
#               columns of x in that model, space-separated ("" for the intercept only)
# Written for each case: colNames (R's column names, such as "Df", "Deviance", "Resid. Df", "Resid. Dev",
# "Pr(>Chi)"), rowNames ("NULL", "x1", ... for the sequential table; "1", "2", ... for compare), table (one array
# per row; NA where R leaves the cell empty) and warnings.

set.seed(20261103)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- Filter(Negate(is.null), list(...))

n <- 40
X <- cbind(rnorm(n), runif(n, -1, 1), rnorm(n))  # the third column has no effect
mu01 <- plogis(-0.3 + 0.8 * X[, 1] - 0.5 * X[, 2])
mupos <- exp(1 + 0.4 * X[, 1] - 0.3 * X[, 2])
yb <- rbinom(n, 1, mu01); yp <- rpois(n, mupos); yn <- mupos + rnorm(n, 0, 0.5)
yg <- rgamma(n, shape = 4, rate = 4 / mupos); yi <- rinvgauss(n, mupos, 5)
m <- sample(1:10, n, replace = TRUE); s <- rbinom(n, m, mu01)

data_for <- list(binomial = yb, poisson = yp, gaussian = yn, Gamma = yg, inverse.gaussian = yi,
                 quasipoisson = yp, quasibinomial = yb)
for (fam in names(data_for)) {
  lk <- if (fam == "inverse.gaussian") "log"  # the default 1/mu^2 needs starting values here
  add(x = X, y = I(data_for[[fam]]), family = fam, link = lk)
  for (tst in c("Chisq", "F", "Rao", "Cp")) add(x = X, y = I(data_for[[fam]]), family = fam, link = lk, test = tst)
}
add(x = X, y = I(yp), family = "poisson", test = "LRT")
add(x = X, y = I(yp), family = "poisson", test = FALSE)
add(x = X, y = I(yg), family = "Gamma", link = "log", test = "F")
add(x = X, y = I(yg), family = "quasi", variance = "mu^2", link = "log", test = "F")
add(x = X, y = cbind(s, m - s), family = "binomial", test = "Chisq")
add(x = X, y = I(s / m), family = "quasibinomial", weights = I(m), test = "F")
add(x = X, y = I(yg), family = "Gamma", link = "log", test = "Chisq", dispersion = 0.25)
add(x = X, y = I(yp), family = "poisson", test = "F", dispersion = 1.5)
expo <- runif(n, 1, 5); yo <- rpois(n, expo * mupos)
add(x = X, y = I(yo), family = "poisson", offset = I(log(expo)), test = "Chisq")
add(x = X, y = I(yp), family = "poisson", weights = I(runif(n, 0.5, 2)), test = "Rao")
add(x = X, y = I(yp), family = "poisson", intercept = FALSE, test = "Chisq")
add(x = X, y = I(yn), family = "gaussian", intercept = FALSE, test = "F")
add(x = cbind(X[, 1:2], X[, 1] - 2 * X[, 2], X[, 3]), y = I(yb), family = "binomial", test = "Chisq")  # aliased term
add(x = X[1:4, ], y = I(yp[1:4]), family = "poisson", test = "Chisq")    # saturated: zero residual df
add(x = X[1:4, ], y = I(yn[1:4]), family = "gaussian", test = "F")
# Comparison of nested models
for (tst in c("Chisq", "F", "Rao", "Cp"))
  add(x = X, y = I(yp), family = "poisson", test = tst, compare = I(c("", "1", "1 2 3")))
add(x = X, y = I(yg), family = "Gamma", link = "log", test = "F", compare = I(c("1", "1 2")))
add(x = X, y = I(yb), family = "binomial", test = "Chisq", compare = I(c("1 2 3", "1")))  # larger model first
add(x = X, y = I(yb), family = "binomial", compare = I(c("1", "2")))                      # not nested

write_linalg_fixture("glmAnova", cases, function(a) {
  r <- with_warnings(function() {
    extra <- list()
    if (!is.null(a$test)) extra$test <- a$test
    if (!is.null(a$dispersion)) extra$dispersion <- a$dispersion
    tab <- if (is.null(a$compare)) do.call(anova, c(list(glm_fit(a)), extra)) else {
      fits <- lapply(unclass(a$compare), function(cs) glm_fit(a, as.integer(strsplit(cs, " ")[[1]])))
      do.call(anova, c(fits, extra))
    }
    tab <- as.data.frame(tab)
    list(colNames = I(colnames(tab)), rowNames = I(rownames(tab)), table = mat_out(as.matrix(tab)))
  })
  c(r$value, list(warnings = r$warnings))
})
