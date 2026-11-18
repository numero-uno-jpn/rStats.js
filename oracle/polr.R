# Ordinal regression oracle for MASS::polr (public API only).
# The case table is the single source for both the recorded arguments and the calls.
# Output: /out/polr.json (R 4.6.2 / MASS 7.3-66).

suppressPackageStartupMessages(library(MASS))
suppressPackageStartupMessages(library(jsonlite))

num_json <- function(x) {
  vapply(x, function(z) {
    if (is.na(z) && !is.nan(z)) return("NA")
    if (is.nan(z)) return("NaN")
    if (is.infinite(z)) return(if (z > 0) "Inf" else "-Inf")
    sprintf("%.17g", z)
  }, character(1), USE.NAMES = FALSE)
}

json_value <- function(x) {
  if (is.null(x)) return(NULL)
  if (inherits(x, "formula")) return(paste(deparse(x, width.cutoff = 500L), collapse = ""))
  if (is.language(x)) return(paste(deparse(x, width.cutoff = 500L), collapse = ""))
  if (is.factor(x)) {
    return(list(values = I(as.list(as.character(x))), levels = I(as.list(levels(x))),
                ordered = is.ordered(x)))
  }
  if (is.data.frame(x)) {
    return(list(rowNames = I(as.list(rownames(x))), columns = lapply(x, json_value)))
  }
  if (is.matrix(x)) {
    return(list(rows = if (is.null(rownames(x))) NULL else I(as.list(rownames(x))),
                cols = if (is.null(colnames(x))) NULL else I(as.list(colnames(x))),
                values = lapply(seq_len(nrow(x)), function(i) I(as.list(num_json(x[i, ]))))))
  }
  if (is.numeric(x)) {
    v <- num_json(x)
    if (length(v) == 1L) return(unname(v))
    if (!is.null(names(x))) {
      y <- as.list(v); names(y) <- names(x); return(y)
    }
    return(I(as.list(v)))
  }
  if (is.logical(x) || is.character(x)) {
    if (length(x) == 1L) return(unname(x))
    if (!is.null(names(x))) {
      y <- as.list(x); names(y) <- names(x); return(y)
    }
    return(I(as.list(x)))
  }
  if (is.list(x)) {
    y <- lapply(x, json_value)
    if (!is.null(names(x))) names(y) <- names(x)
    return(y)
  }
  as.character(x)
}

tab <- function(x) {
  list(rows = if (is.null(rownames(x))) NULL else I(as.list(rownames(x))),
       cols = if (is.null(colnames(x))) NULL else I(as.list(colnames(x))),
       values = lapply(seq_len(nrow(as.matrix(x))), function(i) I(as.list(num_json(as.matrix(x)[i, ])))))
}

capture_raw <- function(f) {
  warnings <- character(0)
  messages <- character(0)
  value <- tryCatch(withCallingHandlers(f(),
    warning = function(cnd) {
      warnings <<- c(warnings, conditionMessage(cnd))
      invokeRestart("muffleWarning")
    },
    message = function(cnd) {
      messages <<- c(messages, sub("\\n$", "", conditionMessage(cnd)))
      invokeRestart("muffleMessage")
    }),
    error = function(cnd) structure(list(message = conditionMessage(cnd)), class = "oracle_error"))
  if (inherits(value, "oracle_error")) {
    return(list(error = value$message, warnings = I(as.list(unique(warnings))),
                messages = I(as.list(unique(messages)))))
  }
  list(value = value, warnings = I(as.list(unique(warnings))),
       messages = I(as.list(unique(messages))))
}

capture <- function(f) {
  result <- capture_raw(f)
  if (!is.null(result$error)) return(result)
  list(value = json_value(result$value), warnings = result$warnings, messages = result$messages)
}

fit_public_record <- function(fit) {
  s <- summary(fit)
  list(
    coefficients = json_value(coef(fit)),
    zeta = json_value(fit$zeta),
    deviance = json_value(deviance(fit)),
    edf = json_value(fit$edf),
    n = json_value(fit$n),
    nobs = json_value(fit$nobs),
    niter = json_value(fit$niter),
    convergence = json_value(fit$convergence),
    logLik = json_value(as.numeric(logLik(fit))),
    AIC = json_value(AIC(fit)),
    BIC = json_value(BIC(fit)),
    summary = tab(coef(s)),
    vcov = tab(vcov(fit)),
    fitted = tab(fitted(fit)),
    lp = json_value(fit$lp)
  )
}

fit_record <- function(args) json_value(args)

# Keep the model data limited to columns used by each formula; all data are serialized
# alongside the exact arguments so the fixture is self-contained.
housing_data <- MASS::housing
mtcars_data <- datasets::mtcars
mtcars_data$gearO <- ordered(mtcars_data$gear)
mtcars_data$off <- 0.1 * mtcars_data$mpg

housing_newdata <- expand.grid(
  Infl = levels(housing_data$Infl),
  Type = levels(housing_data$Type),
  Cont = levels(housing_data$Cont)
)[c(1, 5, 9, 24), ]

# Each fit specification is passed unchanged to MASS::polr after resolving only a
# declared startFrom dependency. Each call's args are both recorded and forwarded.
cases <- list(
  list(id = "housing-logistic",
       fits = list(main = list(args = list(
         formula = Sat ~ Infl + Type + Cont, data = housing_data, weights = quote(Freq),
         method = "logistic", Hess = TRUE))),
       calls = list(
         list(operation = "summary", args = list()),
         list(operation = "vcov", args = list()),
         list(operation = "predict", args = list(newdata = housing_newdata, type = "class")),
         list(operation = "predict", args = list(newdata = housing_newdata, type = "probs")),
         list(operation = "profile-ci", args = list(parm = "InflMedium", level = 0.90)),
         list(operation = "profile-ci", args = list(parm = "InflMedium", level = 0.99)),
         list(operation = "wald-ci", args = list(parm = "InflMedium", level = 0.90)),
         list(operation = "wald-ci", args = list(parm = "InflMedium", level = 0.99)),
         list(operation = "predict-unknown-level",
              args = list(newdata = data.frame(Infl = "Huge", Type = "Tower", Cont = "Low"),
                          type = "probs")))),
  list(id = "housing-probit",
       fits = list(main = list(args = list(
         formula = Sat ~ Infl + Type + Cont, data = housing_data, weights = quote(Freq),
         method = "probit", Hess = TRUE))),
       calls = list()),
  list(id = "housing-cloglog",
       fits = list(main = list(args = list(
         formula = Sat ~ Infl + Type + Cont, data = housing_data, weights = quote(Freq),
         method = "cloglog", Hess = TRUE))),
       calls = list()),
  list(id = "housing-loglog",
       fits = list(main = list(args = list(
         formula = Sat ~ Infl + Type + Cont, data = housing_data, weights = quote(Freq),
         method = "loglog", Hess = TRUE))),
       calls = list()),
  list(id = "housing-cauchit-start",
       fits = list(
         logistic_start = list(args = list(
           formula = Sat ~ Infl + Type + Cont, data = housing_data, weights = quote(Freq),
           method = "logistic", Hess = TRUE)),
         main = list(startFrom = "logistic_start", args = list(
           formula = Sat ~ Infl + Type + Cont, data = housing_data, weights = quote(Freq),
           method = "cauchit", Hess = TRUE))),
       calls = list()),
  list(id = "mtcars-cauchit",
       fits = list(main = list(args = list(
         formula = gearO ~ mpg + wt, data = mtcars_data, method = "cauchit", Hess = TRUE))),
       calls = list(
         list(operation = "predict", args = list(
           newdata = data.frame(mpg = c(15, 25), wt = c(3.5, 2)), type = "probs")))),
  list(id = "mtcars-weights",
       fits = list(main = list(args = list(
         formula = gearO ~ mpg + wt, data = mtcars_data,
         weights = rep(c(0.5, 1.5), 16), Hess = TRUE))),
       calls = list()),
  list(id = "mtcars-offset",
       fits = list(main = list(args = list(
         formula = gearO ~ wt + offset(off), data = mtcars_data, Hess = TRUE))),
       calls = list(
         list(operation = "predict", args = list(
           newdata = data.frame(wt = c(2, 3), off = c(2, 3)), type = "probs")))),
  list(id = "mtcars-intercept-only",
       fits = list(main = list(args = list(
         formula = gearO ~ 1, data = mtcars_data, Hess = TRUE))),
       calls = list(
         list(operation = "profile-ci", args = list(level = 0.90)),
         list(operation = "wald-ci", args = list(level = 0.90)))),
  list(id = "housing-nested-anova",
       fits = list(
         infl = list(args = list(formula = Sat ~ Infl, data = housing_data,
                                 weights = quote(Freq), Hess = TRUE)),
         full = list(args = list(formula = Sat ~ Infl + Type + Cont, data = housing_data,
                                 weights = quote(Freq), Hess = TRUE)),
         interaction = list(args = list(formula = Sat ~ Infl * Type + Cont, data = housing_data,
                                        weights = quote(Freq), Hess = TRUE))),
       calls = list(
         list(operation = "anova", args = list(models = c("infl", "full", "interaction"))))),
  list(id = "error-two-level-response",
       fits = list(main = list(args = list(
         formula = factor(am) ~ mpg, data = mtcars_data, Hess = TRUE))),
       calls = list()),
  list(id = "error-numeric-response",
       fits = list(main = list(args = list(
         formula = gear ~ mpg, data = mtcars_data, Hess = TRUE))),
       calls = list())
)

run_call <- function(call_spec, fit, all_fits) {
  op <- call_spec$operation
  a <- call_spec$args
  if (op == "summary") return(capture(function() tab(coef(summary(fit)))))
  if (op == "vcov") return(capture(function() tab(vcov(fit))))
  if (op == "predict") {
    return(capture(function() {
      result <- do.call(stats::predict, c(list(object = fit), a))
      if (is.factor(result)) as.character(result) else tab(result)
    }))
  }
  if (op == "predict-unknown-level") {
    return(capture(function() {
      do.call(stats::predict, c(list(object = fit), a))
    }))
  }
  if (op == "profile-ci") {
    return(capture(function() tab(do.call(stats::confint, c(list(object = fit), a)))))
  }
  if (op == "wald-ci") {
    return(capture(function() tab(do.call(stats::confint.default, c(list(object = fit), a)))))
  }
  if (op == "anova") {
    selected <- all_fits[a$models]
    return(capture(function() {
      result <- do.call(stats::anova, selected)
      list(table = as.list(result), rows = I(as.list(rownames(result))),
           heading = attr(result, "heading"))
    }))
  }
  stop("unknown oracle operation")
}

rows <- lapply(cases, function(case) {
  fits <- list()
  fit_rows <- lapply(names(case$fits), function(id) {
    spec <- case$fits[[id]]
    args <- spec$args
    if (!is.null(spec$startFrom)) {
      source_fit <- fits[[spec$startFrom]]
      if (is.null(source_fit)) stop("startFrom must refer to an earlier successful fit")
      args$start <- c(coef(source_fit), source_fit$zeta)
    }
    result <- capture_raw(function() do.call(MASS::polr, args))
    if (is.null(result$error)) fits[[id]] <<- result$value
    record <- list(id = id, fit = fit_record(args),
                   fitResult = list(warnings = result$warnings, messages = result$messages))
    if (!is.null(result$error)) record$fitResult$error <- result$error
    if (is.null(result$error)) {
      record$fitPublic <- fit_public_record(result$value)
    } else {
      record$fitResult <- result
    }
    record
  })
  names(fit_rows) <- names(case$fits)
  calls <- lapply(case$calls, function(call_spec) {
    fit_id <- if (!is.null(call_spec$fit)) call_spec$fit else "main"
    if (call_spec$operation == "anova") {
      result <- run_call(call_spec, NULL, fits)
    } else if (is.null(fits[[fit_id]])) {
      result <- list(error = "referenced fit did not succeed", warnings = I(list()), messages = I(list()))
    } else {
      result <- run_call(call_spec, fits[[fit_id]], fits)
    }
    list(operation = call_spec$operation, fit = fit_id,
         args = json_value(call_spec$args), result = result)
  })
  list(id = case$id, fits = fit_rows, calls = calls)
})

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
to_json <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA,
                                        null = "null", na = "string")
lines <- c(
  "{",
  sprintf('  "function": %s,', to_json("polr")),
  sprintf('  "r_version": %s,', to_json(R.version.string)),
  sprintf('  "MASS": %s,', to_json(as.character(packageVersion("MASS")))),
  sprintf('  "generated": %s,', to_json(stamp)),
  '  "cases": [',
  paste0("    ", vapply(rows, to_json, character(1)),
         c(rep(",", length(rows) - 1L), "")),
  "  ]",
  "}"
)
writeLines(lines, file.path("/out", "polr.json"))
cat(sprintf("polr: %d cases -> /out/polr.json; MASS %s\n",
            length(rows), as.character(packageVersion("MASS"))))
