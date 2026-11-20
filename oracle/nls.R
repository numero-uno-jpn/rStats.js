# Nonlinear least squares oracle (R 4.6.2 stats: nls, the self-starting models, profile confint, anova), written by
# the coordinator from public functions only (no fit internals: the fit's m element is never touched).
# Each case's arguments are written once and used both for the record and for the call.
# Every fit is recorded twice: with R's default control and refitted from R's own estimates with a tight control
# (fitTight), since R's default stopping rule (tol = 1e-5 on the relative offset) stops before the optimum.
# Numbers are JSON numbers with 17 significant digits; NA, NaN and infinities are the strings "NA", "NaN", "Inf".
# Output: /out/nls.json

suppressPackageStartupMessages(library(jsonlite))

capture <- function(f) {
  warns <- character(0); msgs <- character(0)
  value <- withCallingHandlers(
    tryCatch(f(), error = function(e) structure(list(message = conditionMessage(e)), class = "caught")),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, sub("\n$", "", conditionMessage(m))); invokeRestart("muffleMessage") })
  out <- list(warnings = I(unique(warns)), messages = I(unique(msgs)))
  if (inherits(value, "caught")) c(list(error = value$message), out) else c(list(value = value), out)
}
named <- function(x) { y <- as.list(unname(as.numeric(x))); names(y) <- names(x); y }
tab <- function(m) {
  m <- as.matrix(m)
  list(rows = if (is.null(rownames(m))) NULL else I(rownames(m)), cols = if (is.null(colnames(m))) NULL else I(colnames(m)),
       values = lapply(seq_len(nrow(m)), function(i) I(unname(as.numeric(m[i, ])))))
}
vec <- function(x) I(unname(as.numeric(x)))

public <- function(fit) {
  s <- summary(fit)
  ci <- fit$convInfo
  list(coefficients = named(coef(fit)), summary = tab(coef(s)), sigma = s$sigma, df = I(s$df),
       vcov = tab(vcov(fit)), correlation = tab(summary(fit, correlation = TRUE)$correlation),
       deviance = deviance(fit), logLik = as.numeric(logLik(fit)), AIC = AIC(fit), BIC = BIC(fit),
       dfResidual = df.residual(fit), nobs = nobs(fit), residuals = vec(residuals(fit)), fitted = vec(fitted(fit)),
       convInfo = list(isConv = ci$isConv, finIter = ci$finIter, finTol = ci$finTol, stopCode = ci$stopCode,
                       stopMessage = ci$stopMessage))
}

# Data: R's example data sets (as on the help pages), with the columns the formulas use
PurTrt <- Puromycin[Puromycin$state == "treated", c("conc", "rate")]
Pur <- data.frame(conc = Puromycin$conc, rate = Puromycin$rate, treated = as.numeric(Puromycin$state == "treated"))
PurW <- transform(PurTrt, w = 1 / conc)
PurNA <- PurTrt; PurNA$rate[2] <- NA
DNase1 <- DNase[DNase$Run == 1, c("conc", "density")]
Lob329 <- Loblolly[Loblolly$Seed == 329, c("age", "height")]
CO2Qn1 <- data.frame(conc = CO2$conc[CO2$Plant == "Qn1"], uptake = CO2$uptake[CO2$Plant == "Qn1"])
Indo1 <- Indometh[Indometh$Subject == 1, c("time", "conc")]
Theo1 <- data.frame(Dose = Theoph$Dose[Theoph$Subject == 1], Time = Theoph$Time[Theoph$Subject == 1],
                    conc = Theoph$conc[Theoph$Subject == 1])
Chick1 <- ChickWeight[ChickWeight$Chick == 1, c("Time", "weight")]
Chick6 <- ChickWeight[ChickWeight$Chick == 6 & ChickWeight$Time > 0, c("Time", "weight")]
Exact <- data.frame(x = 1:6, y = 2 * exp(0.3 * (1:6)))
Step <- data.frame(x = 1:10, y = c(1, 3, 2, 5, 4, 7, 6, 9, 8, 10))
Two <- data.frame(x = 1:2, y = c(1, 3))
datasets_ <- list(PurTrt = PurTrt, Pur = Pur, PurW = PurW, PurNA = PurNA, DNase1 = DNase1, Lob329 = Lob329,
                  CO2Qn1 = CO2Qn1, Indo1 = Indo1, Theo1 = Theo1, Chick1 = Chick1, Chick6 = Chick6, BOD = BOD,
                  Exact = Exact, Step = Step, Two = Two)
newConc <- data.frame(conc = c(0.01, 0.1, 0.5, 1.2))

# A case: id, data (a name above), formula (a string), and the other nls arguments as given; optional newdata,
# confint (profile and Wald at 0.95 and 0.90), initial (getInitial, for self-starting formulas)
case <- function(id, data, formula, ..., newdata = NULL, confint = FALSE, initial = FALSE) {
  list(id = id, data = data, formula = formula, args = list(...), newdata = newdata, confint = confint,
       initial = initial)
}
mm <- "rate ~ Vm * conc / (K + conc)"
st <- list(Vm = 200, K = 0.05)
cases <- list(
  case("puromycin-default", "PurTrt", mm, start = st, newdata = newConc, confint = TRUE),
  case("puromycin-plinear", "PurTrt", "rate ~ conc / (K + conc)", start = list(K = 0.05), algorithm = "plinear",
       newdata = newConc, confint = TRUE),
  case("puromycin-port", "PurTrt", mm, start = st, algorithm = "port", newdata = newConc, confint = TRUE),
  case("puromycin-port-lower-active", "PurTrt", mm, start = list(Vm = 200, K = 0.08), algorithm = "port",
       lower = c(0, 0.07), upper = c(250, 1)),
  case("puromycin-port-upper-at-start", "PurTrt", mm, start = list(Vm = 250, K = 0.05), algorithm = "port",
       upper = c(250, 1)),
  case("puromycin-weights", "PurW", mm, start = st, weights = "w", newdata = newConc, confint = TRUE),
  case("puromycin-na-row", "PurNA", mm, start = st),
  case("puromycin-SSmicmen", "PurTrt", "rate ~ SSmicmen(conc, Vm, K)", newdata = newConc, confint = TRUE,
       initial = TRUE),
  case("dnase-SSlogis", "DNase1", "density ~ SSlogis(log(conc), Asym, xmid, scal)",
       newdata = data.frame(conc = c(0.1, 1, 10)), confint = TRUE, initial = TRUE),
  case("dnase-plinear-logistic", "DNase1", "density ~ 1 / (1 + exp((xmid - log(conc)) / scal))",
       start = list(xmid = 0, scal = 1), algorithm = "plinear", confint = TRUE),
  case("dnase-SSgompertz", "DNase1", "density ~ SSgompertz(log(conc), Asym, b2, b3)", initial = TRUE),
  case("loblolly-SSasymp", "Lob329", "height ~ SSasymp(age, Asym, R0, lrc)", confint = TRUE, initial = TRUE),
  case("loblolly-SSasympOrig", "Lob329", "height ~ SSasympOrig(age, Asym, lrc)", initial = TRUE),
  case("co2-SSasympOff", "CO2Qn1", "uptake ~ SSasympOff(conc, Asym, lrc, c0)", initial = TRUE),
  case("indometh-SSbiexp", "Indo1", "conc ~ SSbiexp(time, A1, lrc1, A2, lrc2)", initial = TRUE),
  case("theoph-SSfol", "Theo1", "conc ~ SSfol(Dose, Time, lKe, lKa, lCl)", initial = TRUE),
  case("chick-SSfpl", "Chick1", "weight ~ SSfpl(Time, A, B, xmid, scal)", initial = TRUE),
  case("chick-SSweibull", "Chick6", "weight ~ SSweibull(Time, Asym, Drop, lrc, pwr)", initial = TRUE),
  case("bod-exp", "BOD", "demand ~ A * (1 - exp(-exp(lrc) * Time))", start = list(A = 20, lrc = log(0.35)),
       confint = TRUE),
  case("exact-scaleOffset", "Exact", "y ~ a * exp(b * x)", start = list(a = 1, b = 0.2),
       control = list(scaleOffset = 1)),
  case("maxiter-warnOnly", "PurTrt", mm, start = st, control = list(maxiter = 2, warnOnly = TRUE)),
  # errors
  case("error-no-start", "PurTrt", mm),
  case("error-singular-start", "PurTrt", "rate ~ Vm * conc / (K + conc) + 0 * a", start = list(Vm = 200, K = 0.05, a = 1)),
  case("error-singular-gradient", "Step", "y ~ a * exp(b * x)", start = list(a = 1, b = 5)),
  case("error-maxiter", "PurTrt", mm, start = st, control = list(maxiter = 2)),
  case("error-exact-fit", "Exact", "y ~ a * exp(b * x)", start = list(a = 1, b = 0.2)),
  case("error-algorithm", "PurTrt", mm, start = st, algorithm = "lm"),
  case("error-port-start-outside", "PurTrt", mm, start = st, algorithm = "port", lower = c(0, 0.07)),
  case("error-too-few-rows", "Two", "y ~ a * exp(b * x)", start = list(a = 1, b = 1))
)

call_nls <- function(cs, d, extra = list()) {
  a <- cs$args
  if (!is.null(a$control)) a$control <- do.call(nls.control, a$control)
  if (!is.null(a$weights)) a$weights <- d[[a$weights]]
  a <- c(list(formula = as.formula(cs$formula), data = d), a)
  for (k in names(extra)) a[[k]] <- extra[[k]]
  do.call(nls, a)
}
tight_control <- function(cs) {
  ctl <- list(maxiter = 1000, tol = 1e-10, minFactor = 1e-12, warnOnly = TRUE)
  if (!is.null(cs$args$control$scaleOffset)) ctl$scaleOffset <- cs$args$control$scaleOffset
  do.call(nls.control, ctl)
}

record_case <- function(cs) {
  d <- datasets_[[cs$data]]
  rec <- list(id = cs$id, formula = cs$formula,
              data = lapply(d, function(col) if (is.numeric(col)) vec(col) else I(as.character(col))),
              args = cs$args)
  r <- capture(function() call_nls(cs, d))
  if (!is.null(r$error)) { rec$fit <- r; return(rec) }
  fit <- r$value
  rec$fit <- list(value = public(fit), warnings = r$warnings, messages = r$messages)
  # tight refit from R's own estimates (port keeps its bounds; plinear needs only the nonlinear start)
  est <- coef(fit)
  if (identical(cs$args$algorithm, "plinear")) est <- est[names(est) != ".lin" & !grepl("^\\.lin", names(est))]
  t <- capture(function() call_nls(cs, d, list(start = as.list(est), control = tight_control(cs))))
  rec$fitTight <- if (is.null(t$error)) list(value = public(t$value), warnings = t$warnings) else t
  if (!is.null(cs$newdata)) {
    rec$newdata <- lapply(cs$newdata, vec)
    rec$predict <- capture(function() vec(predict(fit, newdata = cs$newdata)))
  }
  if (cs$confint) {
    rec$confint <- list(
      profile95 = capture(function() tab(confint(fit))),
      profile90 = capture(function() tab(confint(fit, level = 0.9))),
      wald95 = capture(function() tab(confint.default(fit))),
      wald90 = capture(function() tab(confint.default(fit, level = 0.9))))
  }
  if (cs$initial) rec$initial <- capture(function() named(getInitial(as.formula(cs$formula), data = d)))
  rec
}
rows <- lapply(cases, record_case)

# anova of nested fits (the F test), on Puromycin as on ?nls
anova_rec <- capture(function() {
  f1 <- nls(rate ~ Vm * conc / (K + conc), data = Pur, start = list(Vm = 200, K = 0.05))
  f2 <- nls(rate ~ (Vm + delV * treated) * conc / (K + conc), data = Pur, start = list(Vm = 160, delV = 40, K = 0.05))
  a <- anova(f1, f2)
  list(table = lapply(as.list(a), function(col) if (is.numeric(col)) vec(col) else I(as.character(col))),
       rows = I(rownames(a)), heading = I(attr(a, "heading")))
})
anova <- list(id = "puromycin-anova",
              data = lapply(Pur, vec),
              models = list(list(formula = "rate ~ Vm * conc / (K + conc)", start = list(Vm = 200, K = 0.05)),
                            list(formula = "rate ~ (Vm + delV * treated) * conc / (K + conc)",
                                 start = list(Vm = 160, delV = 40, K = 0.05))),
              result = anova_rec)

# the self-starting models' values and gradients at given parameters (their documented "gradient" attribute)
g <- function(v) { gr <- attr(v, "gradient"); list(value = vec(v), gradient = if (is.null(gr)) NULL else tab(gr)) }
x <- c(0.5, 1, 2, 4, 8)
# The parameters are passed as variables: the models attach their gradient only then
ssv <- function(f, args) { e <- list2env(args); val <- f(e); list(args = args, result = g(val)) }
models <- list(
  x = vec(x),
  SSasymp = ssv(function(e) with(e, SSasymp(x, Asym, R0, lrc)), list(Asym = 10, R0 = 1, lrc = -0.5)),
  SSasympOff = ssv(function(e) with(e, SSasympOff(x, Asym, lrc, c0)), list(Asym = 10, lrc = -0.5, c0 = 0.2)),
  SSasympOrig = ssv(function(e) with(e, SSasympOrig(x, Asym, lrc)), list(Asym = 10, lrc = -0.5)),
  SSbiexp = ssv(function(e) with(e, SSbiexp(x, A1, lrc1, A2, lrc2)), list(A1 = 3, lrc1 = 1, A2 = 0.6, lrc2 = -1.5)),
  SSfol = ssv(function(e) with(e, SSfol(Dose, x, lKe, lKa, lCl)), list(Dose = 4, lKe = -2.5, lKa = 0.5, lCl = -3)),
  SSfpl = ssv(function(e) with(e, SSfpl(x, A, B, xmid, scal)), list(A = 1, B = 10, xmid = 3, scal = 1.5)),
  SSgompertz = ssv(function(e) with(e, SSgompertz(x, Asym, b2, b3)), list(Asym = 10, b2 = 2, b3 = 0.6)),
  SSlogis = ssv(function(e) with(e, SSlogis(x, Asym, xmid, scal)), list(Asym = 10, xmid = 3, scal = 1.5)),
  SSmicmen = ssv(function(e) with(e, SSmicmen(x, Vm, K)), list(Vm = 200, K = 0.5)),
  SSweibull = ssv(function(e) with(e, SSweibull(x, Asym, Drop, lrc, pwr)), list(Asym = 10, Drop = 9, lrc = -1, pwr = 1.5)))

tj <- function(v) toJSON(v, auto_unbox = TRUE, digits = NA, null = "null", na = "string")
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
lines <- c("{", sprintf('  "function": %s,', tj("nls")), sprintf('  "r_version": %s,', tj(R.version.string)),
           sprintf('  "generated": %s,', tj(stamp)), '  "cases": [',
           paste0("    ", vapply(rows, tj, character(1)), c(rep(",", length(rows) - 1L), "")), "  ],",
           sprintf('  "anova": %s,', tj(anova)), sprintf('  "models": %s', tj(models)), "}")
writeLines(lines, file.path("/out", "nls.json"))
cat(sprintf("nls: %d cases, anova, %d self-starting models -> /out/nls.json\n", length(rows), length(models) - 1L))
