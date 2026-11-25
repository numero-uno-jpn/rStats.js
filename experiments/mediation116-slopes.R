# mediation116-slopes.R: interactions' sim_slopes with johnson_neyman (1.16.0), as ReactiveStat calls it, public
# functions only. Settles: the simple slopes, standard errors, intervals and p-values at the moderator values
# ("mean-plus-minus", given values), the Johnson-Neyman bounds and their inside / outside flag, robust = "HC3", and the
# logistic case, by comparison with textbook candidates (slope b1 + b3 w, Var = V11 + 2 w V13 + w^2 V33, t or z, the
# roots of the quadratic (b1 + b3 w)^2 = crit^2 Var(w)).
# (The Johnson-Neyman results are in attr(ss, "jns"), not ss$jn: mediation116-slopes-probe.R.)
# Output: JSON on stdout, 17 significant digits. Run on x86_64 R (rstats-oracle-amd64:4.6.2).
library(jsonlite)
suppressPackageStartupMessages({ library(interactions); library(sandwich) })
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
out <- list(R = R.version.string, arch = R.version$arch, interactions = as.character(packageVersion("interactions")),
            jtools = as.character(packageVersion("jtools")))
set.seed(20261125)
n <- 80
C <- rnorm(n); X <- rnorm(n, 3, 1.5); W <- rnorm(n, 10, 3); Wb <- rbinom(n, 1, 0.4)
Y <- 1 + 0.3 * X + 0.2 * W + 0.15 * X * (W - 10) + 0.3 * C + rnorm(n, 0, 1 + 0.2 * abs(X))
Yb <- rbinom(n, 1, plogis(-0.5 + 0.4 * (X - 3) + 0.3 * (X - 3) * (W - 10) / 3))
Y2 <- 1 + 0.3 * X + 0.5 * Wb + 0.6 * X * Wb + rnorm(n)
d <- data.frame(C, X, W, Wb, Y, Yb, Y2)
assign("d", d, envir = globalenv())

df_list <- function(x) if (is.null(x)) NULL else c(list(names = names(x)), lapply(as.list(as.data.frame(x)), function(v) if (is.factor(v)) as.character(v) else v))
grab <- function(ss) list(
  slopes = df_list(ss$slopes), ints = df_list(ss$ints), modx.values = attr(ss, "modx.values"),
  jn = if (length(attr(ss, "jns"))) lapply(attr(ss, "jns"), function(j) list(bounds = j$bounds, inside = attr(j, "inside"),
       bounds_attr = attributes(j)[setdiff(names(attributes(j)), c("names", "cbands", "class"))],
       cbands_head = df_list(head(j$cbands, 3)), cbands_n = nrow(j$cbands))) else NULL,
  printed = capture.output(print(ss)))

cand <- function(fit, w, V, level, use_t) {
  b <- coef(fit); b1 <- b[["X"]]; b3 <- b[[grep(":", names(b), value = TRUE)[1]]]; wn <- grep(":", names(b), value = TRUE)[1]
  v11 <- V["X", "X"]; v13 <- V["X", wn]; v33 <- V[wn, wn]
  est <- b1 + b3 * w; sev <- sqrt(v11 + 2 * w * v13 + w^2 * v33)
  crit <- if (use_t) qt((1 + level) / 2, df.residual(fit)) else qnorm((1 + level) / 2)
  stat <- est / sev; p <- if (use_t) 2 * pt(-abs(stat), df.residual(fit)) else 2 * pnorm(-abs(stat))
  list(est = est, se = sev, lo = est - crit * sev, hi = est + crit * sev, stat = stat, p = p)
}
jn_cand <- function(fit, V, alpha, use_t) {
  b <- coef(fit); wn <- grep(":", names(b), value = TRUE)[1]; b1 <- b[["X"]]; b3 <- b[[wn]]
  crit <- if (use_t) qt(1 - alpha / 2, df.residual(fit)) else qnorm(1 - alpha / 2)
  A <- b3^2 - crit^2 * V[wn, wn]; B <- 2 * (b1 * b3 - crit^2 * V["X", wn]); Cc <- b1^2 - crit^2 * V["X", "X"]
  disc <- B^2 - 4 * A * Cc
  if (disc < 0) return(c(NA, NA))
  sort(c((-B - sqrt(disc)) / (2 * A), (-B + sqrt(disc)) / (2 * A)))
}
compare <- function(fit, ss, V, level, use_t, alpha) {
  s <- ss$slopes; w <- s[[1]]; cnd <- cand(fit, w, V, level, use_t)
  got <- list(est = s[["Est."]], se = s[["S.E."]], lo = s[[4]], hi = s[[5]], stat = s[[6]], p = s[["p"]])
  diffs <- sapply(names(got), function(k) max(abs(got[[k]] - cnd[[k]])))
  jns <- attr(ss, "jns")
  jn <- if (length(jns)) max(abs(jns[[1]]$bounds - jn_cand(fit, V, alpha, use_t))) else NA
  c(as.list(diffs), list(jn = jn, stat_name = names(s)[6], ci_names = names(s)[4:5]))
}

fit <- lm(Y ~ X * W + C, data = d)
mw <- c(mean(W) - sd(W), mean(W), mean(W) + sd(W))
cases <- list(
  mpm = list(fit = fit, opt = list(modx.values = "mean-plus-minus", jnalpha = 0.05, ci.width = 0.95, robust = FALSE)),
  mpm90 = list(fit = fit, opt = list(modx.values = "mean-plus-minus", jnalpha = 0.1, ci.width = 0.9, robust = FALSE)),
  given = list(fit = fit, opt = list(modx.values = unname(quantile(W, c(0.25, 0.5, 0.75))), jnalpha = 0.05, ci.width = 0.95, robust = FALSE)),
  hc3 = list(fit = fit, opt = list(modx.values = "mean-plus-minus", jnalpha = 0.05, ci.width = 0.95, robust = "HC3")))
out$lm <- lapply(cases, function(cs) {
  o <- cs$opt
  ss <- sim_slopes(cs$fit, pred = "X", modx = "W", modx.values = o$modx.values, johnson_neyman = TRUE, jnalpha = o$jnalpha,
                   confint = TRUE, ci.width = o$ci.width, robust = o$robust)
  V <- if (identical(o$robust, "HC3")) vcovHC(cs$fit, type = "HC3") else vcov(cs$fit)
  list(got = grab(ss), diffs = compare(cs$fit, ss, V, o$ci.width, TRUE, o$jnalpha),
       mean_pm_sd = mw)
})
# logistic outcome
fitb <- glm(Yb ~ X * W + C, family = binomial, data = d)
ssb <- run(sim_slopes(fitb, pred = "X", modx = "W", modx.values = "mean-plus-minus", johnson_neyman = TRUE, jnalpha = 0.05,
                      confint = TRUE, ci.width = 0.95, robust = FALSE))
out$glm <- if (is.null(ssb$error)) list(got = grab(ssb$value), warnings = ssb$warnings,
  diffs_z = compare(fitb, ssb$value, vcov(fitb), 0.95, FALSE, 0.05), diffs_t = compare(fitb, ssb$value, vcov(fitb), 0.95, TRUE, 0.05)) else ssb
ssb3 <- run(sim_slopes(fitb, pred = "X", modx = "W", modx.values = "mean-plus-minus", johnson_neyman = TRUE, jnalpha = 0.05,
                       confint = TRUE, ci.width = 0.95, robust = "HC3"))
out$glm_hc3 <- if (is.null(ssb3$error)) list(got = grab(ssb3$value), warnings = ssb3$warnings,
  diffs_z = compare(fitb, ssb3$value, vcovHC(fitb, type = "HC3"), 0.95, FALSE, 0.05)) else ssb3
# binary moderator, johnson_neyman = FALSE as ReactiveStat calls it
fit2 <- lm(Y2 ~ X * Wb, data = d)
ss2 <- sim_slopes(fit2, pred = "X", modx = "Wb", modx.values = sort(unique(d$Wb)), johnson_neyman = FALSE, confint = TRUE,
                  ci.width = 0.95, robust = FALSE)
out$binary_w <- list(got = grab(ss2), diffs = compare(fit2, ss2, vcov(fit2), 0.95, TRUE, 0.05))


# added after the first runs: glm with HC3 against t for the JN bounds; the inside / outside flag and the cases with no
# real root (slope significant everywhere or nowhere), against the sign of the quadratic's leading coefficient
if (is.null(ssb3$error)) out$glm_hc3$diffs_t <- compare(fitb, ssb3$value, vcovHC(fitb, type = "HC3"), 0.95, TRUE, 0.05)
jn_only <- function(fit, alpha) {
  r <- run(sim_slopes(fit, pred = "X", modx = "W", modx.values = "mean-plus-minus", johnson_neyman = TRUE, jnalpha = alpha,
                      confint = TRUE, ci.width = 0.95, robust = FALSE))
  if (!is.null(r$error)) return(r)
  j <- attr(r$value, "jns")[[1]]
  b <- coef(fit); V <- vcov(fit); crit <- qt(1 - alpha / 2, df.residual(fit))
  list(bounds = j$bounds, inside = attr(j, "inside"), failed = attr(j, "failed"), all_sig = attr(j, "all_sig"),
       lead = unname(b[["X:W"]]^2 - crit^2 * V["X:W", "X:W"]), cand = jn_cand(fit, V, alpha, TRUE),
       warnings = r$warnings, messages = r$messages, printed = capture.output(print(r$value))[1:6])
}
Ysig <- 1 + 2 * X + 0.01 * X * W + rnorm(n, 0, 0.3)       # slope significant everywhere
Ynone <- 1 + 0.01 * X + 0.001 * X * W + rnorm(n, 0, 3)    # nowhere
Yin <- 1 + 0.3 * X * (W - 10) + rnorm(n, 0, 0.5)          # significant outside an inner interval
assign("d", transform(d, Ysig = Ysig, Ynone = Ynone, Yin = Yin), envir = globalenv())
out$jn_cases <- list(main = jn_only(fit, 0.05), all_sig = jn_only(lm(Ysig ~ X * W, data = d), 0.05),
  none = jn_only(lm(Ynone ~ X * W, data = d), 0.05), outside = jn_only(lm(Yin ~ X * W, data = d), 0.05))
cat(toJSON(out, digits = I(17), auto_unbox = TRUE, null = "null", na = "string", pretty = TRUE))
