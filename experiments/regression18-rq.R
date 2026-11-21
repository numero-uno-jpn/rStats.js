# regression18-rq.R: quantreg 6.1 rq on R's examples and boundary cases, public functions only (1.8.0)
# Output: JSON on stdout, 17 significant digits
suppressMessages(library(quantreg))
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
data(engel)
rqValues <- function(fit) {
  list(coefficients = coef(fit), residuals = unname(residuals(fit)), rho = fit$rho, tau = fit$tau,
       logLik = as.numeric(logLik(fit)), AIC = AIC(fit))
}
sumTab <- function(s) tab(coef(s))
for (tau in c(0.1, 0.25, 0.5, 0.75, 0.9)) {
  for (m in c("br", "fn")) {
    out[[sprintf("engel_%s_%g", m, tau)]] <- run({
      fit <- rq(foodexp ~ income, tau = tau, data = engel, method = m)
      v <- rqValues(fit)
      for (st in c("rank", "iid", "nid", "ker")) v[[paste0("summary_", st)]] <- run(sumTab(summary(fit, se = st)))
      v$summary_rank_iid <- run(sumTab(summary(fit, se = "rank", iid = TRUE)))
      v$summary_nid_bofinger <- run(sumTab(summary(fit, se = "nid", hs = FALSE)))
      v$summary_ker_cov <- run(summary(fit, se = "ker", covariance = TRUE)$cov)
      v
    })
  }
}
# several covariates, the default se ("rank" for n < 1001), weights, a factor
out$stackloss_median <- run({
  fit <- rq(stack.loss ~ ., data = stackloss)
  c(rqValues(fit), list(summary = run(sumTab(summary(fit))), summary_nid = run(sumTab(summary(fit, se = "nid"))),
                        summary_alpha = run(sumTab(summary(fit, alpha = 0.1)))))
})
out$stackloss_weights <- run({
  w <- rep(c(1, 2, 3), length.out = nrow(stackloss))
  fit <- rq(stack.loss ~ ., data = stackloss, weights = w, tau = 0.3)
  c(rqValues(fit), list(summary_nid = run(sumTab(summary(fit, se = "nid"))), summary_rank = run(sumTab(summary(fit)))))
})
out$mtcars_factor <- run({
  mt <- mtcars; mt$cyl <- factor(mt$cyl)
  fit <- rq(mpg ~ wt + cyl, data = mt, tau = 0.6)
  c(rqValues(fit), list(summary_iid = run(sumTab(summary(fit, se = "iid")))))
})
# several taus at once (an rqs fit), anova across taus and between nested fits
out$engel_taus <- run({
  fit <- rq(foodexp ~ income, tau = c(0.25, 0.5, 0.75), data = engel)
  list(coefficients = tab(coef(fit)), summaries = lapply(summary(fit, se = "nid"), sumTab))
})
out$engel_anova_taus <- run({
  fits <- rq(foodexp ~ income, tau = c(0.25, 0.5, 0.75), data = engel)
  a <- anova(fits); aj <- anova(fits, joint = FALSE)
  list(joint = as.list(a$table), separate = as.list(aj$table))
})
out$stackloss_anova_nested <- run({
  f0 <- rq(stack.loss ~ Air.Flow, data = stackloss); f1 <- rq(stack.loss ~ ., data = stackloss)
  list(wald = as.list(anova(f1, f0)$table), rank = run(as.list(anova(f1, f0, test = "rank")$table)))
})
# predict: points, confidence intervals
out$engel_predict <- run({
  fit <- rq(foodexp ~ income, tau = 0.5, data = engel)
  nd <- data.frame(income = c(500, 1000, 2500))
  list(fit = predict(fit, newdata = nd),
       ciNone = run(tab(predict(fit, newdata = nd, interval = "confidence", se = "nid"))),
       ciPercentile = run(tab(predict(fit, newdata = nd, interval = "confidence", type = "percentile"))),
       ciDirect = run(tab(predict(fit, newdata = nd, interval = "confidence", type = "direct"))))
})
# a nonunique solution (an even number of points at the median), ties, an exact fit, a degenerate column
out$nonunique <- run(rqValues(rq(y ~ x, data = data.frame(x = 1:4, y = c(1, 3, 2, 4)))))
out$nonunique_br_fn <- run(list(br = coef(rq(y ~ x, data = data.frame(x = 1:6, y = c(2, 1, 4, 3, 6, 5)))),
                                fn = coef(rq(y ~ x, data = data.frame(x = 1:6, y = c(2, 1, 4, 3, 6, 5)), method = "fn"))))
out$exact_fit <- run({
  fit <- rq(y ~ x, data = data.frame(x = 1:10, y = 2 + 3 * (1:10)))
  c(rqValues(fit), list(summary = run(sumTab(summary(fit))), summary_nid = run(sumTab(summary(fit, se = "nid")))))
})
out$collinear <- run(rqValues(rq(y ~ x1 + x2, data = data.frame(x1 = 1:8, x2 = 2 * (1:8), y = c(3, 1, 4, 1, 5, 9, 2, 6)))))
out$tau_bad <- run(class(rq(foodexp ~ income, tau = 1.5, data = engel)))
out$tau_process <- run({ fit <- rq(foodexp ~ income, tau = -1, data = engel[1:30, ]); list(sol = tab(fit$sol)) })
out$na_rows <- run(rqValues(rq(y ~ x, data = data.frame(x = c(1:9, NA), y = c(3, 1, 4, 1, 5, NA, 2, 6, 5, 3)))))
# bootstrap standard errors: R's random numbers (set.seed), the methods and R
for (bs in c("xy", "pwy", "mcmb", "wxy")) {
  out[[paste0("engel_boot_", bs)]] <- run({
    set.seed(1)
    fit <- rq(foodexp ~ income, tau = 0.5, data = engel)
    s <- summary(fit, se = "boot", bsmethod = bs, R = 200)
    list(summary = sumTab(s), B = run(s$B))
  })
}
out$stackloss_boot_xy_R50 <- run({ set.seed(42); sumTab(summary(rq(stack.loss ~ ., data = stackloss), se = "boot", R = 50)) })
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
