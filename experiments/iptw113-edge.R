# iptw113-edge.R: edge cases of weightit, trim, bal.tab, svyglm and survfit(coxph) (1.13.0), public calls only.
# Settles what R does with near-separated data, extreme scales of a covariate and of the weights, a constant covariate,
# a factor level present in one group only and a very small sample.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(WeightIt); library(CBPS); library(cobalt); library(survey); library(survival) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
wres <- function(w) list(weights = unname(w$weights), ps = if (is.null(w$ps)) NULL else unname(w$ps))
out <- list(R = R.version.string, arch = R.version$arch)

## near separation: the first draft of iptw113 (strong x1 effect)
set.seed(20261125)
n <- 80
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4); x3 <- factor(sample(c("a", "b", "c"), n, replace = TRUE))
tr <- rbinom(n, 1, plogis(-0.4 + 0.9 * x1 + 0.8 * x2 - 0.5 * (x3 == "c")))
hard <- data.frame(tr = tr, x1 = x1, x2 = x2, x3 = x3)
out$hard <- list(tr = tr, x1 = x1, x2 = x2, x3 = as.character(x3))
grid <- list(c("glm", "logit"), c("cbps", "logit"), c("cbps", "probit"), c("ipt", "logit"), c("ebal", NA))
for (g in grid) for (e in c("ATE", "ATT", "ATC", "ATO")) {
  if (g[1] %in% c("ipt", "ebal") && e == "ATO") next
  key <- sprintf("hard_%s_%s_%s", g[1], if (is.na(g[2])) "none" else g[2], e)
  r <- run(if (is.na(g[2])) weightit(tr ~ x1 + x2 + x3, data = hard, method = g[1], estimand = e)
           else weightit(tr ~ x1 + x2 + x3, data = hard, method = g[1], link = g[2], estimand = e))
  if (!is.null(r$value)) r$value <- wres(r$value)
  out[[key]] <- r
}

## the mild data of iptw113 with x1 on extreme scales and offsets
set.seed(20261125)
x1 <- round(rnorm(n), 3); x2 <- rbinom(n, 1, 0.4); x3 <- factor(sample(c("a", "b", "c"), n, replace = TRUE))
tr <- rbinom(n, 1, plogis(-0.3 + 0.5 * x1 + 0.5 * x2 - 0.4 * (x3 == "c")))
mild <- data.frame(tr = tr, x1 = x1, x2 = x2, x3 = x3)
for (sc in list(c(1e150, 0), c(1e-150, 0), c(1, 1e15), c(1e-300, 0))) {
  d <- mild; d$x1 <- d$x1 * sc[1] + sc[2]
  for (g in grid) {
    key <- sprintf("scale_%g_%g_%s_%s", sc[1], sc[2], g[1], if (is.na(g[2])) "none" else g[2])
    r <- run(if (is.na(g[2])) weightit(tr ~ x1 + x2 + x3, data = d, method = g[1], estimand = "ATE")
             else weightit(tr ~ x1 + x2 + x3, data = d, method = g[1], link = g[2], estimand = "ATE"))
    if (!is.null(r$value)) r$value <- wres(r$value)
    out[[key]] <- r
  }
}

## a constant covariate, a factor level in one group only, a very small sample
d <- mild; d$k <- 5
for (g in grid) out[[sprintf("const_%s", g[1])]] <- run(wres(
  if (is.na(g[2])) weightit(tr ~ x1 + k, data = d, method = g[1]) else weightit(tr ~ x1 + k, data = d, method = g[1], link = g[2])))
d <- mild; d$f <- factor(ifelse(d$tr == 1 & seq_len(n) %% 7 == 0, "only", "common"))
out$oneGroupLevel <- list(f = as.character(d$f))
for (g in grid) out[[sprintf("onelevel_%s", g[1])]] <- run(wres(
  if (is.na(g[2])) weightit(tr ~ x1 + f, data = d, method = g[1]) else weightit(tr ~ x1 + f, data = d, method = g[1], link = g[2])))
small <- data.frame(tr = c(1, 0, 1, 0, 1, 0), x1 = c(0.5, 0.1, -0.3, 0.8, 1.2, -0.6))
for (g in grid) out[[sprintf("small_%s", g[1])]] <- run(wres(
  if (is.na(g[2])) weightit(tr ~ x1, data = small, method = g[1]) else weightit(tr ~ x1, data = small, method = g[1], link = g[2])))

## weights on extreme scales: bal.tab, svyglm, weighted coxph + survfit (the answers should not change)
w <- weightit(tr ~ x1 + x2 + x3, data = mild, method = "glm", estimand = "ATE")$weights
set.seed(3); mild$y <- rbinom(n, 1, 0.4); mild$time <- round(rexp(n, 0.1), 2); mild$status <- rbinom(n, 1, 0.8)
for (sc in c(1, 1e200, 1e-200)) {
  d <- mild; d$w <- w * sc
  s <- run({ m <- svyglm(y ~ tr + x1, design = svydesign(ids = ~1, weights = ~w, data = d), family = quasibinomial())
             list(coef = unname(coef(m)), se = unname(sqrt(diag(vcov(m))))) })
  b <- run({ bt <- bal.tab(tr ~ x1 + x2, data = d, weights = "w", method = "weighting", estimand = "ATE", un = TRUE,
                           binary = "std"); list(diffAdj = bt$Balance$Diff.Adj, obs = bt$Observations$Treated) })
  k <- run({ m <- coxph(Surv(time, status) ~ tr + x1, data = d, weights = w, robust = TRUE)
             sf <- survfit(m, newdata = data.frame(tr = c(0, 1), x1 = 0))
             list(coef = unname(coef(m)), surv = as.vector(sf$surv), std.err = as.vector(sf$std.err)) })
  out[[sprintf("wscale_%g", sc)]] <- list(svyglm = s, bal = b, cox = k)
}
out$mild <- list(tr = mild$tr, x1 = mild$x1, x2 = mild$x2, x3 = as.character(mild$x3), y = mild$y, time = mild$time,
                 status = mild$status, w = w)

## trim with all weights equal, and at = 0.5
out$trim_equal <- run(trim(rep(2, 10), at = 0.9, lower = TRUE))
out$trim_ties <- run(trim(c(1, 1, 1, 2, 2, 2, 3, 3, 3, 9), at = 0.9, lower = TRUE))

cat(toJSON(out, auto_unbox = TRUE, digits = I(17), null = "null", na = "null"), "\n")
