source("/oracle/_anova.R")

# Data frame operations (ROADMAP: data handling, c): merge, subset, rbind and cbind of data frames. Behaviour in
# oracle/dataframes-behaviour.md. Fixture dataFrames, one case per row:
#   fn     "merge" (x, y, and by / by.x / by.y / all / all.x / all.y / sort / suffixes as given), "subset" (data,
#          keep: the logical condition as computed in R, NA included; select: column names), "rbind" (x, y),
#          "cbind" (x, y).
#   Written: the result data frame (format of oracle/_anova.R), its column names in order (names), or
#   {"error": message}; warnings.

a <- data.frame(id = c(3, 1, 2, 5, 1), v = c(10, 20, 30, 40, 50), s = c("p", "q", "r", "s", "t"))
b <- data.frame(id = c(1, 2, 2, 4, 3), w = c(0.5, 1.5, 2.5, 3.5, 4.5), s = c("x", "y", "z", "u", "v"))
bn <- b; names(bn)[1] <- "key"
set.seed(20261203)
big1 <- data.frame(k = sample(c("a", "b", "c"), 14, replace = TRUE), x = 1:14)      # many duplicates: R's Shell sort
big2 <- data.frame(k = sample(c("a", "b", "d"), 11, replace = TRUE), y = 101:111)
m1 <- data.frame(p = c(9, 10, 9, 10, 2), q = c("a", "a", "b", "b", "a"), v = 1:5)
m2 <- data.frame(p = c(10, 9, 2, 9), q = c("a", "a", "a", "b"), w = c(0.1, 0.2, 0.3, 0.4))
ch1 <- data.frame(g = c("b", "a", "c"), n = c(1, 2, 3)); ch2 <- data.frame(g = c("c", "a", "a", "d"), m = c(7, 8, 9, 10))
na1 <- data.frame(id = c(1, NA, 2), v = c(1, 2, 3)); na2 <- data.frame(id = c(NA, 2, 1), w = c(4, 5, 6))

cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
add(fn = "merge", x = a, y = b, by = "id")                      # common s gets suffixes
add(fn = "merge", x = a, y = b, by = "id", all = TRUE)
add(fn = "merge", x = a, y = b, by = "id", all.x = TRUE)
add(fn = "merge", x = a, y = b, by = "id", all.y = TRUE)
add(fn = "merge", x = a, y = b, by = "id", sort = FALSE)
add(fn = "merge", x = a, y = b, by = "id", suffixes = I(c("_a", "_b")))
add(fn = "merge", x = a, y = bn, by.x = "id", by.y = "key")
add(fn = "merge", x = a, y = b)                                  # by = intersect(names): id and s (no match)
add(fn = "merge", x = big1, y = big2, by = "k")
add(fn = "merge", x = big1, y = big2, by = "k", sort = FALSE)
add(fn = "merge", x = big1, y = big2, by = "k", all = TRUE, sort = FALSE)
add(fn = "merge", x = m1, y = m2, by = I(c("p", "q")))         # several keys: ordered as joined text
add(fn = "merge", x = m1, y = m2, by = I(c("p", "q")), all = TRUE)
add(fn = "merge", x = ch1, y = ch2, by = "g", all = TRUE)
add(fn = "merge", x = na1, y = na2, by = "id")                  # NA keys match each other
add(fn = "merge", x = a, y = b, by = "nope")
dd <- data.frame(y = c(5, NA, 7, 2, 9), g = c("a", "b", "a", NA, "b"), z = c(1, 2, 3, 4, 5))
add(fn = "subset", data = dd, keep = I(dd$y > 4), select = I(c("y", "g")))
add(fn = "subset", data = dd, keep = I(dd$g == "a"))
add(fn = "subset", data = dd, keep = I(rep(TRUE, 5)), select = I("z"))
add(fn = "rbind", x = a, y = a[2:3, c("s", "v", "id")])         # matched by name
add(fn = "rbind", x = a, y = b)                                 # different names: error
add(fn = "cbind", x = a[, 1:2], y = b[, 2:3])

out_df <- function(r) { rownames(r) <- NULL; list(result = df_json(r), names = I(names(r))) }
write_anova_fixture("dataFrames", cases, function(a) {
  r <- with_warnings(function() switch(a$fn,
    merge = { args <- list(a$x, a$y)
      for (k in c("by", "by.x", "by.y", "all", "all.x", "all.y", "sort", "suffixes")) if (!is.null(a[[k]])) args[[k]] <- unclass(a[[k]])
      do.call(merge, args) },
    subset = { if (is.null(a$select)) subset(a$data, unclass(a$keep)) else subset(a$data, unclass(a$keep), select = unclass(a$select)) },
    rbind = rbind(a$x, a$y),
    cbind = cbind(a$x, a$y)))
  c(out_df(r$value), list(warnings = r$warnings))
})
