source("/oracle/_htest.R")

# chisq.test(x, y) with two factor vectors (fixture chisqTestFactors). R builds table(x, y) and tests independence;
# the levels are the sorted distinct values, and pairs where either value is NA are dropped. Although the container sets
# LC_ALL=C.UTF-8, R sorts them by collation ("a", "A", "b", "B"), not by code point.
# x and y are written as arrays of strings.

set.seed(20261102)
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
lv <- c("a", "b", "c", "d", "e")
for (i in 1:40) {
  n <- sample(c(5, 10, 30, 100, 500), 1)
  kx <- sample(2:5, 1); ky <- sample(2:5, 1)
  add(x = sample(lv[1:kx], n, TRUE), y = sample(toupper(lv[1:ky]), n, TRUE), correct = sample(c(TRUE, FALSE), 1))
}
# Levels whose sorted order differs from the order of appearance, mixed case, digits
add(x = c("z", "a", "m", "a", "z", "m", "z", "a"), y = c("no", "yes", "yes", "no", "yes", "no", "no", "yes"))
add(x = c("b", "B", "a", "A", "b", "a", "B", "A"), y = c("1", "10", "2", "1", "2", "10", "1", "2"))
# 2 × 2 (continuity correction applies)
add(x = c(rep("m", 12), rep("f", 9)), y = c(rep("y", 7), rep("n", 5), rep("y", 2), rep("n", 7)))
add(x = c(rep("m", 12), rep("f", 9)), y = c(rep("y", 7), rep("n", 5), rep("y", 2), rep("n", 7)), correct = FALSE)
# NA in either vector (the pair is dropped)
add(x = c("a", "b", NA, "a", "b", "a", "b", "b"), y = c("u", "v", "u", NA, "v", "u", "u", "v"))
# Errors: one level in x or y, different lengths, all NA
add(x = c("a", "a", "a", "a"), y = c("u", "v", "u", "v"))
add(x = c("a", "b", "a", "b"), y = c("u", "u", "u", "u"))
add(x = c("a", "b", "a"), y = c("u", "v", "u", "v"))
add(x = c(NA, NA, "a"), y = c("u", "v", NA))

write_htest_fixture("chisqTestFactors", cases, function(a) {
  r <- call_with(chisq.test, list(x = factor(a$x), y = factor(a$y), correct = a$correct))
  f <- htest_fields(r)
  f$alternative <- NULL
  c(f, list(rowLevels = I(rownames(r$observed)), colLevels = I(colnames(r$observed)),
            observed = num_or_vec(unclass(r$observed)), expected = num_or_vec(r$expected),
            residuals = num_or_vec(r$residuals), stdres = num_or_vec(r$stdres)))
})
