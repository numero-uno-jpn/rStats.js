# iptw113-edge2.R: the second round of edge cases (1.13.0), public calls only. Settles what R does with extreme scales
# of the covariates and times of survfit(coxph, newdata), of non-integer Kaplan-Meier weights, of the x and y of
# svyglm and with a separated binomial outcome; summary() of a weightit with a degenerate group; trim() with at near 1
# and at as large as the group; bal.tab with scores at 0 and 1.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(WeightIt); library(cobalt); library(survey); library(survival) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(R = R.version.string, arch = R.version$arch)

## data: the mild data of iptw113 with outcomes
set.seed(20261125)
n <- 80
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4); x3 <- factor(sample(c("a", "b", "c"), n, replace = TRUE))
tr <- rbinom(n, 1, plogis(-0.3 + 0.5 * x1 + 0.5 * x2 - 0.4 * (x3 == "c")))
set.seed(4)
y <- round(1 + 0.5 * tr + 0.7 * x1 + rnorm(n), 3); yb <- rbinom(n, 1, plogis(-0.3 + 0.6 * tr + 0.5 * x1))
time <- round(rexp(n, 0.1), 2); status <- rbinom(n, 1, 0.8)
d0 <- data.frame(tr = tr, x1 = x1, x2 = x2, y = y, yb = yb, time = time, status = status)
d0$w <- weightit(tr ~ x1 + x2, data = d0, method = "glm", estimand = "ATE")$weights
out$data <- as.list(d0)

## survfit(coxph, newdata): extreme scales and offsets of x1 and of the times
cox <- function(d, nd) { m <- coxph(Surv(time, status) ~ tr + x1, data = d, weights = w, robust = TRUE)
  s <- survfit(m, newdata = nd)
  list(coef = unname(coef(m)), time = s$time, surv = as.vector(s$surv), std.err = as.vector(s$std.err),
       lower = as.vector(s$lower), upper = as.vector(s$upper)) }
for (cs in list(c(1, 0, 1), c(1e300, 0, 1), c(1e-300, 0, 1), c(1, 1e15, 1), c(1e150, 0, 1), c(1, 0, 1e300), c(1, 0, 1e-300))) {
  d <- d0; d$x1 <- d$x1 * cs[1] + cs[2]; d$time <- d$time * cs[3]
  nd <- data.frame(tr = c(0, 1), x1 = 0.5 * cs[1] + cs[2])
  out[[sprintf("cox_x%g_off%g_t%g", cs[1], cs[2], cs[3])]] <- run(cox(d, nd))
}

## weighted Kaplan-Meier with non-integer weights on extreme scales (default robust and robust = FALSE)
for (sc in c(1, 1e200, 1e-200)) for (rob in c("default", "FALSE")) {
  d <- d0; d$w <- d$w * sc
  out[[sprintf("km_w%g_%s", sc, rob)]] <- run({
    v <- if (rob == "default") survfit(Surv(time, status) ~ tr, data = d, weights = w)
         else survfit(Surv(time, status) ~ tr, data = d, weights = w, robust = FALSE)
    list(surv = v$surv, std.err = v$std.err, lower = v$lower, upper = v$upper, n.risk = v$n.risk) })
}

## svyglm: extreme scales and offsets of x1 and y, a separated binomial outcome
svy <- function(d, f, fam) { m <- svyglm(f, design = svydesign(ids = ~1, weights = ~w, data = d), family = fam)
  list(coef = unname(coef(m)), se = unname(sqrt(diag(vcov(m)))), dispersion = as.numeric(summary(m)$dispersion),
       deviance = as.numeric(m$deviance)) }
for (cs in list(c(1, 0), c(1e150, 0), c(1e-150, 0), c(1, 1e15), c(1e-300, 0))) {
  d <- d0; d$x1 <- d$x1 * cs[1] + cs[2]
  out[[sprintf("svy_gauss_x%g_off%g", cs[1], cs[2])]] <- run(svy(d, y ~ tr + x1, gaussian()))
  out[[sprintf("svy_quasibin_x%g_off%g", cs[1], cs[2])]] <- run(svy(d, yb ~ tr + x1, quasibinomial()))
}
for (sc in c(1e300, 1e-300)) {
  d <- d0; d$y <- d$y * sc
  out[[sprintf("svy_gauss_y%g", sc)]] <- run(svy(d, y ~ tr + x1, gaussian()))
}
d <- d0; d$ysep <- as.integer(d$x1 > 0)
out$svy_separated <- run(svy(d, ysep ~ tr + x1, quasibinomial()))

## summary(weightit) with a degenerate group: one treated unit; trimmed weights with zeros given by as.weightit
one <- data.frame(tr = c(1, rep(0, 9)), x1 = c(0.3, -1, -0.5, 0, 0.2, 0.8, 1.1, -0.2, 0.4, 0.6))
out$summary_one_treated <- run({ w <- weightit(tr ~ x1, data = one, method = "glm"); s <- summary(w)
  list(weights = unname(w$weights), coef.of.var = as.list(s$coef.of.var), scaled.mad = as.list(s$scaled.mad),
       negative.entropy = as.list(s$negative.entropy), ess = as.vector(s$effective.sample.size)) })
out$summary_zero_group <- run({ w <- as.weightit(c(0, 0, 0, 1, 2, 3), treat = c(1, 1, 1, 0, 0, 0)); s <- summary(w)
  list(coef.of.var = as.list(s$coef.of.var), scaled.mad = as.list(s$scaled.mad),
       negative.entropy = as.list(s$negative.entropy), num.zeros = as.list(s$num.zeros),
       ess = as.vector(s$effective.sample.size)) })

## trim: at near 1, at as large as the group, at larger than the group
wv <- c(5, 1, 2, 9, 3, 4, 8, 6, 7, 10)
for (at in c(0.999999, 0.95, 9, 10, 15)) for (lo in c(TRUE, FALSE)) {
  out[[sprintf("trim_%g_%s", at, lo)]] <- run(trim(wv, at = at, lower = lo))
}
for (at in c(0.999999, 48, 60)) {
  out[[sprintf("trimATT_%g", at)]] <- run(unname(trim(weightit(tr ~ x1 + x2, data = d0, estimand = "ATT"), at = at, lower = TRUE)$weights))
}

## bal.tab with scores at 0 and 1 (separation)
sep <- data.frame(tr = c(0, 0, 0, 0, 1, 1, 1, 1), x1 = c(1, 2, 3, 4, 5, 6, 7, 8), x2 = c(0, 1, 0, 1, 1, 0, 1, 0))
out$bal_separation <- run({ w <- weightit(tr ~ x1 + x2, data = sep, method = "glm")
  b <- bal.tab(w, stats = c("mean.diffs", "variance.ratios"), un = TRUE, binary = "std")
  list(ps = unname(w$ps), weights = unname(w$weights), rows = rownames(b$Balance), diffUn = b$Balance$Diff.Un,
       diffAdj = b$Balance$Diff.Adj, vRatioAdj = b$Balance$V.Ratio.Adj) })

## large n: the time R takes (for comparison with rStats.js)
set.seed(9)
N <- 5000
big <- data.frame(x1 = rnorm(N), x2 = rbinom(N, 1, 0.4), x3 = rnorm(N))
big$tr <- rbinom(N, 1, plogis(-0.2 + 0.5 * big$x1 + 0.4 * big$x2 - 0.3 * big$x3))
out$big <- as.list(big)
for (m in c("glm", "cbps", "ipt", "ebal")) {
  t0 <- proc.time()[["elapsed"]]
  r <- run(weightit(tr ~ x1 + x2 + x3, data = big, method = m, estimand = "ATE"))
  out[[sprintf("big_%s", m)]] <- list(seconds = proc.time()[["elapsed"]] - t0,
                                      weights = if (is.null(r$value)) NULL else unname(r$value$weights),
                                      error = r$error, warnings = r$warnings)
}

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
