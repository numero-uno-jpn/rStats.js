# Shared code for writing random-number fixtures (sourced by oracle/random*.R).
#
# Random-number fixtures are generated with x86_64 R (scripts/oracle.sh runs rocker/r-ver with
# --platform linux/amd64). In arm64 builds of R the compiler fuses multiply-adds into FMA,
# so the last digits of qnorm and others differ from x86_64 builds, and that shows up in the random numbers.
# This image has no jsonlite, so the JSON is written by hand.
#
# One case = the value (numeric vector) of evaluating expr right after set.seed(seed), plus
# a following runif(1) (to check how many random numbers were consumed).

num2str <- function(x) {
  vapply(x, function(v) {
    if (is.na(v) && !is.nan(v)) return("NA")
    if (is.nan(v)) return("NaN")
    if (is.infinite(v)) return(if (v > 0) "Inf" else "-Inf")
    sprintf("%.17g", v)
  }, character(1), USE.NAMES = FALSE)
}
jstr <- function(s) paste0('"', gsub('"', '\\\\"', s), '"')
jarr <- function(v) paste0("[", paste(jstr(v), collapse = ","), "]")
jval <- function(v) {
  if (is.logical(v)) return(if (v) "true" else "false")
  if (is.character(v)) return(jstr(v))
  if (length(v) == 1) jstr(num2str(v)) else jarr(num2str(v))
}
jobj <- function(l) paste0("{", paste(sprintf("%s:%s", jstr(names(l)), vapply(l, jval, "")), collapse = ","), "}")

CASES <- list()
# args: named list with the JS argument names (copied into the fixture as is). f: expression (function) that generates the random numbers
rcase <- function(seed, args, f) {
  set.seed(seed)
  v <- suppressWarnings(f())
  nxt <- runif(1)
  CASES[[length(CASES) + 1]] <<- sprintf('{"seed":%s,"args":%s,"expected":%s,"next":%s}',
    jstr(num2str(seed)), jobj(args), jarr(num2str(as.numeric(v))), jstr(num2str(nxt)))
}

write_random_fixture <- function(name) {
  lines <- c("{",
    sprintf('  "function": %s,', jstr(name)),
    sprintf('  "r_version": %s,', jstr(R.version.string)),
    sprintf('  "platform": %s,', jstr(R.version$platform)),
    sprintf('  "generated": %s,', jstr(format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))),
    '  "cases": [',
    paste0("    ", unlist(CASES), c(rep(",", length(CASES) - 1), "")),
    "  ]", "}")
  path <- file.path("/out", paste0(name, ".json"))
  writeLines(lines, path)
  cat(sprintf("%s: %d cases -> %s (%s, %s)\n", name, length(CASES), path, R.version.string, R.version$platform))
  CASES <<- list()
}
