# issue: 560
# isomds111-diverge-more.R (2026-11-24): extend maxit probes and inspect zero-configuration-distance behavior.
# Public MASS outputs only. No source inspection. The caller supplies the resulting .txt output.
suppressPackageStartupMessages(library(MASS))

probe_path <- function(label, d, y = NULL, k = 2, tol_value = 1e-30, last = 240) {
  cat("\nCASE", label, "k", k, "tol", tol_value, "\n")
  previous_points <- NULL
  previous_stress <- NA_real_
  for (limit in 8:last) {
    warning_text <- character()
    printed_text <- if (is.null(y)) {
      capture.output(fit_value <- withCallingHandlers(
        isoMDS(d, k = k, maxit = limit, tol = tol_value),
        warning = function(w) {
          warning_text <<- c(warning_text, conditionMessage(w))
          invokeRestart("muffleWarning")
        }
      ))
    } else {
      capture.output(fit_value <- withCallingHandlers(
        isoMDS(d, y = y, k = k, maxit = limit, tol = tol_value),
        warning = function(w) {
          warning_text <<- c(warning_text, conditionMessage(w))
          invokeRestart("muffleWarning")
        }
      ))
    }
    movement <- if (is.null(previous_points)) NA_real_ else max(abs(fit_value$points - previous_points))
    stress_change <- if (is.na(previous_stress)) NA_real_ else fit_value$stress - previous_stress
    cat("maxit", limit,
        "stress", sprintf("%.15g", fit_value$stress),
        "delta_stress", sprintf("%.6g", stress_change),
        "max_delta_point", sprintf("%.6g", movement),
        "warnings", if (length(warning_text)) paste(warning_text, collapse = " / ") else "-",
        "printed", if (length(printed_text)) paste(trimws(printed_text), collapse = " | ") else "-",
        "\n")
    previous_points <- fit_value$points
    previous_stress <- fit_value$stress
    if (limit > 8 && !is.na(movement) && movement == 0) {
      cat("NO FURTHER MOVEMENT at maxit", limit, "\n")
      break
    }
  }
}

small_data <- matrix(c(1, 2, 0, 4, 0, 3, -1, 5, 2, 2, 7, 0, 0, 0, 1), nrow = 5, byrow = TRUE)
grid_data <- as.matrix(expand.grid(x = 0:2, y = 0:2))
grid_start <- grid_data + 0.1 * cbind(sin(1:9), cos(1:9))
probe_path("swiss_y", dist(swiss), as.matrix(swiss[, c(2, 3)]), 2, 1e-30, 240)
probe_path("grid_ties", dist(grid_data), grid_start, 2, 1e-30, 240)
probe_path("small_k1", dist(small_data), NULL, 1, 1e-30, 240)
probe_path("eurodist_tight", eurodist, NULL, 2, 1e-10, 240)

cat("\nCASE swiss_y_k1_zero_configuration_distance\n")
for (limit in c(0, 1, 2, 5, 8, 9, 20, 50)) {
  warning_text <- character()
  printed_text <- capture.output(fit_value <- withCallingHandlers(
    isoMDS(dist(swiss), y = as.matrix(swiss[, 1, drop = FALSE]), k = 1, maxit = limit, tol = 1e-30),
    warning = function(w) {
      warning_text <<- c(warning_text, conditionMessage(w))
      invokeRestart("muffleWarning")
    }
  ))
  cat("maxit", limit, "stress", sprintf("%.15g", fit_value$stress),
      "warnings", if (length(warning_text)) paste(warning_text, collapse = " / ") else "-",
      "printed", if (length(printed_text)) paste(trimws(printed_text), collapse = " | ") else "-",
      "points_equal_input", isTRUE(all.equal(unname(fit_value$points), unname(as.matrix(swiss[, 1, drop = FALSE])))),
      "\n")
}
