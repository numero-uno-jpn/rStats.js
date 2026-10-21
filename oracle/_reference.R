# Attach high-precision Rmpfr reference values to the cases where the tests disagreed with R.
#
#   Rscript _reference.R <oracle name> <fixture name> ...
#
# Reads /out/<fixture>.mismatch.json (array of args of the disagreeing cases, written by the tests),
# computes them with the reference function registered in oracle/<oracle name>.R, and writes /out/<fixture>.ref.json.
# Variable names must not clash with functions in the oracle files (e.g. beta.R defines out())
args <- commandArgs(trailingOnly = TRUE)
ORACLE_REF_MODE <- TRUE
suppressMessages(library(Rmpfr))
source(file.path("/oracle", paste0(args[1], ".R")))

str2num <- function(s) {
  if (identical(s, "NA") || identical(s, "NaN")) return(NaN)
  if (identical(s, "Inf")) return(Inf)
  if (identical(s, "-Inf")) return(-Inf)
  as.numeric(s)
}

for (name in args[-1]) {
  ref <- REFS[[name]]
  path <- file.path("/out", paste0(name, ".mismatch.json"))
  if (is.null(ref) || !file.exists(path)) {
    cat(sprintf("%s: no reference function or mismatch file\n", name))
    next
  }
  cases <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  res <- list()
  for (a in cases) {
    row <- lapply(a, function(v) if (is.logical(v)) v else str2num(v))
    r <- tryCatch(suppressWarnings(asNumeric(ref(row))), error = function(e) { if (!exists(".err_shown")) { .err_shown <<- TRUE; message("reference computation failed: ", conditionMessage(e)) }; NA_real_ })
    if (length(r) == 1 && is.finite(r)) res[[length(res) + 1]] <- list(args = a, reference = num2str(r))
  }
  # Merge with existing reference values (cases that passed thanks to a reference value are not in the next mismatch file)
  ref_path <- file.path("/out", paste0(name, ".ref.json"))
  if (file.exists(ref_path)) {
    old <- jsonlite::fromJSON(ref_path, simplifyVector = FALSE)
    key <- function(e) paste(names(e$args), unlist(e$args), collapse = "|")
    new_keys <- vapply(res, key, character(1))
    keep <- Filter(function(e) !(key(e) %in% new_keys), old)
    res <- c(keep, res)
  }
  tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA)
  lines <- c("[", if (length(res)) paste0("  ", vapply(res, tj, character(1)),
                                            c(rep(",", length(res) - 1), "")), "]")
  writeLines(lines, file.path("/out", paste0(name, ".ref.json")))
  cat(sprintf("%s: reference values for %d / %d cases (%s)\n", name, length(res), length(cases), R.version.string))
}
