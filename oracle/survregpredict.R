# oracle-platform: amd64
source("/oracle/_survreg.R")

# Predictions and residuals of survreg fits (fixtures survregPredict, survregResiduals). Behaviour in
# oracle/survreg-behaviour.md (sections "Predictions" and "Residuals"). The fit arguments as in oracle/survreg.R
# (see oracle/_survreg.R).
#   survregPredict, further arguments: predType (R's type: "lp", "linear", "link", "response", "quantile", "uquantile"), p (for the
#   quantiles; absent: R's default c(0.1, 0.9)), se.fit, and for new data newX (covariate rows), newStrata,
#   newOffset (absent: the observations of the fit). Written: fit and se.fit (se.fit only with se.fit = TRUE), each a
#   vector, or an array of rows (one per observation, one column per p) when there is more than one p.
#   survregResiduals, further arguments: residType (R's type: "response", "deviance", "working", "dfbeta", "dfbetas", "ldcase",
#   "ldresp", "ldshape", "matrix"), weighted. Written: values (a vector, or an array of rows for dfbeta, dfbetas and
#   matrix). Where R is wrong the case has "reference" with "refKind":
#     "intervalDerivs": interval-censored rows of the matrix columns ds, dds, dsg and every type built from them
#                       (dfbeta, dfbetas, ldcase, ldresp, ldshape); reference values from the correct derivatives;
#     "extremeCentre": response and deviance residuals of interval-censored rows with the extreme value family
#                      (weibull, exponential, rayleigh, extreme) when the scale is not 1; reference from the centre
#                      y_l - sigma log(b/(e^b - 1)) of the behaviour document.

set.seed(20261110)
lung2 <- na.omit(lung[, c("time", "status", "age", "sex", "ph.ecog")])[1:90, ]
LL <- list(time = I(lung2$time), event = I(lung2$status - 1L), x = as.matrix(lung2[, c("age", "sex")]))
n <- 60; xs <- cbind(round(rnorm(n), 3), rbinom(n, 1, 0.5)); tt <- exp(1 + 0.5 * xs[, 1] + 0.4 * log(rexp(n)))
st <- sample(0:3, n, TRUE, prob = c(.3, .3, .2, .2)); lo <- round(tt, 3); hi <- round(tt * runif(n, 1.2, 2), 3)
lo[st == 2] <- round(tt[st == 2] * 1.3, 3); hi[st != 3] <- 1
IV <- list(time = I(lo), time2 = I(hi), event = I(st), type = "interval", x = xs)
TB <- list(time = I(tobin$durable), event = I(as.integer(tobin$durable > 0)), type = "left",
           x = as.matrix(tobin[, c("age", "quant")]), dist = "gaussian")
fits <- list(
  c(LL, list(dist = "weibull")), c(LL, list(dist = "lognormal")), c(LL, list(dist = "loglogistic")),
  c(LL, list(dist = "exponential")), c(LL, list(dist = "gaussian")), c(LL, list(dist = "t")),
  c(LL, list(strata = I(ifelse(lung2$sex == 1, "m", "f")), x = LL$x[, 1, drop = FALSE])),
  c(LL, list(scale = 1.3)), c(LL, list(offset = I(lung2$ph.ecog / 4))),
  c(LL, list(weights = I(sample(1:3, nrow(lung2), TRUE)))),
  TB, c(IV, list(dist = "weibull")), c(IV, list(dist = "lognormal")), c(IV, list(dist = "logistic")),
  c(IV, list(dist = "extreme")))

# ---- predictions ----
pcases <- list()
newX <- rbind(c(50, 1), c(70, 2), c(NA, 1)); newXi <- rbind(c(-1, 0), c(0.5, 1))
for (f in fits) {
  isIV <- identical(f$type, "interval"); isTB <- identical(f$dist, "gaussian") && identical(f$type, "left")
  nx <- if (isIV) newXi else if (isTB) rbind(c(40, 10), c(60, 5)) else newX[, seq_len(ncol(f$x)), drop = FALSE]
  for (type in c("lp", "response", "quantile", "uquantile")) for (se in c(FALSE, TRUE)) {
    pcases[[length(pcases) + 1]] <- c(f, list(predType = type, se.fit = se))
    nd <- c(f, list(predType = type, se.fit = se, newX = nx))
    if (!is.null(f$strata)) nd$newStrata <- I(rep(c("m", "f"), length = nrow(nx)))
    if (!is.null(f$offset)) nd$newOffset <- I(rep(0.25, nrow(nx)))
    pcases[[length(pcases) + 1]] <- nd
  }
  pcases[[length(pcases) + 1]] <- c(f, list(predType = "quantile", p = 0.5, se.fit = TRUE))
  pcases[[length(pcases) + 1]] <- c(f, list(predType = "uquantile", p = I(c(0.01, 0.25, 0.5, 0.75, 0.99)), se.fit = TRUE, newX = nx[1:2, , drop = FALSE],
    newStrata = if (!is.null(f$strata)) I(c("m", "f")), newOffset = if (!is.null(f$offset)) I(c(0, 0.5))))
}
pcases[[length(pcases) + 1]] <- c(fits[[1]], list(predType = "linear")); pcases[[length(pcases) + 1]] <- c(fits[[1]], list(predType = "link"))
pcases[[length(pcases) + 1]] <- c(fits[[1]], list(predType = "quantile", p = I(c(0, 1))))
pcases[[length(pcases) + 1]] <- c(fits[[7]], list(predType = "lp", newX = rbind(60)))                # no strata in new data
pcases <- lapply(pcases, function(a) Filter(Negate(is.null), a))

out_vm <- function(v) if (is.matrix(v)) mat_rows(v) else I(num2str(unname(v)))
write_htest_fixture("survregPredict", pcases, function(a) sr_try(function() {
  fit <- sr_call(a)
  args <- list(fit, type = a$predType, se.fit = isTRUE(a$se.fit))
  if (!is.null(a[["p"]])) args$p <- unclass(a[["p"]])   # a$p would match predType partially
  if (!is.null(a$newX)) {
    nd <- as.data.frame(matrix(a$newX, ncol = ncol(a$x))); names(nd) <- paste0("x", seq_len(ncol(a$x)))
    if (!is.null(a$newStrata)) nd$s <- unclass(a$newStrata)
    if (!is.null(a$newOffset)) nd$off <- unclass(a$newOffset)
    args$newdata <- nd
  }
  r <- do.call(predict, args)
  if (isTRUE(a$se.fit)) list(fit = out_vm(r$fit), se.fit = out_vm(r$se.fit)) else list(fit = out_vm(r))
}))

# ---- residuals ----
rcases <- list()
for (f in fits[c(1, 2, 5, 7, 8, 10, 11, 12, 13, 14, 15)]) for (type in c("response", "deviance", "working", "dfbeta", "dfbetas", "ldcase", "ldresp", "ldshape", "matrix"))
  rcases[[length(rcases) + 1]] <- c(f, list(residType = type))
for (type in c("response", "dfbeta", "matrix")) rcases[[length(rcases) + 1]] <- c(fits[[10]], list(residType = type, weighted = TRUE))

# Correct values for the reference (section "Residuals" of the behaviour document)
sr_resid_ref <- function(fit, a) {
  yd <- sr_ydata(fit, a); type <- a$residType
  if (!any(yd$st == 3)) return(NULL)
  eta <- fit$linear.predictors; nst <- length(fit$scale)
  sidx <- if (nst > 1) as.integer(factor(unclass(a$strata))) else rep(1L, length(eta))
  sig <- unname(fit$scale)[sidx]; w <- if (!is.null(a$weights) && isTRUE(a$weighted)) unclass(a$weights) else rep(1, length(eta))
  df <- if (is.null(a$parms)) 4 else a$parms
  m <- sr_derivs(yd$base, eta, sig, yd$lo, yd$hi, yd$st, df)
  fixed <- nrow(fit$var) == length(fit$coefficients)
  X <- cbind(1, a$x)   # the fits of the references all have an intercept
  E <- outer(sidx, seq_len(nst), "==") * 1
  Lm <- cbind(m[, 2] * X, if (!fixed) m[, 4] * E); V <- fit$var
  D <- cbind(-m[, 3] * X, if (!fixed) -m[, 6] * E) * sig; D2 <- cbind(m[, 6] * X, if (!fixed) m[, 5] * E)
  ext <- yd$base == "extreme"
  if (type %in% c("response", "deviance") && !(ext && any(abs(sig - 1) > 0))) return(NULL)
  val <- switch(type,
    matrix = mat_rows(w * m),
    dfbeta = mat_rows(w * (Lm %*% V)), dfbetas = mat_rows(w * sweep(Lm %*% V, 2, sqrt(diag(V)), "/")),
    ldcase = I(num2str(w * rowSums((Lm %*% V) * Lm))), ldresp = I(num2str(w * rowSums((D %*% V) * D))),
    ldshape = I(num2str(w * rowSums((D2 %*% V) * D2))),
    response = , deviance = {
      b <- (yd$hi - yd$lo)/sig; a0 <- log(b/expm1(b))
      ctr <- ifelse(yd$st == 3, yd$lo - a0 * sig, yd$lo)
      itr <- if (yd$tr) exp else identity
      if (type == "response") I(num2str(w * (itr(ctr) - itr(eta)))) else {
        gmax <- ifelse(yd$st == 1, -1 - log(sig), ifelse(yd$st == 3, log(exp(-exp(a0)) - exp(-exp(a0 + b))), 0))
        sgn <- ifelse(yd$st == 0, 1, ifelse(yd$st == 2, -1, sign(ctr - eta)))
        I(num2str(w * sgn * sqrt(2 * (gmax - m[, 1])))) } },
    NULL)
  if (is.null(val)) return(NULL)
  list(refKind = if (type %in% c("response", "deviance")) "extremeCentre" else "intervalDerivs", values = val)
}
write_htest_fixture("survregResiduals", rcases, function(a) sr_try(function() {
  fit <- sr_call(a)
  r <- residuals(fit, type = a$residType, weighted = isTRUE(a$weighted))
  list(values = out_vm(r))
}), ref = function(a) {
  if (!(a$residType %in% c("matrix", "dfbeta", "dfbetas", "ldcase", "ldresp", "ldshape", "response", "deviance"))) return(NULL)
  fit <- suppressWarnings(sr_call(a)); sr_resid_ref(fit, a)
})
