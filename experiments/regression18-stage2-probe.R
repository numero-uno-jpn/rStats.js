# issue: 545
# Stage-2 focused public-output probes: strict CV, delete-cluster jackknife,
# iid/ker density candidates, and bootstrap draws. No implementation internals.
suppressMessages(library(glmnet))
suppressMessages(library(geepack))
suppressMessages(library(quantreg))
library(jsonlite)

asTab <- function(x) {
  z <- as.matrix(x)
  list(rows = rownames(z), cols = colnames(z), values = unname(z))
}
capture <- function(expr) {
  warns <- character()
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}

# 1. Gaussian CV: compare default and strict refits on exactly the same fixed folds.
X <- matrix(c(
  -2,1,0,2,-1,3,1,-3,2,0,4,-2,
  1,0,2,-1,3,-2,2,1,-3,4,0,-1,
  2,-1,1,0,-2,3,-3,2,1,-1,4,0
), 12, 3)
response <- c(4,2,5,1,7,0,6,3,8,2,9,1)
folds <- rep(1:3, 4)
cvDefault <- capture(cv.glmnet(X, response, foldid = folds, nlambda = 8, keep = TRUE))
cvStrict <- capture(cv.glmnet(X, response, foldid = folds, nlambda = 8, keep = TRUE,
                              control = list(thresh = 1e-14)))
cvPart <- function(z) {
  if (!is.null(z$error)) return(z)
  v <- z$value
  list(lambda = v$lambda, cvm = v$cvm, cvsd = v$cvsd, lambdaMin = v$lambda.min,
       lambda1se = v$lambda.1se, fitPreval = asTab(v$fit.preval))
}
cvCompare <- NULL
if (is.null(cvDefault$error) && is.null(cvStrict$error)) {
  a <- cvDefault$value$cvm
  b <- cvStrict$value$cvm
  cvCompare <- list(default = cvPart(cvDefault), strict = cvPart(cvStrict),
                    differences = a - b, maxAbsDifference = max(abs(a - b)))
} else {
  cvCompare <- list(default = cvPart(cvDefault), strict = cvPart(cvStrict))
}

# 2. Delete-one-cluster estimates and all four center/factor covariance candidates.
d <- data.frame(
  id = rep(1:12, each = 3), wave = rep(1:3, 12), x = rep(c(-1, 0, 1), 12),
  y = c(1.7534,2.9203,2.5018,2.8479,3.1191,3.3040,1.9940,2.9519,3.3162,
        2.0370,3.1600,3.7074,2.1179,2.7573,3.5305,1.8430,2.5981,3.7241,
        2.0848,2.1128,3.2114,2.4783,2.6839,3.3756,2.4709,3.7123,3.0934,
        2.8241,2.1850,3.5375,1.5652,3.4757,3.8670,2.7189,2.3572,3.7923)
)
ids <- sort(unique(d$id))
deleted <- do.call(rbind, lapply(ids, function(k) {
  unname(coef(geeglm(y ~ x, id = id, waves = wave, data = d[d$id != k, ],
                     family = gaussian, corstr = "exchangeable")))
}))
jackCandidates <- function(full, deletedMatrix) {
  k <- nrow(deletedMatrix)
  centerMean <- colMeans(deletedMatrix)
  centerFull <- unname(coef(full))
  make <- function(center, factor) {
    delta <- sweep(deletedMatrix, 2, center, "-")
    crossprod(delta) * factor
  }
  list(
    mean_km1_over_k = asTab(make(centerMean, (k - 1) / k)),
    mean_one = asTab(make(centerMean, 1)),
    full_km1_over_k = asTab(make(centerFull, (k - 1) / k)),
    full_one = asTab(make(centerFull, 1))
  )
}
jackResults <- list(deleted = asTab(deleted))
for (kind in c("jack", "j1s", "fij")) {
  jackResults[[kind]] <- capture({
    f <- geeglm(y ~ x, id = id, waves = wave, data = d, family = gaussian,
                corstr = "exchangeable", std.err = kind)
    list(coef = unname(coef(f)), covariance = asTab(vcov(f)),
         candidates = jackCandidates(f, deleted))
  })
}

# 3. iid density: compare the covariance-implied density with Siddiqui difference quotients.
small <- data.frame(
  x = -3:12,
  y = c(2,1,4,2,5,3,8,5,9,7,11,8,14,10,15,13)
)
densityProbe <- function(dat, tau) {
  f <- rq(y ~ x, data = dat, tau = tau, method = "br")
  r <- unname(residuals(f))
  nz <- r[abs(r) > 1e-8]
  hHS <- bandwidth.rq(tau, length(r), hs = TRUE)
  hB <- bandwidth.rq(tau, length(r), hs = FALSE)
  summHS <- summary(f, se = "iid", covariance = TRUE)
  summB <- summary(f, se = "iid", covariance = TRUE, hs = FALSE)
  quantileCandidates <- function(values, h) {
    do.call(rbind, lapply(1:9, function(tp) {
      q <- quantile(values, c(tau - h, tau + h), type = tp, names = FALSE)
      c(type = tp, width = q[2] - q[1], density = 2 * h / (q[2] - q[1]))
    }))
  }
  implied <- function(cov) {
    xx <- model.matrix(y ~ x, dat)
    cross <- crossprod(xx)
    sqrt(tau * (1 - tau) / cov[1, 1] / solve(cross)[1, 1])
  }
  list(n = nrow(dat), tau = tau, residuals = r, nonzeroResiduals = nz,
       bandwidthHS = hHS, bandwidthBofinger = hB,
       iidHS = list(cov = asTab(summHS$cov), impliedDensity = implied(summHS$cov)),
       iidBofinger = list(cov = asTab(summB$cov), impliedDensity = implied(summB$cov)),
       diffAllHS = quantileCandidates(r, hHS), diffNonzeroHS = quantileCandidates(nz, hHS),
       diffAllBofinger = quantileCandidates(r, hB), diffNonzeroBofinger = quantileCandidates(nz, hB))
}
data(engel)
engelData <- data.frame(y = engel$foodexp, x = engel$income)
iidProbe <- list(small = densityProbe(small, 0.5), engel = densityProbe(engelData, 0.5))

# 4. ker: public covariance components and independent density() bandwidth probes.
kernelProbe <- function(dat, tau) {
  f <- rq(y ~ x, data = dat, tau = tau, method = "br")
  r <- unname(residuals(f))
  s <- summary(f, se = "ker", covariance = TRUE)
  bw <- c(nrd = bw.nrd(r), nrd0 = bw.nrd0(r), silverman = bw.SJ(r))
  atZero <- lapply(names(bw), function(nm) {
    den <- density(r, bw = bw[[nm]], n = 4097, from = min(r), to = max(r))
    approx(den$x, den$y, xout = 0)$y
  })
  names(atZero) <- names(bw)
  list(n = length(r), bandwidthCandidates = bw, densityAtZero = atZero,
       covariance = asTab(s$cov), Hinv = s$Hinv, J = s$J,
       scale = s$scale, summaryNames = names(s))
}
kerProbe <- list(small = kernelProbe(small, 0.5), engel = kernelProbe(engelData, 0.5))

# 5. Bootstrap: expose only documented public summary components and reproducible RNG draws.
Xsmall <- model.matrix(y ~ x, small)
bootProbe <- list()
for (methodName in c("xy", "pwy", "mcmb", "wxy")) {
  set.seed(1)
  rawDraws <- switch(
    methodName,
    xy = sample.int(nrow(small), nrow(small) * 12, replace = TRUE),
    pwy = runif(nrow(small) * 12),
    mcmb = rnorm(nrow(small) * 12),
    wxy = rexp(nrow(small) * 12, rate = 1)
  )
  set.seed(1)
  bootProbe[[methodName]] <- capture({
    f <- rq(y ~ x, data = small, tau = 0.5, method = "br")
    s <- summary(f, se = "boot", bsmethod = methodName, R = 12)
    list(coefficientTable = asTab(coef(s)), bootstrapCoefficients = s$B,
         bootstrapAuxiliary = s$U, rawDraws = rawDraws)
  })
}

out <- list(cv = cvCompare, geeJackknife = jackResults, iid = iidProbe,
            ker = kerProbe, bootstrap = bootProbe)
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
