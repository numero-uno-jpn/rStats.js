# issue: 545
# One combined public-output probe for the remaining rq inference candidates.
# References: Koenker (2005), §§3.4–3.5; Powell (1991);
# Gutenbrunner et al. (1993); Parzen, Wei & Ying (1994); He & Hu (2002);
# Kocherginsky, He & Mu (2005). No implementation internals are inspected.
suppressMessages(library(quantreg))
library(jsonlite)

tab <- function(x) {
  if (is.null(x)) return(NULL)
  z <- as.matrix(x)
  list(rows = rownames(z), cols = colnames(z), values = unname(z))
}
capture <- function(expr) {
  warnings <- character()
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) list(error = conditionMessage(e))),
    warning = function(w) {
      warnings <<- c(warnings, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  )
  list(value = value, warnings = warnings)
}
relativeError <- function(a, b) {
  if (any(dim(a) != dim(b))) return(NA_real_)
  norm(a - b, type = "F") / max(norm(b, type = "F"), .Machine$double.eps)
}
bootSpread <- function(b, p) {
  if (is.null(b)) return(NULL)
  b <- as.matrix(b)
  if (ncol(b) == p) {
    return(list(orientation = "replicates_by_coefficients",
                sampleSD = apply(b, 2, sd),
                populationSD = sqrt(colMeans((sweep(b, 2, colMeans(b), "-"))^2))))
  }
  if (nrow(b) == p) {
    return(list(orientation = "coefficients_by_replicates",
                sampleSD = apply(b, 1, sd),
                populationSD = sqrt(rowMeans((sweep(b, 1, rowMeans(b), "-"))^2))))
  }
  list(orientation = "unknown", dimensions = dim(b))
}

small <- data.frame(
  x = c(-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
  y = c(2, 1, 4, 2, 5, 3, 8, 5, 9, 7, 11, 8, 14, 10, 15, 13)
)
tau <- 0.5
smallFit <- rq(y ~ x, data = small, tau = tau, method = "br")
smallX <- model.matrix(y ~ x, small)
smallResiduals <- as.numeric(residuals(smallFit))
smallIid <- summary(smallFit, se = "iid", covariance = TRUE)
smallKer <- summary(smallFit, se = "ker", covariance = TRUE)
smallRank <- summary(smallFit, se = "rank", alpha = 0.05)
smallProbabilityBandwidth <- bandwidth.rq(tau, nrow(small), hs = TRUE)
smallNormalSpan <- qnorm(tau + smallProbabilityBandwidth) -
  qnorm(tau - smallProbabilityBandwidth)
nonzeroResiduals <- smallResiduals[abs(smallResiduals) > 1e-8]
orderedNonzero <- sort(nonzeroResiduals)
lowerIndex <- max(1, min(length(orderedNonzero),
                         ceiling(length(orderedNonzero) * (tau - smallProbabilityBandwidth))))
upperIndex <- max(1, min(length(orderedNonzero),
                         ceiling(length(orderedNonzero) * (tau + smallProbabilityBandwidth))))
iidQuantileCandidates <- lapply(1:9, function(qType) {
  list(
    type = qType,
    allLower = unname(quantile(smallResiduals, tau - smallProbabilityBandwidth, type = qType)),
    allUpper = unname(quantile(smallResiduals, tau + smallProbabilityBandwidth, type = qType)),
    nonzeroLower = unname(quantile(nonzeroResiduals, tau - smallProbabilityBandwidth, type = qType)),
    nonzeroUpper = unname(quantile(nonzeroResiduals, tau + smallProbabilityBandwidth, type = qType))
  )
})
iidProbe <- list(
  targetDensity = unname(smallIid$scale),
  targetSparsity = unname(1 / smallIid$scale),
  covariance = smallIid$cov,
  designCrossProduct = crossprod(smallX),
  residuals = smallResiduals,
  sortedAllResiduals = sort(smallResiduals),
  sortedNonzeroResiduals = orderedNonzero,
  zeroCount = sum(abs(smallResiduals) <= 1e-8),
  parameterCount = ncol(smallX),
  probabilityBandwidth = smallProbabilityBandwidth,
  nonzeroOrderIndices = c(lower = lowerIndex, upper = upperIndex),
  nonzeroOrderSpacing = if (upperIndex > lowerIndex)
    (upperIndex - lowerIndex) / length(orderedNonzero) else 0,
  nonzeroOrderSparsity = if (upperIndex > lowerIndex)
    (orderedNonzero[upperIndex] - orderedNonzero[lowerIndex]) /
      ((upperIndex - lowerIndex) / length(orderedNonzero)) else NA_real_,
  quantileTypes = iidQuantileCandidates
)

robustScales <- c(
  mad_about_median = mad(smallResiduals, center = median(smallResiduals), constant = 1.4826),
  iqr_normal = IQR(smallResiduals) / 1.34897950039216,
  sd = sd(smallResiduals),
  median_abs_about_zero = median(abs(smallResiduals)) / qnorm(0.75)
)
kernelCandidates <- list()
for (scaleName in names(robustScales)) {
  scaleValue <- robustScales[[scaleName]]
  hValue <- scaleValue * smallNormalSpan
  for (kernelName in c("uniform", "gaussian")) {
    kernelWeights <- if (kernelName == "uniform") {
      as.numeric(abs(smallResiduals / hValue) <= 1) * 0.5 / hValue
    } else {
      dnorm(smallResiduals / hValue) / hValue
    }
    hessian <- crossprod(smallX, smallX * kernelWeights)
    inverseHessian <- tryCatch(solve(hessian), error = function(e) NULL)
    kernelCandidates[[paste(scaleName, kernelName, sep = "_")]] <- list(
      scale = scaleValue,
      probabilitySpan = smallNormalSpan,
      residualBandwidth = hValue,
      kernel = kernelName,
      inverseHessian = inverseHessian,
      relativeErrorToPublicHinv = if (is.null(inverseHessian) || is.null(smallKer$Hinv))
        NA_real_ else relativeError(inverseHessian, smallKer$Hinv)
    )
  }
}
kerProbe <- list(
  publicHinv = smallKer$Hinv,
  publicCovariance = smallKer$cov,
  designCrossProduct = crossprod(smallX),
  probabilityBandwidthHS = smallProbabilityBandwidth,
  probabilityBandwidthBofinger = bandwidth.rq(tau, nrow(small), hs = FALSE),
  normalQuantileSpan = smallNormalSpan,
  robustScales = robustScales,
  candidates = kernelCandidates
)

rankTable <- coef(smallRank)
lowerColumn <- grep("lower", colnames(rankTable), ignore.case = TRUE)
upperColumn <- grep("upper", colnames(rankTable), ignore.case = TRUE)
rankGrid <- NULL
if (length(lowerColumn) == 1 && length(upperColumn) == 1 &&
    "x" %in% rownames(rankTable)) {
  slopeLower <- unname(rankTable["x", lowerColumn])
  slopeUpper <- unname(rankTable["x", upperColumn])
  slopeGrid <- seq(slopeLower - 0.2 * (slopeUpper - slopeLower),
                   slopeUpper + 0.2 * (slopeUpper - slopeLower),
                   length.out = 41)
  rankGrid <- lapply(slopeGrid, function(candidateSlope) {
    shifted <- data.frame(y = small$y - candidateSlope * small$x, x = small$x)
    capture({
      fullFit <- rq(y ~ x, data = shifted, tau = tau, method = "br")
      reducedFit <- rq(y ~ 1, data = shifted, tau = tau, method = "br")
      rankComparison <- anova(fullFit, reducedFit, test = "rank")
      list(candidateSlope = candidateSlope,
           fullCoefficients = coef(fullFit),
           originalSlopeAfterShift = candidateSlope + unname(coef(fullFit)[["x"]]),
           testTable = tab(rankComparison$table))
    })
  })
}
rankProbe <- list(
  coefficientTable = tab(rankTable),
  confidenceLevel = 0.95,
  slopeGrid = rankGrid
)

data(engel)
engelFit <- rq(foodexp ~ income, data = engel, tau = tau, method = "br")
engelX <- model.matrix(foodexp ~ income, engel)
engelY <- engel$foodexp
replicates <- 40
bootstrapProbe <- list()
for (methodName in c("wxy", "pwy", "mcmb")) {
  set.seed(1)
  summaryFit <- capture(summary(engelFit, se = "boot", bsmethod = methodName,
                                R = replicates))
  if (!is.null(summaryFit$value$error)) {
    bootstrapProbe[[methodName]] <- summaryFit
  } else {
    summaryValue <- summaryFit$value
    coefficientTable <- coef(summaryValue)
    coefficientDraws <- summaryValue$B
    bootstrapProbe[[methodName]] <- list(
      coefficientTable = tab(coefficientTable),
      draws = tab(coefficientDraws),
      drawDimensions = dim(coefficientDraws),
      spread = bootSpread(coefficientDraws, ncol(engelX)),
      perturbations = if (is.null(summaryValue$U)) NULL else tab(summaryValue$U),
      warnings = summaryFit$warnings
    )
  }
}

set.seed(1)
wxySummary <- summary(engelFit, se = "boot", bsmethod = "wxy", R = replicates)
wxyDraws <- as.matrix(wxySummary$B)
set.seed(1)
exponentialWeights <- matrix(rexp(nrow(engel) * replicates, rate = 1),
                              nrow = nrow(engel), ncol = replicates)
manualWxy <- matrix(NA_real_, nrow = replicates, ncol = ncol(engelX))
for (replicateIndex in seq_len(replicates)) {
  weightedFit <- rq(foodexp ~ income, data = engel, tau = tau,
                    weights = exponentialWeights[, replicateIndex], method = "br")
  manualWxy[replicateIndex, ] <- coef(weightedFit)
}
wxyManualProbe <- list(
  publicDraws = tab(wxyDraws),
  exponentialWeights = tab(exponentialWeights),
  manualWeightedFits = tab(manualWxy),
  maxAbsoluteDifference = if (all(dim(wxyDraws) == dim(manualWxy)))
    max(abs(wxyDraws - manualWxy)) else NA_real_,
  publicCoefficientTable = tab(coef(wxySummary)),
  manualSampleSD = apply(manualWxy, 2, sd),
  manualPopulationSD = sqrt(colMeans(sweep(manualWxy, 2, colMeans(manualWxy), "-")^2))
)

set.seed(1)
pwySummary <- summary(engelFit, se = "boot", bsmethod = "pwy", R = replicates)
pwyDraws <- as.matrix(pwySummary$B)
set.seed(1)
pwyUniforms <- matrix(runif(nrow(engel) * replicates), nrow = nrow(engel),
                      ncol = replicates)
pwyManual <- matrix(NA_real_, nrow = replicates, ncol = ncol(engelX))
for (replicateIndex in seq_len(replicates)) {
  bernoulliDraws <- as.numeric(pwyUniforms[, replicateIndex] < tau)
  pivotalVector <- as.numeric(crossprod(engelX, bernoulliDraws - tau)) /
    sqrt(nrow(engel))
  appendedDesign <- -pivotalVector / tau
  augmented <- data.frame(
    foodexp = c(engelY, max(engelY) + 1e6),
    interceptColumn = c(rep(1, nrow(engel)), appendedDesign[1]),
    income = c(engel$income, appendedDesign[2])
  )
  augmentedFit <- rq(foodexp ~ 0 + interceptColumn + income,
                     data = augmented, tau = tau, method = "br")
  pwyManual[replicateIndex, ] <- coef(augmentedFit)
}
pwyManualProbe <- list(
  publicDraws = tab(pwyDraws),
  publicPerturbations = if (is.null(pwySummary$U)) NULL else tab(pwySummary$U),
  uniformDraws = tab(pwyUniforms),
  manualAugmentedFits = tab(pwyManual),
  maxAbsoluteDifference = if (all(dim(pwyDraws) == dim(pwyManual)))
    max(abs(pwyDraws - pwyManual)) else NA_real_,
  publicCoefficientTable = tab(coef(pwySummary)),
  manualSampleSD = apply(pwyManual, 2, sd),
  manualPopulationSD = sqrt(colMeans(sweep(pwyManual, 2, colMeans(pwyManual), "-")^2))
)

out <- list(
  iid = iidProbe,
  ker = kerProbe,
  rank = rankProbe,
  bootstrap = bootstrapProbe,
  wxyManual = wxyManualProbe,
  pwyManual = pwyManualProbe
)
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null",
           na = "string", pretty = FALSE))
