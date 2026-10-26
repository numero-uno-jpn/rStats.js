source("/oracle/_anova.R")

# Grouped summaries (ROADMAP: data handling, b): tapply, split and aggregate. Behaviour in
# oracle/grouping-behaviour.md. Fixture grouping, one case per row:
#   fn      "tapply" (x, index: one or more columns of data named in `by`, fun), "split" (x: a column, or the whole
#           data frame when x is absent; by; drop), "aggregate" (formula and data, fun) or "aggregate.by" (the
#           data.frame form: x the columns named in `cols`, by, fun).
#   fun     one of mean, length, sum, median, sd, max, range, meansd (function(v) c(m = mean(v), s = sd(v))).
#   Written: tapply: dim, dimnames, values (column-major, "NA" for an empty cell; for list cells, `cells`: one array
#   per cell, null when empty); split: names and groups (arrays, or data frames); aggregate: the result as a data
#   frame (matrix columns flattened as R's data.frame() does: y.m, y.s). Errors as {"error": message}.

set.seed(20261202)
d <- data.frame(y = round(rnorm(16, 10, 3), 1), z = round(rnorm(16, 5), 2),
                g = rep(c("b", "a", "c", "a"), 4), h = rep(c("u", "v"), each = 8), k = rep(c(2, 10, 1, 2), 4))
d$y[c(3, 11)] <- NA; d$g[7] <- NA
d2 <- d[d$g %in% c("a", "b") | is.na(d$g), ]          # with h: the combination (c, *) never occurs
d3 <- data.frame(y = c(1, 2, 3, 4, 5, 6), g = c("a", "a", "b", "b", "c", "c"), h = c("u", "u", "u", "v", "v", "v"))
funs <- list(mean = mean, length = length, sum = sum, median = median, sd = sd, max = max, range = range,
             meansd = function(v) c(m = mean(v), s = sd(v)))

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
for (f in c("mean", "length", "sum", "median", "range")) add(fn = "tapply", data = d, x = "y", by = I("g"), fun = f)
add(fn = "tapply", data = d, x = "z", by = I(c("g", "h")), fun = "mean")
add(fn = "tapply", data = d3, x = "y", by = I(c("g", "h")), fun = "sum")         # empty cells: NA
add(fn = "tapply", data = d, x = "z", by = I("k"), fun = "max")                  # numeric index: sorted as numbers
add(fn = "split", data = d, x = "z", by = I("g"))
add(fn = "split", data = d3, x = "y", by = I(c("g", "h")))                       # all combinations, empty ones too
add(fn = "split", data = d3, x = "y", by = I(c("g", "h")), drop = TRUE)
add(fn = "split", data = d3, by = I("h"))                                         # a data frame
for (f in c("mean", "length", "median", "meansd")) add(fn = "aggregate", formula = "y ~ g", data = d, fun = f)
add(fn = "aggregate", formula = "z ~ g + h", data = d, fun = "mean")
add(fn = "aggregate", formula = "cbind(y, z) ~ h", data = d, fun = "sum")
add(fn = "aggregate", formula = ". ~ g", data = d[, c("y", "z", "g")], fun = "mean")
add(fn = "aggregate", formula = "y ~ k", data = d, fun = "sd")
add(fn = "aggregate", formula = "y ~ g + h", data = d3, fun = "sum")
add(fn = "aggregate.by", data = d, cols = I(c("y", "z")), by = I("g"), fun = "mean")   # NA in y stays: mean is NA
add(fn = "aggregate.by", data = d, cols = I("z"), by = I(c("g", "h")), fun = "max")

# (added later, at the end so that the earlier cases keep their indices)
# the grouping variables are the variables of the right-hand side, whatever its operators
for (f in c("y ~ g:h", "y ~ g*h", "y ~ h:g", "y ~ g/h", "y ~ (g + h)^2", "y ~ g + h - g", "y ~ g %in% h", "y ~ 0 + g",
            "y ~ 1", "y ~ .", "cbind(y, z) ~ ."))
  add(fn = "aggregate", formula = f, data = d[, c("y", "z", "g", "h")], fun = "sum")

frame <- function(r) { r <- do.call(data.frame, c(as.list(r), check.names = FALSE)); rownames(r) <- NULL; df_json(r) }
write_anova_fixture("grouping", cases, function(a) {
  dd <- a$data; f <- if (is.null(a$fun)) NULL else funs[[a$fun]]
  switch(a$fn,
    tapply = {
      idx <- if (length(a$by) == 1) dd[[a$by]] else lapply(unclass(a$by), function(b) dd[[b]])
      r <- tapply(dd[[a$x]], idx, f)
      dn <- dimnames(r); out <- list(dim = I(dim(r)), dimnames = lapply(dn, I))
      if (is.list(r)) out$cells <- lapply(seq_along(r), function(i) if (is.null(r[[i]])) NULL else I(num2str(r[[i]])))
      else out$values <- I(num2str(as.vector(r)))
      out
    },
    split = {
      f2 <- if (length(a$by) == 1) dd[[a$by]] else lapply(unclass(a$by), function(b) dd[[b]])
      drop <- isTRUE(a$drop)
      s <- if (is.null(a$x)) split(dd, f2, drop = drop) else split(dd[[a$x]], f2, drop = drop)
      list(names = I(names(s)), groups = unname(lapply(s, function(v) if (is.data.frame(v)) { rownames(v) <- NULL; df_json(v) } else I(num2str(v)))))
    },
    aggregate = list(result = frame(aggregate(as.formula(a$formula), data = dd, FUN = f))),
    aggregate.by = list(result = frame(aggregate(dd[unclass(a$cols)], by = lapply(setNames(unclass(a$by), unclass(a$by)), function(b) dd[[b]]), FUN = f))))
})
