# issue: 565
# Public outputs of stats' glm with a formula and a data frame, for test/fixtures/glmformula.json (1.15.0: the formula
# interface that step needs). The matrix interface is checked by oracle/glm.R; this checks the formula's model matrix
# (factors, interactions, no intercept, aliased columns), the response forms (0/1, a factor, cbind(successes,
# failures), proportions with weights), weights and an offset given as columns, and the rows dropped for missing values.
# Written for each case: the data set, formula, family, link, the names of the weights and offset columns, and R's
# coefNames, coefficients (NA for aliased columns), deviance, nullDeviance, aic, rank, dfResidual, dfNull, iter,
# converged, fittedValues, the number of rows used and the warnings.
library(jsonlite)
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  c(value, list(warnings = warns))
}

set.seed(20261129)
n <- 60
d <- data.frame(x1 = round(rnorm(n), 3), x2 = round(rnorm(n), 3),
                f = sample(c("a", "b", "c"), n, TRUE), g = sample(c("u", "v"), n, TRUE), stringsAsFactors = FALSE)
eta <- -0.2 + 0.9 * d$x1 - 0.5 * (d$f == "b") + 0.4 * (d$g == "v")
d$yb <- rbinom(n, 1, plogis(eta))
d$yl <- ifelse(rbinom(n, 1, plogis(eta)) == 1, "yes", "no")
d$t <- sample(4:12, n, TRUE); d$s <- rbinom(n, d$t, plogis(eta)); d$fl <- d$t - d$s; d$p <- d$s / d$t
d$e <- round(runif(n, 0.5, 3), 2); d$loge <- log(d$e)
d$cnt <- rpois(n, d$e * exp(0.3 + 0.4 * d$x1 + 0.3 * (d$f == "c")))
d$yg <- round(1 + 0.8 * d$x1 - 0.4 * d$x2 + 0.5 * (d$f == "c") + rnorm(n), 3)
d$ygam <- round(rgamma(n, shape = 3, rate = 3 / exp(0.5 + 0.3 * d$x1)), 4)
d$x12 <- 2 * d$x1
d$w <- round(runif(n, 0.3, 2.5), 2)
dn <- d; dn$x2[c(4, 18, 33)] <- NA; dn$w[c(7, 50)] <- NA

cases <- list(
  list(set = "d", formula = "yb ~ x1 + f", family = "binomial"),
  list(set = "d", formula = "yb ~ x1 * f + g", family = "binomial"),
  list(set = "d", formula = "cbind(s, fl) ~ x1 + g", family = "binomial"),
  list(set = "d", formula = "p ~ x1 + g", family = "binomial", weights = "t"),
  list(set = "d", formula = "yl ~ x1 + g", family = "binomial"),
  list(set = "d", formula = "yb ~ x1 + x12 + g", family = "binomial"),
  list(set = "d", formula = "cnt ~ x1 + f", family = "poisson", offset = "loge"),
  list(set = "d", formula = "cnt ~ f + x1 - 1", family = "poisson"),
  list(set = "d", formula = "cnt ~ x1:f + g", family = "poisson", weights = "w"),
  list(set = "d", formula = "ygam ~ x1 + g", family = "Gamma", link = "log"),
  list(set = "d", formula = "yg ~ x1 + x2 + f", family = "gaussian"),
  list(set = "dn", formula = "yg ~ x1 + x2 + f", family = "gaussian"),
  list(set = "dn", formula = "yb ~ x1 + x2", family = "binomial", weights = "w"),
  list(set = "d", formula = "yb ~ 1", family = "binomial"),
  list(set = "d", formula = "cnt ~ 1", family = "poisson", offset = "loge"))

fitOf <- function(cs) {
  data <- get(cs$set)
  fam <- get(cs$family)
  fam <- if (is.null(cs$link)) fam() else fam(link = cs$link)
  if (cs$formula == "yl ~ x1 + g") data$yl <- factor(data$yl)
  fo <- as.formula(cs$formula)
  # the weights and the offset only when given (an offset of zeros changes how R computes the null deviance)
  data$.w <- if (is.null(cs$weights)) 1 else data[[cs$weights]]
  if (is.null(cs$offset)) glm(fo, family = fam, data = data, weights = .w)
  else { data$.o <- data[[cs$offset]]; glm(fo, family = fam, data = data, weights = .w, offset = .o) }
}
out <- list(R = R.version.string, data = list(d = d, dn = dn))
out$cases <- lapply(cases, function(cs) c(cs, run({
  m <- fitOf(cs)
  list(coefNames = names(coef(m)), coefficients = unname(coef(m)), deviance = m$deviance, nullDeviance = m$null.deviance,
       aic = m$aic, rank = m$rank, dfResidual = m$df.residual, dfNull = m$df.null, iter = m$iter,
       converged = m$converged, fittedValues = unname(fitted(m)), nUsed = length(fitted(m)))
})))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE),
           file.path("/out", "glmformula.json"))
