# oracle-memory: 1g
source("/oracle/_htest.R")

# Method comparison regression: mcr::mcreg (fixture mcreg). See oracle/methodcomparison-behaviour.md, section 2.
#
# Arguments: x, y (R's x and y), and where given (R's names in camelCase) methodReg, methodCi, methodBootstrapCi,
# errorRatio, alpha, slopeMeasure, nsamples, nnested, rngSeed, iterMax, threshold, naRm, NBins. Missing values "NA".
# `scale` (when present) is the power of 2 by which the data of another case were multiplied (see reference).
# Expected:
#   para       {Intercept: [EST, SE, LCI, UCI], Slope: [EST, SE, LCI, UCI]} (R's @para; SE "NA" where mcr has none)
#   xmean      @xmean (analytical and resampling results; the (weighted) mean of x for Deming, NA for PaBa)
#   weight     @weight (WDeming only: the weights of the last iteration)
#   B0jack, B1jack            jackknife (leave-one-out) coefficients (methodCi "jackknife" and BCa)
#   B0, B1, sigmaB0, sigmaB1  the bootstrap coefficients (and their standard errors where mcr has them), in the
#                             order they were drawn; glob.sigma; nsamples (resamples kept)
#   cusum      for PaBa and PaBaLarge with methodCi "analytical": calcCUSUM's nPos, nNeg, cusum, max.cusum
#   warnings   R's warnings (each once). mcr's cat() output ("Jackknife based calculation ...") is not recorded.
# Errors as {"error": message}.
#
# Reference (refKind):
#   "mpfr"      Deming with methodCi "analytical": the same formulas evaluated with 256-bit Rmpfr from the doubles
#               (mcr's slope formula cancels when error.ratio * Syy is small against Sxx, and its sums over- and
#               underflow); qt() in double. Every analytical Deming case has it.
#   "scaled"    the data of the case are another case's data times 2^scale (scale invariance: the slope and its
#               limits are unchanged, the intercept and its limits scale by 2^scale); reference = that case's
#               values transformed. Where mcr fails or overflows only.
#   "converged" WDeming: mcr stops iterating when both coefficients change by less than threshold (absolute; 1e-6
#               by default); reference = the same call with threshold 0 and iterMax 1000 (the fixed point).

suppressPackageStartupMessages({library(mcr); library(Rmpfr)})

set.seed(20261109)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)

data(creatinine, package = "mcr")
cr <- na.omit(creatinine)
cx <- cr[, 1]; cy <- cr[, 2]
s8x <- c(1, 2, 3, 4, 5, 6, 7, 8); s8y <- c(1.1, 2.3, 2.9, 4.2, 4.8, 6.3, 6.8, 8.4)
s7x <- c(1, 2, 3, 4, 5, 6, 7); s7y <- c(1.2, 1.9, 3.2, 3.8, 5.1, 6.4, 6.6)
r20x <- round(exp(rnorm(20, 2, 0.6)), 1); r20y <- round(r20x * exp(rnorm(20, 0.05, 0.08)) + rnorm(20, 0, 0.3), 1)
r50x <- round(runif(50, 1, 100), 1); r50y <- round(1.05 * r50x - 0.5 + rnorm(50, 0, 2 + 0.03 * r50x), 1)
r50y <- pmax(r50y, 0.1)
sets <- list(creat = list(cx, cy), s8 = list(s8x, s8y), s7 = list(s7x, s7y), r20 = list(r20x, r20y),
             r50 = list(r50x, r50y))

# Deming (unweighted), analytical
for (s in sets) for (er in c(1, 0.25, 2, 4)) add(x = s[[1]], y = s[[2]], methodReg = "Deming", methodCi = "analytical", errorRatio = er)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", alpha = 0.1)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", alpha = 0.01)
add(x = s8x, y = rev(s8y), methodReg = "Deming", methodCi = "analytical")                       # negative slope
add(x = c(1, 2, 3, 4, 5), y = c(10, 8.1, 6.2, 3.9, 2), methodReg = "Deming", methodCi = "analytical")
add(x = c(1, 2, 3, 4, 5), y = c(2, 4, 6, 8, 10), methodReg = "Deming", methodCi = "analytical")  # exact line: SE 0
add(x = c(1, 2, 3, 4, 5), y = c(3, 1, 2, 1, 3), methodReg = "Deming", methodCi = "analytical")  # Sxy = 0: NaN
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = 1e-300)      # mcr gives slope 0
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = 1e-12)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = 1e12)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = 1e300)
add(x = c(1, 2, 3), y = c(1.1, 2.3, 2.9), methodReg = "Deming", methodCi = "analytical")
# Deming, jackknife and bootstrap
for (s in sets[c("creat", "s8", "r20")]) add(x = s[[1]], y = s[[2]], methodReg = "Deming", methodCi = "jackknife")
add(x = r20x, y = r20y, methodReg = "Deming", methodCi = "jackknife", errorRatio = 2, alpha = 0.1)
for (bci in c("quantile", "Student", "BCa", "tBoot"))
  add(x = r20x, y = r20y, methodReg = "Deming", methodCi = "bootstrap", methodBootstrapCi = bci, nsamples = 99, rngSeed = 7)
add(x = cx, y = cy, methodReg = "Deming", methodCi = "bootstrap", nsamples = 199, rngSeed = 1)
add(x = r20x, y = r20y, methodReg = "Deming", methodCi = "nestedbootstrap", methodBootstrapCi = "tBoot", nsamples = 30,
    nnested = 10, rngSeed = 11)
add(x = r20x, y = r20y, methodReg = "Deming", methodCi = "nestedbootstrap", methodBootstrapCi = "quantile", nsamples = 30,
    nnested = 5, rngSeed = 12)
# Weighted Deming (constant CV)
for (s in sets[c("creat", "s7", "r20", "r50")]) add(x = s[[1]], y = s[[2]], methodReg = "WDeming", methodCi = "jackknife")
add(x = r20x, y = r20y, methodReg = "WDeming", methodCi = "jackknife", errorRatio = 2)
add(x = s7x, y = s7y, methodReg = "WDeming", methodCi = "jackknife", iterMax = 2)
add(x = s7x, y = s7y, methodReg = "WDeming", methodCi = "jackknife", threshold = 1e-10)
add(x = r20x, y = r20y, methodReg = "WDeming", methodCi = "bootstrap", nsamples = 49, rngSeed = 3)
add(x = r20x, y = r20y, methodReg = "WDeming", methodCi = "bootstrap", methodBootstrapCi = "BCa", nsamples = 49, rngSeed = 3)
add(x = s7x, y = s7y, methodReg = "WDeming", methodCi = "analytical")                           # error
# Passing-Bablok, exact
pbsets <- c(sets, list(
  n3 = list(c(1, 2, 3), c(1.1, 2.3, 2.9)),
  n4 = list(c(0, 2, 3, 4), c(0, 2, 3, 5)),
  n5 = list(c(1, 2, 3, 4, 5), c(1.1, 2.3, 2.9, 4.2, 4.8)),
  neg = list(s8x, rev(s8y)),
  tiesx = list(c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), c(1, 1.2, 2.1, 1.9, 3, 3.3, 3.9, 4.1, 5.2, 4.9)),
  dup = list(c(1, 1, 2, 2, 3, 3, 4, 4, 5, 5), c(1, 1, 2.1, 2.1, 3, 3, 3.9, 3.9, 5.2, 5.2)),
  slope1 = list(c(1, 2, 3, 4, 5, 6), c(1, 2, 3, 4, 5, 6.5)),
  minus1 = list(c(1, 2, 3, 4, 5, 6, 7), c(2, 1, 3.5, 3, 5.4, 6.1, 6.9)),
  near = list(c(1, 1 + 1e-13, 2, 3, 4, 5), c(1, 2, 2.1, 3, 4, 5.2)),
  near2 = list(c(1, 1 + 1e-11, 2, 3, 4, 5), c(1, 2, 2.1, 3, 4, 5.2)),
  vert = list(c(1, 1, 2, 3, 4, 5, 6), c(1, 3, 2.2, 2.9, 4.1, 5, 6.2)),
  int = list(c(2, 4, 4, 6, 7, 9, 10, 12, 15, 15), c(3, 4, 5, 6, 8, 9, 11, 12, 14, 16))))
for (s in pbsets) add(x = s[[1]], y = s[[2]], methodReg = "PaBa", methodCi = "analytical")
for (s in pbsets[c("creat", "s8", "neg", "dup", "minus1", "int")])
  add(x = s[[1]], y = s[[2]], methodReg = "PaBa", methodCi = "analytical", slopeMeasure = "tangent")
for (a in c(0.1, 0.01, 0.5)) add(x = r50x, y = r50y, methodReg = "PaBa", methodCi = "analytical", alpha = a)
add(x = s8x, y = s8y, methodReg = "PaBa", methodCi = "analytical", alpha = 0.5)
for (s in sets[c("s8", "r20")]) add(x = s[[1]], y = s[[2]], methodReg = "PaBa", methodCi = "jackknife")
add(x = r20x, y = r20y, methodReg = "PaBa", methodCi = "bootstrap", nsamples = 99, rngSeed = 5)
add(x = r20x, y = r20y, methodReg = "PaBa", methodCi = "bootstrap", methodBootstrapCi = "BCa", nsamples = 99, rngSeed = 5)
add(x = r20x, y = r20y, methodReg = "PaBa", methodCi = "bootstrap", methodBootstrapCi = "Student", nsamples = 99, rngSeed = 5)
add(x = r20x, y = r20y, methodReg = "PaBa", methodCi = "nestedbootstrap", methodBootstrapCi = "tBoot", nsamples = 20,
    nnested = 5, rngSeed = 6)
add(x = r20x, y = r20y, methodReg = "PaBa", methodCi = "bootstrap", methodBootstrapCi = "tBoot", nsamples = 20, rngSeed = 6)
add(x = s8x, y = s8y, rngSeed = 2)                                                               # defaults: PaBa, bootstrap, 999
# Passing-Bablok for large data (binned)
for (s in sets) add(x = s[[1]], y = s[[2]], methodReg = "PaBaLarge", methodCi = "analytical")
add(x = r50x, y = r50y, methodReg = "PaBaLarge", methodCi = "analytical", NBins = 1000)
add(x = r50x, y = r50y, methodReg = "PaBaLarge", methodCi = "analytical", NBins = 1000, slopeMeasure = "tangent")
add(x = s8x, y = rev(s8y), methodReg = "PaBaLarge", methodCi = "analytical")
add(x = c(1, 2, 3), y = c(1.1, 2.3, 2.9), methodReg = "PaBaLarge", methodCi = "analytical")
# argument checks and missing values
add(x = c(1, 2), y = c(1, 2), methodReg = "Deming", methodCi = "analytical")
add(x = c(1, 2, NA, 4, 5), y = c(1, 2, 3, 5, 6), methodReg = "Deming", methodCi = "analytical")
add(x = c(1, 2, NA, 4, 5), y = c(1, 2, 3, 5, 6), methodReg = "Deming", methodCi = "analytical", naRm = TRUE)
add(x = c(1, 2, NA, 4, 5, 6), y = c(1, 2, 3, 5, NA, 6.2), methodReg = "PaBa", methodCi = "analytical", naRm = TRUE)
add(x = c(1, 1, 1, 1), y = c(1, 2, 3, 5), methodReg = "Deming", methodCi = "analytical")
add(x = c(1, 2, 3, 4), y = c(2, 2, 2, 2), methodReg = "PaBa", methodCi = "analytical")
add(x = c(-1, 2, 3, 4), y = c(1, 2, 3, 5), methodReg = "PaBa", methodCi = "analytical")
add(x = c(0, 2, 3, 4), y = c(1, 2, 3, 5), methodReg = "WDeming", methodCi = "jackknife")
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = 0)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = -1)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", errorRatio = Inf)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", alpha = 1)
add(x = s7x, y = s7y, methodReg = "Deming", methodCi = "analytical", alpha = 0)
add(x = s7x, y = s7y, methodReg = "PaBaAlt", methodCi = "analytical")
add(x = s7x, y = s7y, methodReg = "Dem", methodCi = "ana")
add(x = s7x, y = s7y, methodReg = "PaBa", methodCi = "bootstrap", methodBootstrapCi = "tBoot", rngSeed = 1)
add(x = s7x, y = s7y[-1], methodReg = "PaBa", methodCi = "analytical")
# scaling by powers of two
for (e in c(-540, -500, 500, 520, 1000)) add(x = s7x * 2^e, y = s7y * 2^e, methodReg = "Deming", methodCi = "analytical", scale = e)
for (e in c(-540, 1020)) add(x = s8x * 2^e, y = s8y * 2^e, methodReg = "PaBa", methodCi = "analytical", scale = e)

run_mcreg <- function(a, threshold = a$threshold, iterMax = a$iterMax) {
  args <- list(x = a$x, y = a$y, method.reg = a$methodReg, method.ci = a$methodCi,
               method.bootstrap.ci = a$methodBootstrapCi, error.ratio = a$errorRatio, alpha = a$alpha,
               slope.measure = a$slopeMeasure, nsamples = a$nsamples, nnested = a$nnested, rng.seed = a$rngSeed,
               iter.max = iterMax, threshold = threshold, na.rm = a$naRm, NBins = a$NBins)
  r <- NULL
  invisible(capture.output(r <- call_with(mcreg, args)))
  r
}

para_json <- function(p) list(Intercept = I(num2str(unname(p["Intercept", ]))), Slope = I(num2str(unname(p["Slope", ]))))

write_htest_fixture("mcreg", cases, function(a) {
  r <- run_mcreg(a)
  out <- list(para = para_json(r@para))
  if (.hasSlot(r, "xmean")) out$xmean <- num2str(r@xmean)
  if (identical(r@regmeth, "WDeming")) out$weight <- I(num2str(unname(r@weight)))
  if (.hasSlot(r, "B0jack")) { out$B0jack <- I(num2str(r@B0jack)); out$B1jack <- I(num2str(r@B1jack)) }
  if (.hasSlot(r, "B0")) {
    out$B0 <- I(num2str(r@B0)); out$B1 <- I(num2str(r@B1))
    out$sigmaB0 <- I(num2str(r@sigmaB0)); out$sigmaB1 <- I(num2str(r@sigmaB1))
    out$glob.sigma <- I(num2str(r@glob.sigma)); out$nsamples <- num2str(r@nsamples)
  }
  if (r@regmeth %in% c("PaBa", "PaBaLarge") && r@cimeth == "analytical") {
    cs <- calcCUSUM(r)
    out$cusum <- list(nPos = num2str(cs$nPos), nNeg = num2str(cs$nNeg), cusum = I(num2str(cs$cusum)),
                      max.cusum = num2str(cs$max.cusum))
  }
  out
}, ref = function(a) {
  reg <- if (is.null(a$methodReg)) "PaBa" else a$methodReg
  if (!is.null(a$scale)) {
    k <- 2^a$scale
    r <- tryCatch(run_mcreg(modifyList(a, list(x = a$x / k, y = a$y / k))), error = function(e) NULL)
    if (is.null(r)) return(NULL)
    p <- r@para
    p["Intercept", ] <- p["Intercept", ] * k
    out <- list(refKind = "scaled", para = para_json(p))
    if (reg == "Deming") out$xmean <- num2str(r@xmean * k)
    return(out)
  }
  if (reg == "Deming" && identical(a$methodCi, "analytical")) {
    er <- if (is.null(a$errorRatio)) 1 else a$errorRatio
    alpha <- if (is.null(a$alpha)) 0.05 else a$alpha
    ok <- !(is.na(a$x) | is.na(a$y))
    if (!is.finite(er) || er <= 0) return(NULL)
    X <- mp(a$x[ok]); Y <- mp(a$y[ok]); n <- length(X); L <- mp(er)
    mx <- sum(X) / n; my <- sum(Y) / n
    u <- sum((X - mx)^2); q <- sum((Y - my)^2); p <- sum((X - mx) * (Y - my))
    if (asNumeric(p) == 0) return(NULL)
    A <- L * q - u; R <- sqrt(A^2 + 4 * L * p^2)
    # Both forms of the root, each used where it does not cancel
    b1 <- if (asNumeric(A) >= 0) (A + R) / (2 * L * p) else 2 * p / (R - A)
    b0 <- my - b1 * mx
    r2 <- p^2 / (u * q)
    seb1 <- sqrt(b1^2 * (1 - r2) / r2 / (n - 2))
    seb0 <- sqrt(seb1^2 * sum(X^2) / n)
    t <- qt(1 - alpha / 2, n - 2)
    v <- function(z) asNumeric(z)
    para <- rbind(Intercept = c(v(b0), v(seb0), v(b0) - t * v(seb0), v(b0) + t * v(seb0)),
                  Slope = c(v(b1), v(seb1), v(b1) - t * v(seb1), v(b1) + t * v(seb1)))
    return(list(refKind = "mpfr", para = para_json(para), xmean = num2str(v(mx))))
  }
  if (reg == "WDeming" && !identical(a$methodCi, "analytical")) {
    r <- tryCatch(suppressWarnings(run_mcreg(a, threshold = 0, iterMax = 1000)), error = function(e) NULL)
    if (is.null(r)) return(NULL)
    out <- list(refKind = "converged", para = para_json(r@para))
    if (.hasSlot(r, "xmean")) out$xmean <- num2str(r@xmean)
    out$weight <- I(num2str(unname(r@weight)))
    if (.hasSlot(r, "B0jack")) { out$B0jack <- I(num2str(r@B0jack)); out$B1jack <- I(num2str(r@B1jack)) }
    if (.hasSlot(r, "B0")) { out$B0 <- I(num2str(r@B0)); out$B1 <- I(num2str(r@B1)) }
    return(out)
  }
  NULL
}, warnings = TRUE)

# The shared writer leaves out the reference of a case where R failed; the scaled cases where mcr fails (its check
# sd > 0 underflows) get it here, appended to their line
local({
  path <- file.path(HTEST_OUT, "mcreg.json")
  lines <- readLines(path)
  first <- grep("^    \\{", lines)[1]
  for (i in seq_along(cases)) {
    a <- cases[[i]]
    if (is.null(a$scale)) next
    ln <- lines[first + i - 1]
    if (!grepl('"expected":\\{"error"', ln)) next
    k <- 2^a$scale
    r <- run_mcreg(modifyList(a, list(x = a$x / k, y = a$y / k)))
    p <- r@para
    p["Intercept", ] <- p["Intercept", ] * k
    ref <- list(refKind = "scaled", para = para_json(p))
    if (a$methodReg == "Deming") ref$xmean <- num2str(r@xmean * k)
    js <- as.character(jsonlite::toJSON(ref, auto_unbox = TRUE, digits = NA))
    lines[first + i - 1] <- sub("\\}(,?)$", paste0(',"reference":', js, "}\\1"), ln)
  }
  writeLines(lines, path)
})
