source("/oracle/_anova.R")
suppressPackageStartupMessages(library(tidyr))

# Wide and long formats (ROADMAP: data handling): tidyr's pivot_longer and pivot_wider. Behaviour in
# oracle/pivot-behaviour.md. Fixture pivot, one case per row:
#   fn       "pivot_longer" or "pivot_wider"; data (format of oracle/_anova.R); the other arguments with tidyr's
#            names: cols (column names), names_to, values_to, names_prefix, names_sep, names_pattern, values_drop_na,
#            cols_vary, names_transform ("integer": as.integer on that names_to column), id_cols, names_from,
#            values_from, names_sort, names_vary, values_fill, values_fn ("mean", "sum", "length").
#   Written: the result as a data frame, its column names in order (names); warnings (cli's message text); errors as
#   {"error": message}.

wide <- data.frame(id = c("s1", "s2", "s3", "s4"), group = c("a", "a", "b", "b"),
                   t1 = c(5.1, 4.8, 6.2, 5.9), t2 = c(6.3, NA, 6.8, 7.7), t3 = c(7.2, 6.5, 9.4, 8.8))
wide2 <- data.frame(id = 1:3, score_pre = c(10, 12, 9), score_post = c(14, 15, 11),
                    weight_pre = c(60.5, 72, 55.1), weight_post = c(59, 70.5, 55))
odd <- data.frame(id = 1:2, a_x = c(1, 2), b = c(3, 4), c_y_z = c(5, 6))
mixed <- data.frame(id = 1:2, x = c(1, 2), y = c("u", "v"))
lgl <- data.frame(id = 1:2, x = c(1.5, 2), y = c(TRUE, NA))
long <- data.frame(id = c("s1", "s1", "s1", "s2", "s2", "s3", "s3", "s3"), group = c("a", "a", "a", "a", "a", "b", "b", "b"),
                   time = c("t1", "t2", "t3", "t1", "t3", "t3", "t1", "t2"), score = c(5.1, 6.3, 7.2, 4.8, 6.5, 9.4, 6.2, 6.8))
long2 <- data.frame(id = rep(1:2, each = 4), measure = rep(c("score", "score", "weight", "weight"), 2),
                    time = rep(c("pre", "post"), 4), value = c(10, 14, 60.5, 59, 12, 15, 72, 70.5))
long3 <- data.frame(id = c(1, 1, 2, 2), time = c(3, 1, 1, 2), score = c(30, 10, 11, 21), weight = c(3.5, 1.5, 1.1, 2.1))
dup <- data.frame(id = c(1, 1, 1, 2), time = c("a", "a", "b", "a"), y = c(1, 2, 3, 4))
nanames <- data.frame(id = c(1, 1, 2), key = c("p", NA, "p"), y = c(1, 2, 3))

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
add(fn = "pivot_longer", data = wide, cols = I(c("t1", "t2", "t3")), names_to = "time", values_to = "score")
add(fn = "pivot_longer", data = wide, cols = I(c("t1", "t2", "t3")), names_to = "time", names_prefix = "t", names_transform = "integer", values_to = "score")
add(fn = "pivot_longer", data = wide, cols = I(c("t1", "t2", "t3")), values_drop_na = TRUE)
add(fn = "pivot_longer", data = wide, cols = I(c("t3", "t1")), cols_vary = "slowest")
add(fn = "pivot_longer", data = wide2, cols = I(c("score_pre", "score_post", "weight_pre", "weight_post")), names_to = I(c(".value", "time")), names_sep = "_")
add(fn = "pivot_longer", data = wide2, cols = I(c("score_pre", "score_post", "weight_pre", "weight_post")), names_to = I(c("measure", "time")), names_sep = "_")
add(fn = "pivot_longer", data = wide2, cols = I(c("score_pre", "score_post", "weight_pre", "weight_post")), names_to = I(c("measure", "time")), names_pattern = "(.*)_(pre|post)")
add(fn = "pivot_longer", data = wide, cols = I(c("t1", "t2", "t3")), names_to = "time", names_pattern = "t(\\d)")
add(fn = "pivot_longer", data = odd, cols = I(c("a_x", "b", "c_y_z")), names_to = I(c("v", "w")), names_sep = "_")
add(fn = "pivot_longer", data = mixed, cols = I(c("x", "y")))
add(fn = "pivot_longer", data = lgl, cols = I(c("x", "y")))
add(fn = "pivot_longer", data = wide, cols = I(character(0)))
add(fn = "pivot_wider", data = long, names_from = "time", values_from = "score")
add(fn = "pivot_wider", data = long, names_from = "time", values_from = "score", values_fill = 0)
add(fn = "pivot_wider", data = long, names_from = "time", values_from = "score", names_sort = TRUE)
add(fn = "pivot_wider", data = long, names_from = "time", values_from = "score", names_prefix = "score_", id_cols = I("id"))
add(fn = "pivot_wider", data = long2, names_from = I(c("measure", "time")), values_from = "value")
add(fn = "pivot_wider", data = long2, names_from = I(c("measure", "time")), values_from = "value", names_sep = ".")
add(fn = "pivot_wider", data = long3, names_from = "time", values_from = I(c("score", "weight")))
add(fn = "pivot_wider", data = long3, names_from = "time", values_from = I(c("score", "weight")), names_vary = "slowest", names_sort = TRUE)
add(fn = "pivot_wider", data = dup, names_from = "time", values_from = "y")
add(fn = "pivot_wider", data = dup, names_from = "time", values_from = "y", values_fn = "mean")
add(fn = "pivot_wider", data = dup, names_from = "time", values_from = "y", values_fn = "length")
add(fn = "pivot_wider", data = nanames, names_from = "key", values_from = "y")

fns <- list(mean = mean, sum = sum, length = length)
write_anova_fixture("pivot", cases, function(a) {
  r <- with_warnings(function() suppressWarnings(classes = "lifecycle_warning_deprecated", {
    if (a$fn == "pivot_longer") {
      args <- list(a$data, cols = tidyselect::all_of(unclass(a$cols)))
      for (k in c("names_to", "values_to", "names_prefix", "names_sep", "names_pattern", "values_drop_na", "cols_vary"))
        if (!is.null(a[[k]])) args[[k]] <- unclass(a[[k]])
      if (!is.null(a$names_transform)) args$names_transform <- setNames(list(as.integer), a$names_to)
      do.call(pivot_longer, args)
    } else {
      args <- list(a$data, names_from = tidyselect::all_of(unclass(a$names_from)), values_from = tidyselect::all_of(unclass(a$values_from)))
      for (k in c("names_prefix", "names_sep", "names_sort", "names_vary", "values_fill")) if (!is.null(a[[k]])) args[[k]] <- unclass(a[[k]])
      if (!is.null(a$id_cols)) args$id_cols <- tidyselect::all_of(unclass(a$id_cols))
      if (!is.null(a$values_fn)) args$values_fn <- fns[[a$values_fn]]
      do.call(pivot_wider, args)
    }
  }))
  v <- as.data.frame(r$value)
  if (any(vapply(v, is.list, NA))) v[] <- lapply(v, function(col) if (is.list(col)) vapply(col, function(e) paste(e, collapse = ","), "") else col)
  rownames(v) <- NULL
  list(result = df_json(v), names = I(names(v)), warnings = r$warnings)
})
