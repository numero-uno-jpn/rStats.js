# Record R's warnings for the cases of existing hypothesis-test fixtures, without regenerating their numbers.
# Run by scripts/fixture-warnings.mjs (which reads and rewrites the fixtures): see that file.
#
#   Rscript --vanilla scripts/fixture-warnings.R <oracle name> <work dir>
#
# The oracle script (oracle/<name>.R) is sourced with write_htest_fixture replaced: for each fixture it writes, the
# cases it builds give the R types and shapes of the arguments (character, matrix, list, AsIs, ...), and the values
# are taken from the fixture's args (the local R may build slightly different numbers than the oracle's image).
# Numbers come as hexadecimal floats from <work dir>/<fixture>.map.json (made by the .mjs from the fixture's
# strings), as R on Windows can read a decimal string into the neighbouring double. Each case's function is then
# called with withCallingHandlers; <work dir>/<fixture>.warnings.json gets, per case, R's warnings (unique, in
# order) or null where R raised an error.

#
#   Rscript --vanilla scripts/fixture-warnings.R --run <oracle name>
#
# runs the oracle as it is, writing its fixtures to test/fixtures (for oracles of warnings only, such as
# oracle/htestwarnings.R, whose fixture has no numbers to keep).

local({
  a <- commandArgs(trailingOnly = TRUE)
  RUN <<- a[1] == "--run"
  ORACLE <<- if (RUN) a[2] else a[1]
  WORK <<- a[2]
})
ORACLE_DIR <- normalizePath("oracle", winslash = "/", mustWork = TRUE)
Sys.setenv(LANGUAGE = "en")
if (RUN) HTEST_OUT <- "test/fixtures"

source <- function(file, ...) {
  base::source(sub("^/oracle/", paste0(ORACLE_DIR, "/"), file), ...)
  # write_htest_fixture is defined by oracle/_htest.R: replace it once that is sourced
  if (!RUN && basename(file) == "_htest.R") assign("write_htest_fixture", record_warnings, envir = globalenv())
}

# The ids of a value's numbers in the layout that arg_json gives it (same shape, the k-th number replaced by k)
num_ids <- function(v) {
  if (is.list(v)) return(relist(as.numeric(seq_along(unlist(v))), skeleton = v))
  iv <- v
  storage.mode(iv) <- "double"
  iv[] <- seq_along(v)
  iv
}

# Walk the arg_json form of the ids and the fixture's form of the same argument side by side: pairs (id, string)
pair_leaves <- function(ids, fx) {
  if (is.list(ids)) {
    if (length(ids) != length(fx)) stop("shape differs")
    return(do.call(rbind, c(list(matrix(character(0), 0, 2)), Map(pair_leaves, ids, fx))))
  }
  ids <- as.character(unclass(ids))
  fx <- if (is.list(fx)) unlist(fx) else fx
  if (length(ids) != length(fx)) stop("length differs")
  cbind(ids, fx)
}

parse_num <- function(s, map) {
  out <- rep(NA_real_, length(s))
  out[s == "NaN"] <- NaN
  out[s == "Inf"] <- Inf
  out[s == "-Inf"] <- -Inf
  k <- !(s %in% c("NA", "NaN", "Inf", "-Inf"))
  h <- map[s[k]]
  if (anyNA(h)) stop("number not in the map: ", s[k][is.na(h)][1])
  out[k] <- h
  out
}

# Doubles of hexadecimal floats "[-]0x1.<13 digits>p<e>" (or "[-]0x0p+0"). R's own reading of hexadecimal strings
# gives 0 for subnormal numbers (on Windows), so the value is built as the 53-bit integer mantissa (exact) times two
# powers of 2 (exact; the second product is the representable result). Checked against sprintf("%a").
hex_values <- function(h) {
  m <- regmatches(h, regexec("^(-?)0x([01])(?:\\.([0-9a-f]{13}))?p([-+][0-9]+)$", h))
  v <- vapply(m, function(p) {
    if (length(p) == 0) stop("not a hexadecimal float")
    s <- if (p[2] == "-") -1 else 1
    if (p[3] == "0") return(s * 0)
    k <- as.integer(p[5]) - 52
    s * as.numeric(paste0("0x1", p[4])) * 2^(k %/% 2) * 2^(k - k %/% 2)
  }, numeric(1))
  canonical <- sub("\\.p", "p", sub("(\\.[0-9a-f]*?)0+p", "\\1p", h))
  bad <- sprintf("%a", v) != canonical
  if (any(bad)) stop("hexadecimal float read wrongly: ", h[bad][1], " -> ", sprintf("%a", v[bad][1]))
  v
}

# R value of one argument: the template's type and shape, the fixture's values
rebuild <- function(tpl, fx, aj, map) {
  if (is.null(fx)) stop("argument missing in the fixture")
  if (is.null(tpl)) {
    if (length(fx) != 0) stop("NULL argument differs")
    return(NULL)
  }
  if (is.character(tpl) || is.logical(tpl) || is.factor(tpl)) {
    # (NA is written as null)
    got <- if (is.list(fx)) vapply(fx, function(e) if (is.null(e)) NA_character_ else as.character(e), "") else as.character(fx)
    if (!identical(got, as.character(unclass(tpl)))) stop("non-numeric argument differs")
    return(tpl)
  }
  pairs <- pair_leaves(aj(num_ids(tpl)), fx)
  vals <- numeric(length(unlist(tpl)))
  vals[as.integer(pairs[, 1])] <- parse_num(pairs[, 2], map)
  if (is.list(tpl)) return(relist(vals, skeleton = tpl))
  out <- tpl
  if (is.integer(tpl) && all(is.na(vals) | vals == round(vals))) out[] <- as.integer(vals) else {
    storage.mode(out) <- "double"
    out[] <- vals
  }
  out
}

# As write_htest_fixture(..., warnings = TRUE): with_warnings (oracle/_common.R), then drop_htest_warnings
# (oracle/_htest.R). NULL where R raises an error
collect_warnings <- function(f) {
  tryCatch({
    r <- with_warnings(f)
    list(value = r$value, warnings = drop_htest_warnings(r$warnings))
  }, error = function(e) NULL)
}

# The fields of a result whose numbers differ from the fixture's expected ones beyond 1e-13 (a check that the
# arguments were rebuilt exactly; the decimal strings are compared as numbers)
# (read with Rmpfr: R on Windows reads "1.0000000000000007e-300" 1.6e-8 off)
num_of <- function(s) {
  s <- as.character(unlist(s))
  out <- rep(NA_real_, length(s))
  out[s == "NaN"] <- NaN
  out[s == "Inf"] <- Inf
  out[s == "-Inf"] <- -Inf
  k <- grepl("^[-+]?([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][-+]?[0-9]+)?$", s)
  if (any(k)) out[k] <- Rmpfr::asNumeric(Rmpfr::mpfr(s[k], 128))
  out
}
other_fields <- function(value, expected) {
  Filter(function(k) {
    a <- num_of(value[[k]])
    e <- num_of(expected[[k]])
    if (length(a) != length(e)) return(TRUE)
    ok <- (is.na(a) & is.na(e)) | (!is.na(a) & !is.na(e) & (a == e | abs(a - e) <= 1e-13 * pmax(abs(a), abs(e))))
    !all(ok)
  }, intersect(names(value), names(expected)))
}

# Fixtures whose R function is not installed here and gives no warnings: every case without an error gets []
NO_WARNINGS <- list(zTest = "BSDA is not installed; BSDA::z.test has no warning() and its pnorm and qnorm give none")

write_warnings <- function(name, out) {
  json <- vapply(out, function(w) if (is.null(w)) "null" else as.character(jsonlite::toJSON(I(w))), character(1))
  writeLines(c("[", paste0(json, c(rep(",", length(json) - 1), "")), "]"), file.path(WORK, paste0(name, ".warnings.json")),
             useBytes = TRUE)
}

record_warnings <- function(name, cases, fun, ref = NULL, info = NULL, warnings = FALSE) {
  if (!warnings) {
    cat(sprintf("%s: skipped (the oracle does not record its warnings)\n", name))
    return(invisible(NULL))
  }
  aj <- get("arg_json", envir = globalenv())
  fx_path <- file.path("test", "fixtures", paste0(name, ".json"))
  map_path <- file.path(WORK, paste0(name, ".map.json"))
  if (!file.exists(map_path)) {
    cat(sprintf("%s: skipped (no map)\n", name))
    return(invisible(NULL))
  }
  fx <- jsonlite::fromJSON(fx_path, simplifyVector = FALSE)
  m <- jsonlite::fromJSON(map_path, simplifyVector = TRUE)
  map <- setNames(hex_values(m$hex), m$str)
  if (name %in% names(NO_WARNINGS)) {
    out <- lapply(fx$cases, function(c) if (is.null(c$expected$error)) character(0) else NULL)
    write_warnings(name, out)
    cat(sprintf("%s: %d cases, all without warnings (not run: %s)\n", name, length(out), NO_WARNINGS[[name]]))
    return(invisible(NULL))
  }
  if (length(fx$cases) != length(cases)) stop(sprintf("%s: %d cases in the fixture, %d built", name, length(fx$cases), length(cases)))
  differ <- 0
  status <- 0
  other <- integer(0)
  fields <- character(0)
  out <- vector("list", length(cases))
  for (i in seq_along(cases)) {
    tpl <- cases[[i]]
    fa <- fx$cases[[i]]$args
    if (!setequal(names(tpl), names(fa))) stop(sprintf("%s case %d: argument names differ", name, i))
    # (an argument may be NULL, written as [])
    args <- lapply(setNames(names(tpl), names(tpl)), function(k) rebuild(tpl[[k]], fa[[k]], aj, map))
    if (!identical(args, tpl)) differ <- differ + 1
    r <- collect_warnings(function() fun(args))
    # the fixture's error and the local error must agree
    if (is.null(r) != !is.null(fx$cases[[i]]$expected$error)) {
      status <- status + 1
      if (Sys.getenv("FIXTURE_WARNINGS_DEBUG") != "") {
        cat(sprintf("  case %d: error here %s / fixture %s\n", i, is.null(r), format(fx$cases[[i]]$expected$error)))
      }
    }
    if (!is.null(r)) {
      f <- other_fields(r$value, fx$cases[[i]]$expected)
      if (length(f) > 0) other <- c(other, i)
      if (length(f) > 0 && Sys.getenv("FIXTURE_WARNINGS_DEBUG") != "" && length(other) <= 3) {
        for (k in f) cat(sprintf("  case %d %s: here %s / fixture %s\n", i, k, paste(head(unlist(r$value[[k]]), 6), collapse = " "),
                                 paste(head(unlist(fx$cases[[i]]$expected[[k]]), 6), collapse = " ")))
      }
      fields <- c(fields, f)
    }
    out[i] <- list(r$warnings)
  }
  write_warnings(name, out)
  n_w <- sum(vapply(out, length, integer(1)) > 0)
  cat(sprintf(paste("%s: %d cases, %d with warnings; %d built locally with other numbers than the fixture's;",
                    "%d error status differs; %d results differ from the fixture's beyond 1e-13 (cases %s; fields %s)\n"),
              name, length(cases), n_w, differ, status, length(other), paste(head(other, 10), collapse = " "),
              paste(names(table(fields)), table(fields), collapse = ", ")))
}

source(file.path("/oracle", paste0(ORACLE, ".R")))
