# regression18-gee.R: geepack 1.3.13 geeglm on its examples and boundary cases, public functions only (1.8.0)
# Output: JSON on stdout, 17 significant digits
suppressMessages(library(geepack))
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
data(dietox); data(ohio); data(seizure); data(respiratory)
dietox$Cu <- factor(dietox$Cu)
geeValues <- function(fit, anova = TRUE) {
  s <- summary(fit)
  list(coefficients = coef(fit), vcov = tab(vcov(fit)), summary = tab(coef(s)), corr = run(tab(as.matrix(s$corr))),
       dispersion = run(tab(as.matrix(s$dispersion))), alpha = run(fit$geese$alpha), gamma = run(fit$geese$gamma),
       fitted = unname(fitted(fit))[1:10], residuals = unname(residuals(fit, type = "pearson"))[1:10],
       qic = run(QIC(fit)),
       anova = if (anova) run({ a <- anova(fit); list(rows = rownames(a), table = as.list(a)) }) else "skipped",
       iterations = run(fit$geese$model$iterations), clusz = run(fit$geese$clusz[1:5]))
}
cs <- c("independence", "exchangeable", "ar1", "unstructured")
for (c1 in cs) {
  out[[paste0("dietox_gaussian_", c1)]] <- run(geeValues(geeglm(Weight ~ Time + Cu, id = Pig, data = dietox,
                                                                corstr = c1)))
  out[[paste0("ohio_binomial_", c1)]] <- run(geeValues(geeglm(resp ~ age + smoke, id = id, data = ohio,
                                                              family = binomial, corstr = c1)))
}
for (c1 in cs[1:3]) {
  out[[paste0("dietox_Gamma_", c1)]] <- run(geeValues(geeglm(Weight ~ Time + Cu, id = Pig, data = dietox,
                                                             family = Gamma(link = "log"), corstr = c1)))
}
# seizure: wide to long, Poisson with an offset
sz <- reshape(seizure, varying = list(c("base", "y1", "y2", "y3", "y4")), v.names = "y", times = 0:4,
              direction = "long")
sz <- sz[order(sz$id, sz$time), ]
sz$t <- ifelse(sz$time == 0, 8, 2); sz$x <- ifelse(sz$time == 0, 0, 1)
for (c1 in cs) {
  out[[paste0("seizure_poisson_", c1)]] <- run(geeValues(geeglm(y ~ offset(log(t)) + x + trt + x:trt, id = id,
                                                                data = sz, family = poisson, corstr = c1)))
}
# standard errors: jackknife ("jack", "j1s", "fij"), fixed scale, waves, weights
for (st in c("jack", "j1s", "fij")) {
  out[[paste0("ohio_exch_", st)]] <- run(geeValues(geeglm(resp ~ age + smoke, id = id, data = ohio, family = binomial,
                                                          corstr = "exchangeable", std.err = st)))
}
out$dietox_scale_fix <- run(geeValues(geeglm(Weight ~ Time, id = Pig, data = dietox, corstr = "ar1",
                                              scale.fix = TRUE, scale.value = 4)))
out$respiratory_waves_ar1 <- run(geeValues(geeglm(outcome ~ treat + sex + age + baseline, id = interaction(center, id),
                                                   waves = visit, data = respiratory, family = binomial, corstr = "ar1")))
out$dietox_weights <- run(geeValues(geeglm(Weight ~ Time, id = Pig, data = dietox, corstr = "exchangeable",
                                           weights = rep(c(1, 2), length.out = nrow(dietox)))))
# user-defined and fixed working correlations (zcor)
out$dietox_userdefined <- run({
  zc <- genZcor(clusz = table(dietox$Pig), waves = dietox$Time, corstrv = 4)
  zc2 <- matrix(NA, nrow(zc), 3); zc2[, 1] <- apply(zc[, c(1, 4, 6, 9, 11, 13, 15, 17, 19, 21, 23)], 1, sum)
  zc2[, 2] <- apply(zc[, c(2, 5, 7, 10, 12, 14, 16, 18, 20, 22, 24)], 1, sum); zc2[, 3] <- 1 - zc2[, 1] - zc2[, 2]
  zc2[, 3] <- ifelse(zc2[, 3] < 0, 0, zc2[, 3])
  geeValues(geeglm(Weight ~ Time, id = Pig, data = dietox, corstr = "userdefined", zcor = zc2))
})
# anova(fit) of this fit did not finish in 40 s (geepack 1.3.13); left out
out$ohio_fixed <- run({
  cm <- matrix(c(1, 0.5, 0.3, 0.2, 0.5, 1, 0.5, 0.3, 0.3, 0.5, 1, 0.5, 0.2, 0.3, 0.5, 1), 4, 4)
  zc <- fixed2Zcor(cm, id = ohio$id, waves = ohio$age + 3)
  geeValues(geeglm(resp ~ age + smoke, id = id, data = ohio, family = binomial, corstr = "fixed", zcor = zc), anova = FALSE)
})
# anova between nested fits, predict with newdata
out$ohio_anova_nested <- run({
  f0 <- geeglm(resp ~ age, id = id, data = ohio, family = binomial, corstr = "exchangeable")
  f1 <- geeglm(resp ~ age + smoke + age:smoke, id = id, data = ohio, family = binomial, corstr = "exchangeable")
  a <- anova(f1, f0); list(rows = rownames(a), table = as.list(a))
})
out$ohio_predict <- run({
  f1 <- geeglm(resp ~ age + smoke, id = id, data = ohio, family = binomial, corstr = "ar1")
  nd <- data.frame(age = c(-2, 0, 1), smoke = c(0, 1, 1))
  list(link = unname(predict(f1, newdata = nd)), response = unname(predict(f1, newdata = nd, type = "response")))
})
# boundaries: unsorted id, one observation per cluster, singletons mixed in, NA rows, a constant response
out$unsorted_id <- run(geeValues(geeglm(Weight ~ Time, id = Pig, data = dietox[order(dietox$Time, -dietox$Pig), ],
                                        corstr = "exchangeable")))
out$one_per_cluster <- run(geeValues(geeglm(mpg ~ wt, id = seq_len(nrow(mtcars)), data = mtcars,
                                            corstr = "exchangeable")))
out$na_rows <- run({
  d <- dietox; d$Weight[c(3, 50)] <- NA
  geeValues(geeglm(Weight ~ Time, id = Pig, data = d, corstr = "ar1"))
})
out$binomial_separation <- run(geeValues(geeglm(y ~ x, id = g, family = binomial, corstr = "exchangeable",
                                                data = data.frame(x = 1:12, y = rep(0:1, each = 6), g = rep(1:4, 3)))))
cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", pretty = FALSE))
