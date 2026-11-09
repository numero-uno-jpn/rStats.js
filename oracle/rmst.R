# oracle-platform: amd64
source("/oracle/_anova.R")
suppressPackageStartupMessages({ library(survival); library(survRM2) })

# The restricted mean survival time (ROADMAP item 1): survRM2::rmst2(time, status, arm, tau, covariates, alpha),
# unadjusted (RMST and RMTL per arm, their difference and ratios) and adjusted for covariates (Tian, Zhao & Wei 2014).
# Behaviour in oracle/survfit2-behaviour.md (part 2). Runs on x86_64 R, as oracle/coxph.R (solve() and glm()).
#
#   Arguments (R's names): time, status (1 event, 0 censored), arm (0/1), and optionally tau, alpha, covariates (a
#   matrix written as an array of rows, with covariateNames its column names; or a vector).
#   Expected: tau, note; unadjusted: RMST.arm1 and RMST.arm0 ({result: table RMST/RMTL x Est., se, lower, upper;
#   rmst.var}), unadjusted.result (table); adjusted: adjusted.result, RMST.difference.adjusted, RMST.ratio.adjusted,
#   RMTL.ratio.adjusted (tables). A table is {colNames, rowNames, table (rows)}. warnings. Errors as {"error": message}.
#   reference (with refKind inside), where R is inaccurate:
#     "pvalue"  R computes p = 1 - pchisq(z^2, 1), which cancels for small p (0 below about 1e-16, a relative error
#               of 1e-6 at p = 1e-10); reference = the same tables' p column as 2 * pnorm(-|z|) with z = Est/se (R's
#               values): unadjusted from the log scale of each contrast, adjusted z of each table. Written only when
#               some p differs from R's by more than 1e-14 relative.
#     "scaled"  times * 2^600: R's variance (A^2 terms) overflows; reference = the unscaled results with the times,
#               RMST, RMTL, se, limits and differences multiplied by 2^600 (ratios and p unchanged).

cases <- list()
add <- function(time, status, arm, ...) cases[[length(cases) + 1]] <<- c(list(time = I(time), status = I(status), arm = I(arm)), list(...))
addCov <- function(time, status, arm, X, ...) {
  X <- as.matrix(X)
  add(time, status, arm, covariates = X, covariateNames = I(if (is.null(colnames(X))) rep("", ncol(X)) else colnames(X)), ...)
}

D <- rmst2.sample.data()
add(D$time, D$status, D$arm, tau = 10); add(D$time, D$status, D$arm); add(D$time, D$status, D$arm, tau = 5, alpha = 0.1)
addCov(D$time, D$status, D$arm, D[, c(4, 6, 7)], tau = 10); addCov(D$time, D$status, D$arm, D[, c(4, 6, 7)])
addCov(D$time, D$status, D$arm, D[, c(4, 5, 6, 7, 8)], tau = 8, alpha = 0.1)
add(D$time, D$status, D$arm, tau = 10, covariates = I(D$age))

# the default tau and its checks (help page, cases 1 to 4); last observation tied event/censored counts as censored
t1 <- c(1, 2, 3, 4, 5, 6); s1 <- c(1, 0, 1, 1, 0, 1); t0 <- c(1.5, 2.5, 3.5, 4.5, 7, 8); s0 <- c(1, 1, 0, 1, 1, 0)
arm <- rep(1:0, each = 6)
add(c(t1, t0), c(s1, s0), arm)                                         # 2-1
for (tau in c(5, 6, 6.5, 8, 8.5, 0.5, 0, -1)) add(c(t1, t0), c(s1, s0), arm, tau = tau)
s1b <- replace(s1, 6, 0); add(c(t1, t0), c(s1b, s0), arm); add(c(t1, t0), c(s1b, s0), arm, tau = 6.1)   # 4
s0b <- replace(s0, 6, 1); add(c(t1, t0), c(s1, s0b), arm); add(c(t1, t0), c(s1, s0b), arm, tau = 8); add(c(t1, t0), c(s1, s0b), arm, tau = 9)  # 1
t1c <- replace(t1, 6, 10); add(c(t1c, t0), c(s1, s0), arm); add(c(t1c, t0), c(s1, s0), arm, tau = 9)   # 3-1
add(c(t0, t1c), c(s0, s1), 1 - arm)                                    # 3-2 (arms swapped)
add(c(t0, t1), c(s0b, s1b), 1 - arm)                                    # 2-2
tie1 <- c(1, 2, 3, 4, 5, 6, 6); armT <- rep(1:0, c(7, 6))
add(c(tie1, t0), c(1, 0, 1, 1, 0, 1, 0, s0), armT); add(c(tie1, t0), c(1, 0, 1, 1, 0, 0, 1, s0), armT)
add(c(tie1, t0), c(1, 0, 1, 1, 0, 1, 1, s0), armT)
add(c(t1, t0) / 7, c(s1, s0), arm); add(c(t1, t0) / 7, c(s1b, s0), arm, tau = 1)
add(c(t1, t0), c(s1, s0), arm, tau = 1/3)
# arms, status, missing values, alpha
add(c(t1, t0), c(s1, s0), rep(2:1, each = 6)); add(c(t1, t0), c(s1, s0), rep(1, 12))
add(c(t1, t0), c(s1, s0), c(rep(1, 6), rep(0, 5), 2))
add(c(t1, t0), replace(c(s1, s0), 1, 2), arm)
add(replace(c(t1, t0), 2, NA), c(s1, s0), arm); add(c(t1, t0), c(s1, s0), replace(arm, 3, NA))
add(c(t1, t0), c(s1, s0), arm, alpha = 0.1); add(c(t1, t0), c(s1, s0), arm, alpha = 0.01)
add(c(t1, t0), c(rep(0, 6), s0), arm, tau = 5)                         # no event in arm 1
add(c(t1, t0) - 2, c(s1, s0), arm, tau = 3)                            # negative times
# ties of events and censorings, events at tau (n = d), single observations at risk
add(c(1, 2, 2, 2, 3, 3, 4), c(1, 1, 0, 1, 1, 0, 1), c(1, 1, 1, 0, 0, 0, 0))
add(c(1, 2, 2, 2, 3, 3, 4, 4), c(1, 1, 0, 1, 1, 0, 1, 1), c(1, 1, 1, 0, 0, 0, 0, 1), tau = 4)
for (k in c(-30, 30)) add(c(t1, t0) * 2^k, c(s1, s0), arm)
add(c(t1, t0) * 2^600, c(s1, s0), arm, refKind = "scaled")
add(D$time * 2^600, D$status, D$arm, tau = 10 * 2^600, refKind = "scaled")

# adjusted: censorings at tau, events at tau, censorings after tau, no censoring
set.seed(3)
n <- 40; armA <- rep(0:1, 20); z <- round(rnorm(n), 1); z2 <- rbinom(n, 1, 0.5)
tt <- pmax(round(rexp(n, 0.15 * exp(0.4 * z)), 0), 1); cens <- round(runif(n, 2, 14)); x <- pmin(tt, cens); d <- as.numeric(tt <= cens)
for (tau in c(5, 6, 8, 9.5, 12)) addCov(x, d, armA, cbind(z = z, z2 = z2), tau = tau)
addCov(x, d, armA, cbind(z = z, z2 = z2))
set.seed(1)
n <- 30; armB <- rep(0:1, 15); zb <- round(rnorm(n), 2); tb <- round(rexp(n, 0.2 * exp(0.3 * zb)), 2)
add(tb, rep(1, n), armB, tau = 10.15, covariates = I(zb))
add(tb, replace(rep(1, n), c(3, 8, 15, 22), 0), armB, tau = 10.15, covariates = I(zb))
addCov(D$time, D$status, D$arm, cbind(D[, c(4, 6, 7)], dup = 2 * D$age), tau = 10)       # collinear: R stops
Xna <- as.matrix(D[, c(4, 6, 7)]); Xna[1, 1] <- NA; addCov(D$time, D$status, D$arm, Xna, tau = 10)  # NA: R's NA results
addCov(D$time, D$status, D$arm, unname(as.matrix(D[, c(4, 6, 7)])), tau = 10)

tab_json <- function(m) list(colNames = I(colnames(m)), rowNames = I(rownames(m)),
                             table = lapply(seq_len(nrow(m)), function(i) I(num2str(unname(m[i, ])))))
run <- function(a, scale = 1) {
  cov <- a$covariates
  if (is.matrix(cov)) colnames(cov) <- if (all(a$covariateNames == "")) NULL else a$covariateNames
  if (inherits(cov, "AsIs")) cov <- unclass(cov)
  args <- list(time = unclass(a$time) * scale, status = unclass(a$status), arm = unclass(a$arm))
  if (!is.null(a$tau)) args$tau <- a$tau * scale
  if (!is.null(cov)) args$covariates <- cov
  if (!is.null(a$alpha)) args$alpha <- a$alpha
  do.call(rmst2, args)
}
write_anova_fixture("rmst2", cases, function(a) {
  r <- with_warnings(function() {
    o <- run(a)
    out <- list(tau = num2str(o$tau), note = o$note)
    if (is.null(a$covariates)) {
      arm1 <- function(x) list(result = tab_json(x$result), rmst.var = num2str(x$rmst.var))
      out$RMST.arm1 <- arm1(o$RMST.arm1); out$RMST.arm0 <- arm1(o$RMST.arm0)
      out$unadjusted.result <- tab_json(o$unadjusted.result)
    } else {
      for (nm in c("adjusted.result", "RMST.difference.adjusted", "RMST.ratio.adjusted", "RMTL.ratio.adjusted")) out[[nm]] <- tab_json(o[[nm]])
    }
    out
  })
  c(r$value, list(warnings = r$warnings))
}, ref = function(a) {
  o <- tryCatch(run(a), error = function(e) NULL)
  if (is.null(o)) return(NULL)
  if (identical(a$refKind, "scaled")) {
    k <- 2^600; u <- run(a, 1 / k)
    sc <- function(m, cols) { m[, cols] <- m[, cols] * k; m }
    a1 <- function(x) list(result = tab_json(sc(x$result, 1:4)), rmst.var = num2str(x$rmst.var * k^2))
    ur <- u$unadjusted.result; ur[1, 1:3] <- ur[1, 1:3] * k
    return(list(refKind = "scaled", tau = num2str(u$tau * k), RMST.arm1 = a1(u$RMST.arm1), RMST.arm0 = a1(u$RMST.arm0),
                unadjusted.result = tab_json(ur)))
  }
  pz <- function(z) 2 * pnorm(-abs(z))
  rel <- function(x, y) any(is.finite(x) & is.finite(y) & abs(x - y) > 1e-14 * abs(y))
  if (is.null(a$covariates)) {
    v1 <- o$RMST.arm1$rmst.var; v0 <- o$RMST.arm0$rmst.var; r1 <- o$RMST.arm1$rmst[1]; r0 <- o$RMST.arm0$rmst[1]; tau <- o$tau
    z <- c((r1 - r0) / sqrt(v1 + v0), (log(r1) - log(r0)) / sqrt(v1 / r1^2 + v0 / r0^2),
           (log(tau - r1) - log(tau - r0)) / sqrt(v1 / (tau - r1)^2 + v0 / (tau - r0)^2))
    p <- pz(unname(z)); R <- unname(o$unadjusted.result[, "p"])
    if (!rel(R, p)) return(NULL)
    m <- o$unadjusted.result; m[, "p"] <- p
    return(list(refKind = "pvalue", unadjusted.result = tab_json(m)))
  }
  out <- list(refKind = "pvalue"); differs <- FALSE
  for (nm in c("RMST.difference.adjusted", "RMST.ratio.adjusted", "RMTL.ratio.adjusted")) {
    m <- o[[nm]]; p <- pz(m[, "coef"] / m[, "se(coef)"])
    if (rel(unname(m[, "p"]), unname(p))) differs <- TRUE
    m[, "p"] <- p; out[[nm]] <- tab_json(m)
  }
  # the rows of adjusted.result are the arm rows of the three tables
  m <- o$adjusted.result
  m[, "p"] <- vapply(c("RMST.difference.adjusted", "RMST.ratio.adjusted", "RMTL.ratio.adjusted"), function(nm) {
    t <- o[[nm]]; pz(t["arm", "coef"] / t["arm", "se(coef)"]) }, 0)
  out$adjusted.result <- tab_json(m)
  if (differs) out else NULL
})
