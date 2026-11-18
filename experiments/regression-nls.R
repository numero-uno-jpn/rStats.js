# regression-nls.R: R 4.6.2 nls and the self-starting models on R's examples and boundary cases, public functions
# only (1.7.0). Output: JSON on stdout, 17 significant digits
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

nlsValues <- function(fit, newdata = NULL) {
  s <- summary(fit)
  v <- list(coefficients = coef(fit), summary = tab(coef(s)), sigma = s$sigma, df = s$df,
            correlation = tab(summary(fit, correlation = TRUE)$correlation), vcov = tab(vcov(fit)),
            deviance = deviance(fit), logLik = as.numeric(logLik(fit)), AIC = AIC(fit), BIC = BIC(fit),
            df.residual = df.residual(fit), nobs = nobs(fit), residuals = as.numeric(residuals(fit)),
            fitted = as.numeric(fitted(fit)), weights = weights(fit),
            convInfo = fit$convInfo, confintWald = tab(confint.default(fit)),
            confint = run(tab(confint(fit))), confint90 = run(tab(confint(fit, level = 0.9))))
  if (!is.null(newdata)) v$predict <- as.numeric(predict(fit, newdata = newdata))
  v
}
PurTrt <- Puromycin[Puromycin$state == "treated", ]
newConc <- data.frame(conc = c(0.01, 0.1, 0.5, 1.2))
out$puromycin_default <- run(nlsValues(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05)), newConc))
out$puromycin_plinear <- run(nlsValues(nls(rate ~ conc / (K + conc), data = PurTrt, start = list(K = 0.05), algorithm = "plinear"), newConc))
out$puromycin_port <- run(nlsValues(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05), algorithm = "port"), newConc))
out$puromycin_port_bound <- run(nlsValues(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.08),
                                              algorithm = "port", lower = c(0, 0.07), upper = c(250, 1)), newConc))
out$puromycin_weights <- run(nlsValues(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05),
                                           weights = 1 / conc), newConc))
out$puromycin_SSmicmen <- run(c(nlsValues(nls(rate ~ SSmicmen(conc, Vm, K), data = PurTrt), newConc),
                                list(initial = getInitial(rate ~ SSmicmen(conc, Vm, K), data = PurTrt))))
out$puromycin_anova <- run({
  f1 <- nls(rate ~ Vm * conc / (K + conc), data = Puromycin, start = list(Vm = 200, K = 0.05))
  f2 <- nls(rate ~ (Vm + delV * (state == "treated")) * conc / (K + conc), data = Puromycin,
            start = list(Vm = 160, delV = 40, K = 0.05))
  a <- anova(f1, f2); list(table = as.list(a), rows = rownames(a), heading = attr(a, "heading"))
})
# indexed parameters (one per group) as in ?nls
out$puromycin_indexed <- run(nlsValues(nls(rate ~ Vm[state] * conc / (K[state] + conc), data = Puromycin,
                                           start = list(Vm = c(200, 160), K = c(0.05, 0.05)))))
# the self-starting models, on the data sets of their help pages
DNase1 <- DNase[DNase$Run == 1, ]
Lob329 <- Loblolly[Loblolly$Seed == 329, ]
CO2Qn1 <- CO2[CO2$Plant == "Qn1", ]
Indo1 <- Indometh[Indometh$Subject == 1, ]
Theo1 <- Theoph[Theoph$Subject == 1, ]
Chick1 <- ChickWeight[ChickWeight$Chick == 1, ]
Chick6 <- ChickWeight[ChickWeight$Chick == 6 & ChickWeight$Time > 0, ]
ss <- list(
  mSSasymp = function() list(f = nls(height ~ SSasymp(age, Asym, R0, lrc), data = Lob329),
                            i = getInitial(height ~ SSasymp(age, Asym, R0, lrc), data = Lob329)),
  mSSasympOff = function() list(f = nls(uptake ~ SSasympOff(conc, Asym, lrc, c0), data = CO2Qn1),
                               i = getInitial(uptake ~ SSasympOff(conc, Asym, lrc, c0), data = CO2Qn1)),
  mSSasympOrig = function() list(f = nls(height ~ SSasympOrig(age, Asym, lrc), data = Lob329),
                                i = getInitial(height ~ SSasympOrig(age, Asym, lrc), data = Lob329)),
  mSSbiexp = function() list(f = nls(conc ~ SSbiexp(time, A1, lrc1, A2, lrc2), data = Indo1),
                            i = getInitial(conc ~ SSbiexp(time, A1, lrc1, A2, lrc2), data = Indo1)),
  mSSfol = function() list(f = nls(conc ~ SSfol(Dose, Time, lKe, lKa, lCl), data = Theo1),
                          i = getInitial(conc ~ SSfol(Dose, Time, lKe, lKa, lCl), data = Theo1)),
  mSSfpl = function() list(f = nls(weight ~ SSfpl(Time, A, B, xmid, scal), data = Chick1),
                          i = getInitial(weight ~ SSfpl(Time, A, B, xmid, scal), data = Chick1)),
  mSSgompertz = function() list(f = nls(density ~ SSgompertz(log(conc), Asym, b2, b3), data = DNase1),
                               i = getInitial(density ~ SSgompertz(log(conc), Asym, b2, b3), data = DNase1)),
  mSSlogis = function() list(f = nls(density ~ SSlogis(log(conc), Asym, xmid, scal), data = DNase1),
                            i = getInitial(density ~ SSlogis(log(conc), Asym, xmid, scal), data = DNase1)),
  mSSweibull = function() list(f = nls(weight ~ SSweibull(Time, Asym, Drop, lrc, pwr), data = Chick6),
                              i = getInitial(weight ~ SSweibull(Time, Asym, Drop, lrc, pwr), data = Chick6)))
for (nm in names(ss)) {
  out[[nm]] <- run({ r <- ss[[nm]](); c(nlsValues(r$f), list(initial = r$i)) })
}
# the model functions' values and gradients at given parameters (the "gradient" attribute)
grad <- function(v) list(value = as.numeric(v), gradient = tab(attr(v, "gradient")))
x <- c(0.5, 1, 2, 4, 8)
out$model_values <- list(x = x,
  mSSasymp = grad(SSasymp(x, 10, 1, -0.5)), mSSasympOff = grad(SSasympOff(x, 10, -0.5, 0.2)),
  mSSasympOrig = grad(SSasympOrig(x, 10, -0.5)), mSSbiexp = grad(SSbiexp(x, 3, 1, 0.6, -1.5)),
  mSSfol = grad(SSfol(4, x, -2.5, 0.5, -3)), mSSfpl = grad(SSfpl(x, 1, 10, 3, 1.5)),
  mSSgompertz = grad(SSgompertz(x, 10, 2, 0.6)), mSSlogis = grad(SSlogis(x, 10, 3, 1.5)),
  mSSmicmen = grad(SSmicmen(x, 200, 0.5)), mSSweibull = grad(SSweibull(x, 10, 9, -1, 1.5)))
# boundaries and errors
out$no_start <- run(coef(nls(rate ~ Vm * conc / (K + conc), data = PurTrt)))
out$singular_gradient <- run(coef(nls(rate ~ Vm * conc / (K + conc) + 0 * a, data = PurTrt, start = list(Vm = 200, K = 0.05, a = 1))))
out$step_factor <- run(coef(nls(y ~ a * exp(b * x), data = data.frame(x = 1:10, y = c(1, 3, 2, 5, 4, 7, 6, 9, 8, 10)),
                               start = list(a = 1, b = 5))))
out$maxiter <- run(coef(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05),
                            control = nls.control(maxiter = 2))))
out$maxiter_warnOnly <- run(nlsValues(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05),
                                          control = nls.control(maxiter = 2, warnOnly = TRUE))))
out$zero_residual <- run(coef(nls(y ~ a * exp(b * x), data = data.frame(x = 1:6, y = 2 * exp(0.3 * (1:6))), start = list(a = 1, b = 0.2))))
out$zero_residual_scaleOffset <- run(nlsValues(nls(y ~ a * exp(b * x), data = data.frame(x = 1:6, y = 2 * exp(0.3 * (1:6))),
                                                  start = list(a = 1, b = 0.2), control = nls.control(scaleOffset = 1))))
out$port_start_outside <- run(coef(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05),
                                    algorithm = "port", lower = c(0, 0.07))))
out$port_at_start_bound <- run(nlsValues(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 250, K = 0.05),
                                             algorithm = "port", upper = c(250, 1))))
out$na_rows <- run({ d <- PurTrt; d$rate[2] <- NA; nlsValues(nls(rate ~ Vm * conc / (K + conc), data = d, start = list(Vm = 200, K = 0.05))) })
out$scaled_y <- run(nlsValues(nls(I(rate * 1e100) ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 2e102, K = 0.05))))
out$bad_algorithm <- run(coef(nls(rate ~ Vm * conc / (K + conc), data = PurTrt, start = list(Vm = 200, K = 0.05), algorithm = "lm")))
out$too_few_rows <- run(coef(nls(y ~ a * exp(b * x), data = data.frame(x = 1:2, y = c(1, 3)), start = list(a = 1, b = 1))))

cat(toJSON(out, digits = NA, auto_unbox = TRUE, null = "null", na = "string", keep_vec_names = TRUE, pretty = FALSE), "\n")
