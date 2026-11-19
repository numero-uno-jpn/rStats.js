# Robust linear regression oracle: public fitting and summary outputs only.
# Each fit specification supplies the exact argument list used by do.call and recorded in JSON.
# No fitted model object or executable function body is serialized.
# Output: /out/rlm.json (R 4.6.2 / MASS 7.3-66).

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

# Scalar statistical summaries must stay JSON numbers/strings, never named objects.
scalar_num <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NULL)
  unname(num_json(as.numeric(x))[1L])
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
    if (!is.null(names(x))) {
      y <- as.list(v); names(y) <- names(x); return(y)
    }
    if (length(v) == 1L) return(unname(v))
    return(I(as.list(v)))
  }
  if (is.logical(x) || is.character(x)) {
    if (!is.null(names(x))) {
      y <- as.list(x); names(y) <- names(x); return(y)
    }
    if (length(x) == 1L) return(unname(x))
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
  if (is.null(dim(x))) {
    x <- matrix(as.numeric(x), nrow = 1L,
                dimnames = list(if (length(x) == 1L) names(x)[1L] else NULL, names(x)))
  }
  m <- as.matrix(x)
  list(rows = if (is.null(rownames(m))) NULL else I(as.list(rownames(m))),
       cols = if (is.null(colnames(m))) NULL else I(as.list(colnames(m))),
       values = lapply(seq_len(nrow(m)), function(i) I(as.list(num_json(m[i, ])))))
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

fit_record <- function(args) json_value(args)

# Resolve only a symbolic psi name after preserving that same symbol in the recorded args.
resolve_fit_args <- function(args) {
  resolved <- args
  if (!is.null(resolved$psi) && is.language(resolved$psi)) {
    resolved$psi <- eval(resolved$psi, envir = asNamespace("MASS"))
  }
  resolved
}

fit_public_record <- function(fit) {
  sm <- summary(fit)
  list(
    coefficients = json_value(coef(fit)),
    s = scalar_num(fit$s),
    w = json_value(fit$w),
    wresid = json_value(fit$wresid),
    residuals = json_value(unname(residuals(fit))),
    fitted = json_value(unname(fitted(fit))),
    converged = json_value(fit$converged),
    conv = json_value(fit$conv),
    k2 = scalar_num(fit$k2),
    df.residual = scalar_num(fit$df.residual),
    summary = tab(coef(sm)),
    sigma = scalar_num(sm$sigma),
    stddev = scalar_num(sm$stddev),
    df = json_value(sm$df),
    cov.unscaled = tab(sm$cov.unscaled),
    vcov = tab(vcov(fit))
  )
}

# Data are stored in the argument records, making every case independently reproducible.
stackloss_data <- MASS::stackloss
phones_data <- MASS::phones
mtcars_data <- datasets::mtcars
stackloss_formula <- stack.loss ~ Air.Flow + Water.Temp + Acid.Conc.
phones_formula <- calls ~ year
weight_values <- c(rep(1, 10), rep(2, 11))

# One case table is the sole source for fitting calls, recorded arguments, tight refits,
# summary/vcov calls, and S-estimator reference calls. Unspecified arguments are omitted.
cases <- list(
  list(id = "stackloss-huber-default",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data))),
       calls = list(list(operation = "summary", args = list()),
                    list(operation = "vcov", args = list()))),

  list(id = "stackloss-huber-ls",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           init = "ls"))),
       calls = list()),

  list(id = "stackloss-hampel-lts",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           psi = quote(psi.hampel), init = "lts"))),
       calls = list()),

  list(id = "stackloss-hampel-ls",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           psi = quote(psi.hampel), init = "ls"))),
       calls = list()),

  list(id = "stackloss-bisquare-lts",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           psi = quote(psi.bisquare), init = "lts"))),
       calls = list()),

  list(id = "stackloss-scale-mad",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           scale.est = "MAD"))),
       calls = list()),

  list(id = "stackloss-scale-huber",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           scale.est = "Huber"))),
       calls = list()),

  list(id = "stackloss-scale-proposal-2",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           scale.est = "proposal 2"))),
       calls = list()),

  list(id = "stackloss-init-numeric",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           init = c(-40, 0.7, 1.3, -0.15)))),
       calls = list()),

  list(id = "phones-huber",
       fits = list(main = list(args = list(formula = phones_formula, data = phones_data,
                                           maxit = 50))),
       calls = list()),

  list(id = "phones-hampel",
       fits = list(main = list(args = list(formula = phones_formula, data = phones_data,
                                           psi = quote(psi.hampel), init = "lts", maxit = 50))),
       calls = list()),

  list(id = "phones-bisquare",
       fits = list(main = list(args = list(formula = phones_formula, data = phones_data,
                                           psi = quote(psi.bisquare), init = "lts", maxit = 50))),
       calls = list()),

  list(id = "weights-inv",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           weights = weight_values, wt.method = "inv"))),
       calls = list()),

  list(id = "weights-case",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           weights = weight_values, wt.method = "case"))),
       calls = list()),

  list(id = "factor-covariate",
       fits = list(main = list(args = list(formula = mpg ~ wt + factor(cyl), data = mtcars_data))),
       calls = list()),

  list(id = "intercept-only",
       fits = list(main = list(args = list(formula = mpg ~ 1, data = mtcars_data))),
       calls = list()),

  list(id = "phones-maxit-2",
       fits = list(main = list(args = list(formula = phones_formula, data = phones_data, maxit = 2))),
       calls = list()),

  list(id = "stackloss-mm",
       fits = list(main = list(seed = 1L,
                               args = list(formula = stackloss_formula, data = stackloss_data,
                                           method = "MM"))),
       sReferences = lapply(c(1L, 2L, 123L), function(seed) {
         list(seed = seed, args = list(formula = stackloss_formula, data = stackloss_data,
                                       method = "S"))
       }),
       calls = list()),

  list(id = "phones-mm",
       fits = list(main = list(seed = 1L,
                               args = list(formula = phones_formula, data = phones_data,
                                           method = "MM", maxit = 50))),
       sReferences = lapply(c(1L, 2L, 123L), function(seed) {
         list(seed = seed, args = list(formula = phones_formula, data = phones_data,
                                       method = "S"))
       }),
       calls = list()),

  list(id = "error-collinear",
       fits = list(main = list(args = list(formula = mpg ~ wt + I(2 * wt), data = mtcars_data))),
       calls = list()),

  list(id = "error-invalid-method",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           method = "S"))),
       calls = list()),

  list(id = "error-invalid-scale-est",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           scale.est = "mad"))),
       calls = list()),

  list(id = "error-mm-case-weights",
       fits = list(main = list(args = list(formula = stackloss_formula, data = stackloss_data,
                                           method = "MM", weights = weight_values,
                                           wt.method = "case"))),
       calls = list())
)

run_fit <- function(spec) {
  args <- spec$args
  record <- list(fit = fit_record(args))
  if (!is.null(spec$seed)) {
    record$seed <- spec$seed
    set.seed(spec$seed)
  }
  result <- capture_raw(function() do.call(MASS::rlm, resolve_fit_args(args)))
  record$fitResult <- list(warnings = result$warnings, messages = result$messages)
  if (!is.null(result$error)) {
    record$fitResult$error <- result$error
    return(record)
  }
  fit <- result$value
  record$fitPublic <- fit_public_record(fit)

  # Compare default convergence stopping with a strict, high-iteration refit for every M fit.
  # Keep the same data, formula, psi, initialization and weights; override only acc and maxit.
  if (is.null(args$method) || identical(args$method, "M")) {
    tight_args <- args
    tight_args$acc <- 1e-15
    tight_args$maxit <- 2000L
    tight_result <- capture_raw(function() do.call(MASS::rlm, resolve_fit_args(tight_args)))
    tight_record <- list(fit = fit_record(tight_args),
                         fitResult = list(warnings = tight_result$warnings,
                                          messages = tight_result$messages))
    if (!is.null(tight_result$error)) {
      tight_record$fitResult$error <- tight_result$error
    } else {
      tight_record$fitPublic <- fit_public_record(tight_result$value)
    }
    record$fitTight <- tight_record
  }
  record
}

run_call <- function(call_spec, fit) {
  if (call_spec$operation == "summary") {
    return(capture(function() tab(coef(summary(fit)))))
  }
  if (call_spec$operation == "vcov") {
    return(capture(function() tab(vcov(fit))))
  }
  stop("unknown oracle operation")
}

run_s_reference <- function(spec) {
  args <- spec$args
  set.seed(spec$seed)
  result <- capture_raw(function() do.call(MASS::lqs, args))
  record <- list(seed = spec$seed, args = fit_record(args),
                 result = list(warnings = result$warnings, messages = result$messages))
  if (!is.null(result$error)) {
    record$result$error <- result$error
  } else {
    refit <- result$value
    record$reference <- list(coefficients = json_value(coef(refit)),
                             scale = scalar_num(refit$scale),
                             crit = scalar_num(refit$crit))
  }
  record
}

rows <- lapply(cases, function(case) {
  fits <- list()
  fit_rows <- lapply(names(case$fits), function(id) {
    spec <- case$fits[[id]]
    record <- run_fit(spec)
    if (is.null(record$fitResult$error)) {
      # Keep the fitted object only in memory for the requested public summary calls.
      fits[[id]] <<- attr(record, "fit_object")
    }
    record
  })
  names(fit_rows) <- names(case$fits)

  # Refit once for calls, without retaining or serializing a model object in the fixture.
  # The recorded fit result above remains the authoritative fit record.
  calls <- lapply(case$calls, function(call_spec) {
    fit_spec <- case$fits$main
    args <- resolve_fit_args(fit_spec$args)
    if (!is.null(fit_spec$seed)) set.seed(fit_spec$seed)
    refit <- capture_raw(function() do.call(MASS::rlm, args))
    if (!is.null(refit$error)) {
      result <- list(error = "referenced fit did not succeed",
                     warnings = I(list()), messages = I(list()))
    } else {
      result <- run_call(call_spec, refit$value)
    }
    list(operation = call_spec$operation, fit = "main",
         args = json_value(call_spec$args), result = result)
  })

  s_refs <- if (is.null(case$sReferences)) list() else
    lapply(case$sReferences, run_s_reference)

  list(id = case$id, fits = fit_rows, calls = calls, sReferences = s_refs)
})

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
to_json <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA,
                                        null = "null", na = "string")
lines <- c(
  "{",
  sprintf('  "function": %s,', to_json("rlm")),
  sprintf('  "r_version": %s,', to_json(R.version.string)),
  sprintf('  "MASS": %s,', to_json(as.character(packageVersion("MASS")))),
  sprintf('  "generated": %s,', to_json(stamp)),
  '  "cases": [',
  paste0("    ", vapply(rows, to_json, character(1)),
         c(rep(",", length(rows) - 1L), "")),
  "  ]",
  "}"
)
writeLines(lines, file.path("/out", "rlm.json"))
cat(sprintf("rlm: %d cases -> /out/rlm.json; MASS %s\n",
            length(rows), as.character(packageVersion("MASS"))))
