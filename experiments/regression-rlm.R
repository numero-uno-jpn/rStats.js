# regression-rlm.R: MASS 7.3-66 rlm on R's examples and boundary cases, public functions only (1.7.0)
# Output: JSON on stdout, 17 significant digits
suppressMessages(library(MASS))
library(jsonlite)
# Helpers (the same in each script): run() records the value, the warnings, the messages and the error of one call
run <- function(expr) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(expr, error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  if (inherits(value, "caught")) return(list(error = value$message, warnings = warns, messages = msgs))
  list(value = value, warnings = warns, messages = msgs)
}
tab <- function(m) list(rows = rownames(m), cols = colnames(m), values = unname(m))
out <- list()

rlmValues <- function(fit) {
  s <- summary(fit)
  list(coefficients = coef(fit), s = fit$s, w = fit$w, wresid = fit$wresid, residuals = unname(residuals(fit)),
       fitted = unname(fitted(fit)), converged = fit$converged, conv = fit$conv, k2 = fit$k2,
       df.residual = fit$df.residual, summary = tab(coef(s)), sigma = s$sigma, stddev = s$stddev, df = s$df,
       cov.unscaled = tab(s$cov.unscaled), vcov = tab(vcov(fit)))
}
f <- stack.loss ~ Air.Flow + Water.Temp + Acid.Conc.
out$stackloss_huber <- run(rlmValues(rlm(f, data = stackloss)))
out$stackloss_huber_k1 <- run(rlmValues(rlm(f, data = stackloss, k = 1)))
out$stackloss_hampel <- run(rlmValues(rlm(f, data = stackloss, psi = psi.hampel, init = "lts")))
out$stackloss_hampel_ls <- run(rlmValues(rlm(f, data = stackloss, psi = psi.hampel)))
out$stackloss_bisquare <- run(rlmValues(rlm(f, data = stackloss, psi = psi.bisquare)))
out$stackloss_bisquare_c4 <- run(rlmValues(rlm(f, data = stackloss, psi = psi.bisquare, c = 4)))
for (sc in c("MAD", "Huber", "proposal 2")) {
  out[[paste0("stackloss_scale_", sc)]] <- run(rlmValues(rlm(f, data = stackloss, scale.est = sc)))
}
out$stackloss_init_numeric <- run(rlmValues(rlm(f, data = stackloss, init = c(-40, 0.7, 1.3, -0.15))))
for (seed in c(1, 2, 123)) {
  out[[paste0("stackloss_MM_seed", seed)]] <- run({ set.seed(seed); rlmValues(rlm(f, data = stackloss, method = "MM")) })
}
out$stackloss_MM_noseed_twice <- run({
  a <- coef(rlm(f, data = stackloss, method = "MM")); b <- coef(rlm(f, data = stackloss, method = "MM"))
  list(first = a, second = b)
})
out$phones_huber <- run(rlmValues(rlm(calls ~ year, data = phones, maxit = 50)))
out$phones_bisquare <- run(rlmValues(rlm(calls ~ year, data = phones, psi = psi.bisquare)))
out$phones_MM <- run({ set.seed(1); rlmValues(rlm(calls ~ year, data = phones, method = "MM")) })
out$phones_MM_lqs_S <- run({ set.seed(1); fit <- lqs(calls ~ year, data = phones, method = "S")
  list(coefficients = coef(fit), scale = fit$scale, crit = fit$crit) })
out$phones_maxit2 <- run(rlmValues(rlm(calls ~ year, data = phones, maxit = 2)))
out$phones_acc <- run(rlmValues(rlm(calls ~ year, data = phones, maxit = 50, acc = 1e-10)))
# weights
w <- c(rep(1, 10), rep(2, 11))
out$weights_inv <- run(rlmValues(rlm(f, data = stackloss, weights = w)))
out$weights_case <- run(rlmValues(rlm(f, data = stackloss, weights = w, wt.method = "case")))
# factor covariate, intercept only, matrix interface
out$factor <- run(rlmValues(rlm(mpg ~ wt + factor(cyl), data = mtcars)))
out$intercept_only <- run(rlmValues(rlm(mpg ~ 1, data = mtcars)))
out$matrix_interface <- run(rlmValues(rlm(cbind(1, stackloss$Air.Flow), stackloss$stack.loss)))
# boundaries and errors
out$exact_fit_some <- run(rlmValues(rlm(y ~ x, data = data.frame(x = 1:10, y = c(2 * (1:8), 50, 70)))))
out$exact_fit_all <- run(rlmValues(rlm(y ~ x, data = data.frame(x = 1:10, y = 2 * (1:10)))))
out$collinear <- run(rlmValues(rlm(mpg ~ wt + I(2 * wt), data = mtcars)))
out$na_rows <- run({ d <- stackloss; d$Air.Flow[3] <- NA; rlmValues(rlm(f, data = d)) })
out$half_outliers <- run({ x <- 1:20; y <- c(x[1:11], rep(100, 9)); rlmValues(rlm(y ~ x, psi = psi.bisquare)) })
out$scaled_y <- run(rlmValues(rlm(I(stack.loss * 1e100) ~ Air.Flow, data = stackloss)))
out$tiny_y <- run(rlmValues(rlm(I(stack.loss * 1e-100) ~ Air.Flow, data = stackloss)))
out$bad_method <- run(coef(rlm(f, data = stackloss, method = "S")))
out$bad_scale <- run(coef(rlm(f, data = stackloss, scale.est = "mad")))
out$MM_with_psi <- run(rlmValues(rlm(f, data = stackloss, method = "MM", psi = psi.huber)))
# the psi functions themselves (values, derivatives and weights), on a grid
u <- c(-10, -5, -3, -2, -1.5, -1, -0.5, 0, 0.3, 1, 1.345, 2, 4, 6, 8.5, 10)
out$psi_grid <- list(u = u,
  psiHuber = list(w = psi.huber(u), psi = psi.huber(u, deriv = 0), d = psi.huber(u, deriv = 1)),
  psiHampel = list(w = psi.hampel(u), psi = psi.hampel(u, deriv = 0), d = psi.hampel(u, deriv = 1)),
  psiBisquare = list(w = psi.bisquare(u), psi = psi.bisquare(u, deriv = 0), d = psi.bisquare(u, deriv = 1)))
out$huber_location <- run({ h <- huber(stackloss$stack.loss); h2 <- hubers(stackloss$stack.loss); list(location = h, locationScale = h2) })

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", keep_vec_names = TRUE, pretty = FALSE), "\n")
