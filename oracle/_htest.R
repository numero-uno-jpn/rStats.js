source("/oracle/_common.R")

# Shared code for hypothesis-test fixtures.
#
# Unlike the distribution fixtures (write_fixture), the arguments include vectors, matrices and strings, and the
# expected value has every htest field. Written as one JSON line per case.
#   args:     numbers as strings (num2str), numeric vectors as arrays of strings, matrices as arrays of rows,
#             strings and logicals as is
#   expected: the fields of htest_fields(). Inputs that R rejects become {"error": message}

# Convert one argument to a JSON-writable form (wrap in I() so that length-1 vectors stay arrays)
arg_json <- function(v) {
  if (is.matrix(v)) return(lapply(seq_len(nrow(v)), function(i) I(num2str(v[i, ]))))
  if (is.character(v) || is.logical(v)) return(if (length(v) == 1) v else I(v))
  if (inherits(v, "AsIs") || length(v) != 1) return(I(num2str(unclass(v))))
  num2str(v)
}

num_or_vec <- function(v) {
  v <- unname(v)
  if (is.matrix(v)) return(lapply(seq_len(nrow(v)), function(i) I(num2str(v[i, ]))))
  if (length(v) == 1) num2str(v) else I(num2str(v))
}

# Convert an htest result to a list of fields (same names as the JS HTest)
htest_fields <- function(res) {
  out <- list(method = res$method)
  # Tests without an alternative (chisq.test, kruskal.test, ...) leave the field out instead of writing {}
  if (!is.null(res$alternative)) out$alternative <- res$alternative
  out$statistic <- num2str(unname(res$statistic))
  out$statisticName <- names(res$statistic)
  if (!is.null(res$parameter)) {
    out$parameter <- num2str(unname(res$parameter))
    out$parameterName <- names(res$parameter)
  }
  out$pValue <- num2str(res$p.value)
  if (!is.null(res$conf.int)) {
    out$confInt <- I(num2str(as.vector(res$conf.int)))
    out$confLevel <- num2str(attr(res$conf.int, "conf.level"))
  }
  if (!is.null(res$estimate)) {
    out$estimate <- num_or_vec(res$estimate)
    nm <- names(res$estimate)
    out$estimateNames <- if (length(nm) == 1) nm else I(nm)
  }
  if (!is.null(res$null.value)) {
    out$nullValue <- num2str(unname(res$null.value))
    out$nullValueName <- names(res$null.value)
  }
  out
}

# cases: list of argument lists. fun: function taking an argument list and returning the list of expected fields
# (for a test, e.g. htest_fields(t.test(...))). Errors are caught and turned into {"error": ...}.
# ref: (optional) function taking an argument list and returning high-precision reference fields (a subset is fine).
#      Used to judge cases where R itself is inaccurate. Not called for cases where R raised an error.
#      Unlike distribution reference values, computing means and variances with Rmpfr is fast, so it is done for every case
# info: (optional) extra information written at the top of the fixture (e.g. LAPACK/BLAS versions for linear algebra)
write_htest_fixture <- function(name, cases, fun, ref = NULL, info = NULL) {
  lines <- vapply(cases, function(args) {
    expected <- tryCatch(suppressWarnings(fun(args)),
                         error = function(e) list(error = conditionMessage(e)))
    out <- list(args = lapply(args, arg_json), expected = expected)
    if (!is.null(ref) && is.null(expected$error)) {
      r <- suppressWarnings(ref(args))
      if (!is.null(r)) out$reference <- r
    }
    jsonlite::toJSON(out, auto_unbox = TRUE, digits = NA)
  }, character(1))
  tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE)
  out <- c(
    "{",
    sprintf('  "function": %s,', tj(name)),
    sprintf('  "r_version": %s,', tj(R.version.string)),
    if (!is.null(info)) sprintf('  "info": %s,', tj(info)),
    sprintf('  "generated": %s,', tj(format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))),
    '  "cases": [',
    paste0("    ", lines, c(rep(",", length(lines) - 1), "")),
    "  ]",
    "}"
  )
  path <- file.path("/out", paste0(name, ".json"))
  writeLines(out, path)
  n_err <- sum(grepl('"expected":\\{"error"', lines))
  cat(sprintf("%s: %d cases (%d errors) -> %s (%s)\n", name, length(lines), n_err, path, R.version.string))
}

# Pass only the non-NULL entries of the argument list to the R function
call_with <- function(f, args) do.call(f, Filter(Negate(is.null), args))

# Rmpfr precision (reference values for means and variances)
HTEST_BITS <- 256
mp <- function(x) Rmpfr::mpfr(x, HTEST_BITS)
mp_mean <- function(x) sum(mp(x)) / length(x)
mp_var <- function(x) { m <- mp_mean(x); sum((mp(x) - m)^2) / (length(x) - 1) }
