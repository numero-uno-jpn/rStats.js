# issue: 566
# oracle-platform: amd64
# Public outputs of mediation's mediate, interactions' sim_slopes (Johnson-Neyman), MASS's mvrnorm and ReactiveStat's
# procedures (Sobel, the coefficients' Monte Carlo, moderated mediation) for test/fixtures/mediation.json (1.16.0).
# The behaviour and the choices are in oracle/mediation-behaviour.md; the experiments behind them in
# experiments/mediation116*.R. Public calls only. The data sets are written out so that the tests fit the same models.
library(jsonlite)
suppressPackageStartupMessages({ library(MASS); library(mediation); library(interactions); library(sandwich) })
run <- function(expr) {
  warns <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) invokeRestart("muffleMessage"))
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns))
  list(value = value, warnings = warns)
}
out <- list(R = R.version.string, arch = R.version$arch, mediation = as.character(packageVersion("mediation")),
            interactions = as.character(packageVersion("interactions")), MASS = as.character(packageVersion("MASS")))

## data: d (70 rows, as experiments/mediation116-reimpl.R with a moderator W as mediation116-covariates.R)
set.seed(20261125)
n <- 70
C <- rnorm(n); C2 <- rnorm(n); X <- rnorm(n, 5, 2); Xb <- rbinom(n, 1, 0.5)
Mc <- 0.5 * Xb + 0.2 * X + 0.3 * C + rnorm(n)
Mbin <- rbinom(n, 1, plogis(-0.5 + 0.9 * Xb + 0.1 * X + 0.4 * C))
Yc <- 0.4 * Mc + 0.6 * Mbin + 0.5 * Xb + 0.1 * X - 0.2 * C + 0.2 * C2 + rnorm(n)
Ybin <- rbinom(n, 1, plogis(-0.5 + 0.7 * Mc + 0.8 * Mbin + 0.6 * Xb + 0.1 * X))
W <- rnorm(n, 2, 1)
Mw <- Mc + 0.3 * W + 0.3 * Xb * W; Yw <- Yc + 0.2 * W + 0.2 * Mw * W
Wb <- rbinom(n, 1, 0.5)
d <- data.frame(C, C2, X, Xb, Mc, Mbin, Yc, Ybin, W, Mw, Yw, Wb)
assign("d", d, envir = globalenv())
## data: s (80 rows, as experiments/mediation116-slopes.R)
set.seed(20261125)
ns <- 80
sC <- rnorm(ns); sX <- rnorm(ns, 3, 1.5); sW <- rnorm(ns, 10, 3); sWb <- rbinom(ns, 1, 0.4)
sY <- 1 + 0.3 * sX + 0.2 * sW + 0.15 * sX * (sW - 10) + 0.3 * sC + rnorm(ns, 0, 1 + 0.2 * abs(sX))
sYb <- rbinom(ns, 1, plogis(-0.5 + 0.4 * (sX - 3) + 0.3 * (sX - 3) * (sW - 10) / 3))
sY2 <- 1 + 0.3 * sX + 0.5 * sWb + 0.6 * sX * sWb + rnorm(ns)
sYsig <- 1 + 2 * sX + 0.01 * sX * sW + rnorm(ns, 0, 0.3)
sYnone <- 1 + 0.01 * sX + 0.001 * sX * sW + rnorm(ns, 0, 3)
sYin <- 1 + 0.3 * sX * (sW - 10) + rnorm(ns, 0, 0.5)
s <- data.frame(C = sC, X = sX, W = sW, Wb = sWb, Y = sY, Yb = sYb, Y2 = sY2, Ysig = sYsig, Ynone = sYnone, Yin = sYin)
assign("s", s, envir = globalenv())
out$data <- list(d = as.list(d), s = as.list(s))

## mvrnorm
sigmas <- list(p1 = matrix(2.5, 1), p2 = matrix(c(2, 0.6, 0.6, 1), 2), p2neg = matrix(c(1, -0.8, -0.8, 3), 2),
  p2diag = diag(c(1, 4)), p2tiny = matrix(c(1e-200, 0.5e-200, 0.5e-200, 2e-200), 2),
  p3 = matrix(c(4, 1, 0.5, 1, 2, -0.3, 0.5, -0.3, 1), 3), p3singular = tcrossprod(c(1, 2, 3)))
out$mvrnorm <- lapply(sigmas, function(S) {
  p <- nrow(S); mu <- seq_len(p) / 10
  set.seed(42); x <- mvrnorm(7, mu, S); set.seed(42); x1 <- mvrnorm(1, mu, S)
  set.seed(42); big <- mvrnorm(5000, mu, S)
  list(Sigma = S, mu = mu, x = unname(x), one = unname(x1), big_mean = colMeans(matrix(big, ncol = p)),
       big_cov = unname(cov(matrix(big, ncol = p))))
})
out$mvrnorm_errors <- list(notpd = run(mvrnorm(2, c(0, 0), matrix(c(1, 2, 2, 1), 2)))$error,
  dims = run(mvrnorm(2, c(0, 0, 0), diag(2)))$error)

## mediate
keys <- c("d0", "d1", "z0", "z1", "tau", "n0", "n1", "d.avg", "z.avg", "n.avg")
med_out <- function(r) {
  o <- list()
  for (k in keys) {
    pk <- if (k == "tau") "tau.coef" else k; sk <- if (k == "tau") "tau" else k
    o[[k]] <- list(est = r[[pk]], ci = unname(r[[paste0(k, ".ci")]]), p = r[[paste0(k, ".p")]], sims = as.vector(r[[paste0(sk, ".sims")]]))
  }
  c(o, list(treat.value = r$treat.value, control.value = r$control.value, nobs = r$nobs))
}
models <- list(
  lm_lm = list(m = "Mc ~ Xb + C", mf = "gaussian", y = "Yc ~ Xb + Mc + C + C2", yf = "gaussian", treat = "Xb", med = "Mc"),
  lm_lm_int = list(m = "Mc ~ Xb + C", mf = "gaussian", y = "Yc ~ Xb * Mc + C", yf = "gaussian", treat = "Xb", med = "Mc"),
  lm_logit = list(m = "Mc ~ Xb + C", mf = "gaussian", y = "Ybin ~ Xb + Mc + C", yf = "logit", treat = "Xb", med = "Mc"),
  lm_probit = list(m = "Mc ~ Xb + C", mf = "gaussian", y = "Ybin ~ Xb + Mc", yf = "probit", treat = "Xb", med = "Mc"),
  logit_lm = list(m = "Mbin ~ Xb + C", mf = "logit", y = "Yc ~ Xb + Mbin + C", yf = "gaussian", treat = "Xb", med = "Mbin"),
  logit_logit_int = list(m = "Mbin ~ Xb + C", mf = "logit", y = "Ybin ~ Xb * Mbin + C", yf = "logit", treat = "Xb", med = "Mbin"),
  probit_lm = list(m = "Mbin ~ Xb", mf = "probit", y = "Yc ~ Xb + Mbin", yf = "gaussian", treat = "Xb", med = "Mbin"),
  cont_lm_lm = list(m = "Mc ~ X + C", mf = "gaussian", y = "Yc ~ X + Mc + C", yf = "gaussian", treat = "X", med = "Mc"),
  w_lm_lm = list(m = "Mw ~ Xb * W + C", mf = "gaussian", y = "Yw ~ Xb * W + Mw * W + C", yf = "gaussian", treat = "Xb", med = "Mw"),
  w_logit_lm = list(m = "Mbin ~ Xb * W", mf = "logit", y = "Yc ~ Xb + Mbin * W", yf = "gaussian", treat = "Xb", med = "Mbin"))
# the formula and the family objects are put into the call, so that mediate's bootstrap refits (update) find them
fit_of <- function(f, fam) {
  fit <- if (fam == "gaussian") lm(as.formula(f), data = d) else glm(as.formula(f), family = binomial(link = fam), data = d)
  fit$call$formula <- as.formula(f); if (fam != "gaussian") fit$call$family <- binomial(link = fam)
  fit
}
mx <- mean(X); sx <- sd(X); wlo <- mean(W) - sd(W); whi <- mean(W) + sd(W)
settings <- list(
  quasi = list(boot = FALSE, ci = "perc", level = 0.95, robust = FALSE, sims = 200),
  quasi90 = list(boot = FALSE, ci = "perc", level = 0.9, robust = FALSE, sims = 200),
  robust = list(boot = FALSE, ci = "perc", level = 0.95, robust = TRUE, sims = 200),
  boot_perc = list(boot = TRUE, ci = "perc", level = 0.95, robust = FALSE, sims = 50),
  boot_bca = list(boot = TRUE, ci = "bca", level = 0.95, robust = FALSE, sims = 50))
cases <- list()
for (mn in names(models)) for (sn in names(settings)) {
  ms <- models[[mn]]; st <- settings[[sn]]
  if (grepl("^w_", mn) && sn %in% c("quasi90", "robust")) next
  fm <- fit_of(ms$m, ms$mf); fy <- fit_of(ms$y, ms$yf)
  values <- if (ms$treat == "X") list(t1 = mx + sx, t0 = mx - sx) else list(t1 = 1, t0 = 0)
  covs <- if (grepl("^w_", mn)) list(list(W = wlo), list(W = whi)) else list(NULL)
  for (cv in covs) {
    set.seed(1234)
    r <- if (is.null(cv)) mediate(fm, fy, treat = ms$treat, mediator = ms$med, treat.value = values$t1, control.value = values$t0,
                                  boot = st$boot, boot.ci.type = st$ci, sims = st$sims, conf.level = st$level, robustSE = st$robust)
         else mediate(fm, fy, treat = ms$treat, mediator = ms$med, treat.value = values$t1, control.value = values$t0, covariates = cv,
                      boot = st$boot, boot.ci.type = st$ci, sims = st$sims, conf.level = st$level, robustSE = st$robust)
    cases[[length(cases) + 1]] <- list(name = paste(mn, sn, if (is.null(cv)) "" else sprintf("W=%.17g", cv$W)),
      model_m = ms$m, family_m = ms$mf, model_y = ms$y, family_y = ms$yf, treat = ms$treat, mediator = ms$med,
      treat_value = values$t1, control_value = values$t0, covariates = cv, boot = st$boot, ci_type = st$ci,
      conf_level = st$level, robust = st$robust, sims = st$sims, seed = 1234, result = med_out(r))
  }
}
out$mediate <- cases
# defaults (treat.value 1, control.value 0, sims 1000) and errors
set.seed(1234); r <- mediate(lm(Mc ~ X + C, data = d), lm(Yc ~ X + Mc + C, data = d), treat = "X", mediator = "Mc")
out$mediate_default <- list(model_m = "Mc ~ X + C", model_y = "Yc ~ X + Mc + C", treat = "X", mediator = "Mc", seed = 1234,
  d0 = r$d0, d0.ci = unname(r$d0.ci), z0 = r$z0, n0 = r$n0, sims = r$sims, treat.value = r$treat.value, control.value = r$control.value)
out$mediate_errors <- list(
  boot1 = run({ set.seed(1); mediate(lm(Mc ~ Xb, data = d), lm(Yc ~ Xb + Mc, data = d), treat = "Xb", mediator = "Mc", boot = TRUE, sims = 1) })$error)

## sim_slopes and Johnson-Neyman
slope_out <- function(ss) {
  sl <- ss$slopes; jns <- attr(ss, "jns")
  list(values = sl[[1]], est = sl[["Est."]], se = sl[["S.E."]], lo = sl[[4]], hi = sl[[5]], stat = sl[[6]], p = sl[["p"]],
       stat_name = names(sl)[6], ints = list(est = ss$ints[["Est."]], se = ss$ints[["S.E."]], p = ss$ints[["p"]]),
       jn = if (length(jns)) list(bounds = jns[[1]]$bounds, inside = attr(jns[[1]], "inside"), failed = attr(jns[[1]], "failed"),
                                  all_sig = attr(jns[[1]], "all_sig"), modrange = attr(jns[[1]], "modrange")) else NULL)
}
sl_cases <- list(
  list(f = "Y ~ X * W + C", fam = "gaussian", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = FALSE, jn = TRUE),
  list(f = "Y ~ X * W + C", fam = "gaussian", modx = "W", mv = "mean-plus-minus", alpha = 0.1, width = 0.9, robust = FALSE, jn = TRUE),
  list(f = "Y ~ X * W + C", fam = "gaussian", modx = "W", mv = unname(quantile(sW, c(0.25, 0.5, 0.75))), alpha = 0.05, width = 0.95, robust = FALSE, jn = TRUE),
  list(f = "Y ~ X * W + C", fam = "gaussian", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = "HC3", jn = TRUE),
  list(f = "Yb ~ X * W + C", fam = "logit", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = FALSE, jn = TRUE),
  list(f = "Yb ~ X * W + C", fam = "logit", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = "HC3", jn = TRUE),
  list(f = "Y2 ~ X * Wb", fam = "gaussian", modx = "Wb", mv = c(0, 1), alpha = 0.05, width = 0.95, robust = FALSE, jn = FALSE),
  list(f = "Ysig ~ X * W", fam = "gaussian", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = FALSE, jn = TRUE),
  list(f = "Ynone ~ X * W", fam = "gaussian", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = FALSE, jn = TRUE),
  list(f = "Yin ~ X * W", fam = "gaussian", modx = "W", mv = "mean-plus-minus", alpha = 0.05, width = 0.95, robust = FALSE, jn = TRUE))
out$sim_slopes <- lapply(sl_cases, function(cs) {
  fit <- if (cs$fam == "gaussian") lm(as.formula(cs$f), data = s) else glm(as.formula(cs$f), family = binomial(link = cs$fam), data = s)
  # modx is read unevaluated by sim_slopes, so it is written as a literal
  ss <- if (cs$modx == "W") sim_slopes(fit, pred = "X", modx = "W", modx.values = cs$mv, johnson_neyman = cs$jn, jnalpha = cs$alpha,
                                       confint = TRUE, ci.width = cs$width, robust = cs$robust)
        else sim_slopes(fit, pred = "X", modx = "Wb", modx.values = cs$mv, johnson_neyman = cs$jn, jnalpha = cs$alpha,
                        confint = TRUE, ci.width = cs$width, robust = cs$robust)
  list(formula = cs$f, family = cs$fam, modx = cs$modx, modx_values = cs$mv, jnalpha = cs$alpha, ci_width = cs$width,
       robust = cs$robust, johnson_neyman = cs$jn, result = slope_out(ss))
})

## ReactiveStat's procedures
# Sobel and the coefficients' Monte Carlo (both models continuous; X continuous at mean +- SD as ReactiveStat)
fm <- lm(Mc ~ X + C, data = d); fy <- lm(Yc ~ X + Mc + C, data = d)
a <- coef(fm)[["X"]]; sa <- sqrt(vcov(fm)["X", "X"]); b <- coef(fy)[["Mc"]]; sb <- sqrt(vcov(fy)["Mc", "Mc"])
se_sobel <- sqrt(b^2 * sa^2 + a^2 * sb^2)
out$sobel <- list(model_m = "Mc ~ X + C", model_y = "Yc ~ X + Mc + C", treat = "X", mediator = "Mc", a = a, sa = sa, b = b, sb = sb,
  ab = a * b, se = se_sobel, z = a * b / se_sobel, p = 2 * pnorm(abs(a * b / se_sobel), lower.tail = FALSE))
mc_run <- function(level, nmc) {
  set.seed(1234)
  a_mc <- rnorm(nmc, a, sa)
  idx <- c("Mc", "X")
  bc <- mvrnorm(nmc, mu = coef(fy)[idx], Sigma = vcov(fy)[idx, idx])
  ind <- a_mc * bc[, 1]; tot <- ind + bc[, 2]; prop <- ind / tot
  al <- 1 - level; q <- function(v) quantile(v, c(al / 2, 1 - al / 2), names = FALSE)
  list(level = level, nmc = nmc, ci_ind = q(ind), ci_dir = q(bc[, 2]), ci_tot = q(tot), ci_prop = q(prop),
       ind_head = head(ind, 20), dir_head = head(bc[, 2], 20), b_head = head(bc[, 1], 20),
       ab = a * b, cprime = coef(fy)[["X"]], prop = a * b / (a * b + coef(fy)[["X"]]))
}
out$monte_carlo <- list(mc_run(0.95, 20000), mc_run(0.9, 5000))
# moderated mediation, continuous path (mvrnorm of all coefficients: R's values, for statistical comparison only)
fmw <- lm(Mw ~ Xb * W + C, data = d); fyw <- lm(Yw ~ Xb * W + Mw * W + C, data = d)
set.seed(1234); nmc <- 20000
bm <- mvrnorm(nmc, coef(fmw), vcov(fmw)); bo <- mvrnorm(nmc, coef(fyw), vcov(fyw))
cm <- coef(fmw); co <- coef(fyw)
acme_d <- function(w) (bm[, "Xb"] + bm[, "Xb:W"] * w) * (bo[, "Mw"] + bo[, "W:Mw"] * w)
acme_h <- function(w) (cm[["Xb"]] + cm[["Xb:W"]] * w) * (co[["Mw"]] + co[["W:Mw"]] * w)
ade_d <- function(w) bo[, "Xb"] + bo[, "Xb:W"] * w; ade_h <- function(w) co[["Xb"]] + co[["Xb:W"]] * w
q <- function(v) quantile(v, c(0.025, 0.975), names = FALSE)
out$modmed_continuous <- list(model_m = "Mw ~ Xb * W + C", model_y = "Yw ~ Xb * W + Mw * W + C", treat = "Xb", mediator = "Mw",
  moderator = "W", w_lo = wlo, w_hi = whi, nmc = nmc,
  acme_lo = acme_h(wlo), acme_hi = acme_h(whi), ade_lo = ade_h(wlo), ade_hi = ade_h(whi), index = acme_h(whi) - acme_h(wlo),
  ci_acme_lo = q(acme_d(wlo)), ci_acme_hi = q(acme_d(whi)), ci_ade_lo = q(ade_d(wlo)), ci_ade_hi = q(ade_d(whi)),
  ci_tot_lo = q(acme_d(wlo) + ade_d(wlo)), ci_tot_hi = q(acme_d(whi) + ade_d(whi)), ci_index = q(acme_d(whi) - acme_d(wlo)),
  sd_index = sd(acme_d(whi) - acme_d(wlo)))
# moderated mediation, binary path: mediate at W low and high after the same seed
fmb <- glm(Mbin ~ Xb * W, family = binomial, data = d); fyb <- lm(Yc ~ Xb + Mbin * W, data = d)
set.seed(1234); lo <- mediate(fmb, fyb, treat = "Xb", mediator = "Mbin", covariates = list(W = wlo), boot = FALSE, sims = 500)
set.seed(1234); hi <- mediate(fmb, fyb, treat = "Xb", mediator = "Mbin", covariates = list(W = whi), boot = FALSE, sims = 500)
idx <- (hi$d0.sims + hi$d1.sims) / 2 - (lo$d0.sims + lo$d1.sims) / 2
out$modmed_binary <- list(model_m = "Mbin ~ Xb * W", family_m = "logit", model_y = "Yc ~ Xb + Mbin * W", treat = "Xb", mediator = "Mbin",
  moderator = "W", w_lo = wlo, w_hi = whi, sims = 500, seed = 1234, lo = med_out(lo), hi = med_out(hi),
  index = (hi$d0 + hi$d1) / 2 - (lo$d0 + lo$d1) / 2, ci_index = q(as.vector(idx)), index_sims = as.vector(idx))

writeLines(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "null", dataframe = "columns", pretty = FALSE),
           file.path("/out", "mediation.json"))
