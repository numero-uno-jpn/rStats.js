# mediation116-summary.R: mediate's point estimates, intervals, p-values and proportions from its stored draws, and its
# use of the generator with binomial glm models (1.16.0), public functions only. The parameter draws are those settled
# in mediation116-order.R (rows of normals times the symmetric square root of vcov, the mediator model first).
# Candidate formulas are written here and compared with the output.
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(R = R.version.string, arch = R.version$arch, mediation = as.character(packageVersion("mediation")))
set.seed(20261125)
n <- 60
C <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
M <- 0.5 * X + 0.3 * C + rnorm(n); Mb <- 0.8 * Xb + 0.3 * C + rnorm(n)
Y <- 0.4 * M + 0.2 * X - 0.2 * C + rnorm(n); Yb <- 0.4 * Mb + 0.5 * Xb - 0.2 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-1 + 0.9 * Xb + 0.4 * C))
Ybin <- rbinom(n, 1, plogis(-0.5 + 0.8 * Mb + 0.6 * Xb))
Ybin2 <- rbinom(n, 1, plogis(-0.5 + 1.2 * Mbin + 0.6 * Xb))
Ycont2 <- 0.9 * Mbin + 0.4 * Xb + rnorm(n)
d <- data.frame(C, X, Xb, M, Mb, Y, Yb, Mbin, Ybin, Ybin2, Ycont2)
assign("d", d, envir = globalenv())
sims <- 200

sym_sqrt <- function(S) { e <- eigen(S, symmetric = TRUE); e$vectors %*% diag(sqrt(pmax(e$values, 0)), nrow(S)) %*% t(e$vectors) }
draw_rows <- function(mu, S, k) { p <- length(mu); Z <- matrix(rnorm(k * p), k, byrow = TRUE); sweep(Z %*% sym_sqrt(S), 2, mu, "+") }
parts <- function(r) list(
  d0 = r$d0, d1 = r$d1, z0 = r$z0, z1 = r$z1, tau = r$tau.coef, n0 = r$n0, n1 = r$n1, d.avg = r$d.avg, z.avg = r$z.avg,
  n.avg = r$n.avg, d0.ci = r$d0.ci, d1.ci = r$d1.ci, z0.ci = r$z0.ci, z1.ci = r$z1.ci, tau.ci = r$tau.ci, n0.ci = r$n0.ci,
  n1.ci = r$n1.ci, d.avg.ci = r$d.avg.ci, z.avg.ci = r$z.avg.ci, n.avg.ci = r$n.avg.ci,
  d0.p = r$d0.p, d1.p = r$d1.p, z0.p = r$z0.p, z1.p = r$z1.p, tau.p = r$tau.p, n0.p = r$n0.p, n1.p = r$n1.p,
  d.avg.p = r$d.avg.p, z.avg.p = r$z.avg.p, n.avg.p = r$n.avg.p,
  d0.sims = as.vector(r$d0.sims), d1.sims = as.vector(r$d1.sims), z0.sims = as.vector(r$z0.sims),
  z1.sims = as.vector(r$z1.sims), tau.sims = as.vector(r$tau.sims), n0.sims = as.vector(r$n0.sims),
  n1.sims = as.vector(r$n1.sims), d.avg.sims = as.vector(r$d.avg.sims), n.avg.sims = as.vector(r$n.avg.sims),
  treat.value = r$treat.value, control.value = r$control.value, conf.level = r$conf.level, nobs = r$nobs,
  INT = r$INT, boot.ci.type = r$boot.ci.type)
summary_text <- function(r) capture.output(print(summary(r)))

## 1. the summaries of the draws (lm / lm, binary X, with an X:M interaction so that d0 != d1)
fm <- lm(Mb ~ Xb + C, data = d)
fy <- lm(Yb ~ Xb * Mb + C, data = d)
set.seed(1234)
r <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = FALSE, sims = sims)
out$lm_int <- parts(r)
out$lm_int_printed <- summary_text(r)
q7 <- function(v, lv = 0.95) unname(quantile(v, c((1 - lv) / 2, (1 + lv) / 2), type = 7))
pcands <- function(v) c(
  two_min = 2 * min(mean(v > 0), mean(v < 0)), two_min_ge = 2 * min(mean(v >= 0), mean(v <= 0)),
  two_sum = 2 * min(sum(v > 0), sum(v < 0)) / length(v))
cmp <- function(v) list(mean = mean(v), median = median(v), q7 = q7(v), q1 = unname(quantile(v, c(0.025, 0.975), type = 1)),
                        q6 = unname(quantile(v, c(0.025, 0.975), type = 6)), p = as.list(pcands(v)))
out$lm_int_candidates <- list(
  d0 = cmp(out$lm_int$d0.sims), d1 = cmp(out$lm_int$d1.sims), z0 = cmp(out$lm_int$z0.sims),
  tau = cmp(out$lm_int$tau.sims), n0 = cmp(out$lm_int$n0.sims),
  n0_ratio = max(abs(out$lm_int$n0.sims - out$lm_int$d0.sims / out$lm_int$tau.sims)),
  n1_ratio = max(abs(out$lm_int$n1.sims - out$lm_int$d1.sims / out$lm_int$tau.sims)),
  tau_sum = max(abs(out$lm_int$tau.sims - (out$lm_int$d0.sims + out$lm_int$z1.sims))),
  tau_sum2 = max(abs(out$lm_int$tau.sims - (out$lm_int$d1.sims + out$lm_int$z0.sims))),
  davg = max(abs(out$lm_int$d.avg.sims - (out$lm_int$d0.sims + out$lm_int$d1.sims) / 2)),
  navg = max(abs(out$lm_int$n.avg.sims - (out$lm_int$n0.sims + out$lm_int$n1.sims) / 2)))
# conf.level 0.9
set.seed(1234)
r90 <- mediate(fm, fy, treat = "Xb", mediator = "Mb", boot = FALSE, sims = sims, conf.level = 0.9)
out$lm_int_90 <- list(d0.ci = r90$d0.ci, q7 = q7(as.vector(r90$d0.sims), 0.9))

## 2. the generator with binomial models: how many draws after the parameter draws, and candidate effects
count_after <- function(fit_m, fit_y, target, draw, limit) {
  set.seed(1234); invisible(draw_rows(coef(fit_m), vcov(fit_m), sims)); invisible(draw_rows(coef(fit_y), vcov(fit_y), sims))
  if (identical(.Random.seed, target)) return(0)
  for (k in seq_len(limit)) { draw(); if (identical(.Random.seed, target)) return(k) }
  NA
}
cases <- list(
  m_lm_y_logit = list(mm = lm(Mb ~ Xb + C, data = d), y = glm(Ybin ~ Xb + Mb + C, family = binomial, data = d), mn = "Mb"),
  m_logit_y_lm = list(mm = glm(Mbin ~ Xb + C, family = binomial, data = d), y = lm(Ycont2 ~ Xb + Mbin + C, data = d), mn = "Mbin"),
  m_logit_y_logit = list(mm = glm(Mbin ~ Xb + C, family = binomial, data = d), y = glm(Ybin2 ~ Xb + Mbin + C, family = binomial, data = d), mn = "Mbin"),
  m_probit_y_lm = list(mm = glm(Mbin ~ Xb + C, family = binomial(link = "probit"), data = d), y = lm(Ycont2 ~ Xb + Mbin + C, data = d), mn = "Mbin"))
out$binomial <- lapply(cases, function(cs) {
  set.seed(1234)
  rr <- run(mediate(cs$mm, cs$y, treat = "Xb", mediator = cs$mn, boot = FALSE, sims = sims))
  st <- .Random.seed
  if (!is.null(rr$error)) return(rr)
  r <- rr$value
  set.seed(1234); A <- draw_rows(coef(cs$mm), vcov(cs$mm), sims); B <- draw_rows(coef(cs$y), vcov(cs$y), sims)
  list(parts = parts(r), warnings = rr$warnings,
       normals_after = count_after(cs$mm, cs$y, st, function() rnorm(1), 3 * sims * n),
       uniforms_after = count_after(cs$mm, cs$y, st, function() runif(1), 6 * sims * n),
       A_head = A[1:3, ], B_head = B[1:3, ])
})

cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
