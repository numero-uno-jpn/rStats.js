# oracle-platform: amd64
# R's results for the demo examples (demo/examples.R, generated from demo/examples.json by
# scripts/demo-examples.mjs), written to demo/r-results.json. x86_64 R because the random
# examples need it (see oracle/_random.R); that image has no jsonlite, so the JSON is written by hand.
source("/oracle/_random.R")

if (!requireNamespace("MASS", quietly = TRUE)) stop("package MASS is required (ginv)")

.rstats_oracle <- TRUE
source("/demo/examples.R")

entries <- vapply(examples, function(ex) {
  value <- tryCatch(jarr(num2str(as.numeric(unlist(suppressWarnings(ex$value()))))),
    error = function(e) sprintf('{"error": %s}', jstr(gsub("[\r\n]+", " ", conditionMessage(e)))))
  if (startsWith(value, "{")) message(sprintf("%s: %s", ex$id, value))
  sprintf("    %s: %s", jstr(ex$id), value)
}, character(1))

lines <- c("{",
  sprintf('  "r_version": %s,', jstr(R.version.string)),
  sprintf('  "platform": %s,', jstr(R.version$platform)),
  sprintf('  "generated": %s,', jstr(format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))),
  '  "results": {',
  paste0(entries, c(rep(",", length(entries) - 1), "")),
  "  }", "}")
writeLines(lines, "/demo/r-results.json")
cat(sprintf("demo: %d examples -> /demo/r-results.json (%s, %s)\n", length(examples), R.version.string, R.version$platform))
