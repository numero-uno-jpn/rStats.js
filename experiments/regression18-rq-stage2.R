# issue: 545
# Independent probes for the quantile-regression implementation, using public calls only.
suppressMessages(library(quantreg))
library(jsonlite)

tab <- function(x) {
  z <- as.matrix(x)
  list(rows = rownames(z), cols = colnames(z), values = unname(z))
}

probeDensity <- function(y, x, tau) {
  data <- data.frame(y = y, x = x)
  fit <- rq(y ~ x, data = data, tau = tau, method = "br")
  summaryFit <- summary(fit, se = "iid", covariance = TRUE)
  residual <- unname(residuals(fit))
  sortedResidual <- sort(residual)
  covariance <- summaryFit$cov
  designMatrix <- model.matrix(y ~ x, data)
  cross <- crossprod(designMatrix)
  impliedDensity <- sqrt(tau * (1 - tau) / covariance[1, 1] / solve(cross)[1, 1])
  list(
    n = length(y),
    tau = tau,
    coefficients = unname(coef(fit)),
    rho = unname(fit$rho),
    covariance = tab(covariance),
    impliedDensity = impliedDensity,
    adaptiveKernel = akj(sortedResidual, z = 0),
    residualQuantilesType1 = quantile(residual, c(tau - .1, tau, tau + .1), type = 1, names = FALSE),
    residualQuantilesType7 = quantile(residual, c(tau - .1, tau, tau + .1), type = 7, names = FALSE),
    sortedResiduals = sortedResidual
  )
}

smallData <- data.frame(
  x = c(-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
  y = c(2, 1, 4, 2, 5, 3, 8, 5, 9, 7, 11, 8, 14, 10, 15, 13)
)
data(engel)
set.seed(20261121)
normalX <- seq(-2, 2, length.out = 240)
normalY <- 1 + 2 * normalX + rnorm(240)

out <- list(
  smallMedian = probeDensity(smallData$y, smallData$x, .5),
  smallLower = probeDensity(smallData$y, smallData$x, .25),
  engelMedian = probeDensity(engel$foodexp, engel$income, .5),
  normalMedian = probeDensity(normalY, normalX, .5)
)

for (bootType in c("xy", "pwy", "mcmb", "wxy")) {
  set.seed(1)
  fit <- rq(foodexp ~ income, data = engel, tau = .5, method = "br")
  bootSummary <- summary(fit, se = "boot", bsmethod = bootType, R = 200)
  out[[paste0("bootstrap_", bootType)]] <- list(
    coefficientTable = tab(coef(bootSummary)),
    bootstrapCoefficients = unname(bootSummary$B)
  )
}

writeLines(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
