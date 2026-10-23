source("/oracle/_common.R")

# dmultinom (R's stats).
# Not yet run: written without R at hand, together with the mpmath reference fixture
# (scripts/mpmath/multinom.py). The tests compare with this R fixture once it exists.
# The arguments are vectors, so the cases are written here instead of through write_fixture
# (same layout: one case per line, numbers as %.17g strings).

grid <- list(
  list(c(1, 2, 1), c(0.2, 0.5, 0.3)), list(c(0, 0, 0), c(0.2, 0.5, 0.3)), list(c(3, 0, 0), c(1, 1, 1)),
  list(c(5, 0, 2), c(0.5, 0, 0.5)), list(c(5, 1, 2), c(0.5, 0, 0.5)), list(c(10, 20, 30, 40), c(1, 2, 3, 4)),
  list(c(100, 200, 300), c(0.1, 0.3, 0.6)), list(c(1000, 2000, 7000), c(0.1, 0.2, 0.7)),
  list(c(1e5, 2e5, 7e5), c(0.1, 0.2, 0.7)), list(c(1e7, 2e7, 7e7), c(0.1, 0.2, 0.7)),
  list(c(1e9, 1, 0), c(1, 1e-12, 1e-300)), list(c(0, 0, 50), c(1e-10, 1e-10, 1)), list(rep(1, 10), rep(1, 10)),
  list(c(50, 0), c(1e-300, 1)), list(c(2, 3), c(1e-200, 1e-200)), list(7, 2.5)
)
cases <- list()
for (g in grid) for (lg in c(FALSE, TRUE)) {
  cases[[length(cases) + 1]] <- list(args = list(x = num2str(g[[1]]), prob = num2str(g[[2]]), log = lg),
                                     expected = num2str(dmultinom(g[[1]], prob = g[[2]], log = lg)))
}
tj <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = NA)
lines <- c("{", '  "function": "dmultinom",', sprintf('  "r_version": %s,', tj(R.version.string)),
           sprintf('  "generated": %s,', tj(format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))), '  "cases": [',
           paste0("    ", vapply(cases, tj, character(1)), c(rep(",", length(cases) - 1), "")), "  ]", "}")
writeLines(lines, "/out/dmultinom.json")
cat(sprintf("dmultinom: %d cases (%s)\n", length(cases), R.version.string))
