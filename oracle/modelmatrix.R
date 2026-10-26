source("/oracle/_anova.R")

# Model formulas and model matrices: R's terms() and model.matrix() (fixture modelMatrix). Each case has
#   formula    the formula, as a string
#   data       the data frame (see oracle/_anova.R)
#   contrasts  (optional) contrast per factor: "contr.treatment", "contr.sum" or "contr.helmert"
#   levels     (optional) level order per factor (R: factor(x, levels = ...)); levels without data are kept, as
#              model.matrix() keeps them
# Written for each case: termLabels, order (degree of each term), intercept (logical), variables (the variables of
# the formula, response first), factors (R's factor pattern: one row per variable, one column per term; 0 = not in
# the term, 1 = coded by contrasts, 2 = coded by indicators), colNames, assign (term of each column, 0 = intercept),
# rows (1-based rows of data kept after dropping rows with a missing value) and x (the model matrix, one array per
# row). Inputs R rejects: {"error": message}; warnings in "warnings".

set.seed(20261101)
n <- 12
d <- data.frame(
  y = round(rnorm(n, 10, 2), 2),
  A = rep(c("a", "b", "c"), each = 4),
  B = rep(c("p", "q"), times = 6),
  C = rep(c("u", "u", "v", "v"), times = 3),
  x = round(runif(n, 0, 5), 2),
  z = round(rnorm(n), 2),
  L = rep(c(TRUE, FALSE, FALSE), 4),
  stringsAsFactors = FALSE
)
dna <- d
dna$y[2] <- NA; dna$A[5] <- NA; dna$x[9] <- NA
dnum <- data.frame(y = d$y, G = rep(c("10", "9", "2"), 4), stringsAsFactors = FALSE)  # levels sort as strings

cases <- list()
add <- function(formula, data = d, ...) cases[[length(cases) + 1]] <<- c(list(formula = formula, data = data), list(...))

for (f in c("y ~ A", "y ~ A + B", "y ~ A * B", "y ~ B * A", "y ~ A:B + A", "y ~ A:B", "y ~ A + A",
            "y ~ A * B * C", "y ~ (A + B + C)^2", "y ~ A * B * C - A:B:C", "y ~ A/B", "y ~ (A + B)/C",
            "y ~ B %in% A", "y ~ A + B %in% A", "y ~ A*B - B", "y ~ C:B:A + A",
            "y ~ A - 1", "y ~ 0 + A", "y ~ A + B - 1", "y ~ A:B - 1", "y ~ x + A - 1", "y ~ x:A - 1",
            "y ~ x", "y ~ x + z", "y ~ x * z", "y ~ x:z", "y ~ x + A", "y ~ x * A", "y ~ x:A", "y ~ x + x:A",
            "y ~ A:x", "y ~ A * x * B", "y ~ L", "y ~ L * A", "y ~ 1", "y ~ 0", "y ~ -1", "y ~ 1 - 1",
            "y ~ .", "y ~ . - L", "y ~ A + y", "y ~ (A + x)^3", "y ~ A + (B + C)", "y ~ +A",
            "y ~ A + 0", "y ~ A + B + A:B + B:A"))
  add(f)
add("y ~ A * B", data = dna)
add("y ~ x + A", data = dna)
add("y ~ G", data = dnum)
# a value only in rows dropped for a missing value: not a level of a character column (it is of a factor, below)
dlev <- data.frame(y = c(1.2, 2.3, NA, 4.1, 5.5, 3.3), A = c("a", "b", "c", "a", "b", "a"), B = c("p", "q", "r", "q", "p", "q"),
                   x = c(1, 2, 3, 4, 5, 6), L = c(TRUE, TRUE, FALSE, TRUE, TRUE, TRUE), stringsAsFactors = FALSE)
add("y ~ A", data = dlev)
add("y ~ A:x", data = dlev)
add("y ~ A * B", data = dlev)
add("y ~ A", data = dlev, levels = list(A = c("a", "b", "c")))
add("y ~ x + L", data = dlev)                                   # logical: both levels although FALSE is dropped
add("y ~ x:L", data = dlev)
add("y ~ A", contrasts = list(A = "contr.sum"))
add("y ~ A * B", contrasts = list(A = "contr.sum", B = "contr.sum"))
add("y ~ A * B", contrasts = list(A = "contr.helmert"))
add("y ~ A * B", contrasts = list(B = "contr.treatment"))
add("y ~ A:B", contrasts = list(A = "contr.sum", B = "contr.sum"))
add("y ~ A - 1", contrasts = list(A = "contr.sum"))
add("y ~ A", levels = list(A = c("c", "a", "b")))
add("y ~ A * B", levels = list(A = c("b", "c", "a"), B = c("q", "p")))
add("y ~ A", levels = list(A = c("a", "b", "c", "d")))       # an unused level
# errors
d1 <- d; d1$A <- "a"
add("y ~ A", data = d1)                                       # one level
add("y ~ Q")                                                  # unknown variable
add("y ~ A^1")
add("y ~ A^0.5")
add("y ~")
add("~ A")                                                    # no response: allowed

write_anova_fixture("modelMatrix", cases, function(a) {
  r <- with_warnings(function() {
    dat <- a$data
    for (nm in names(a$levels)) dat[[nm]] <- factor(dat[[nm]], levels = a$levels[[nm]])
    f <- as.formula(a$formula)
    tt <- terms(f, data = dat)
    mf <- model.frame(tt, dat)
    ctr <- if (is.null(a$contrasts)) NULL else lapply(a$contrasts, identity)
    X <- model.matrix(tt, mf, contrasts.arg = ctr)
    fac <- attr(tt, "factors")
    list(termLabels = I(attr(tt, "term.labels")), order = I(num2str(attr(tt, "order"))),
         intercept = attr(tt, "intercept") == 1, variables = I(vapply(attr(tt, "variables")[-1], deparse1, "")),
         factors = if (length(fac)) lapply(seq_len(nrow(fac)), function(i) I(num2str(fac[i, ]))) else I(list()),
         colNames = I(as.character(colnames(X))), assign = I(num2str(attr(X, "assign"))),
         rows = I(num2str(as.integer(rownames(mf)))),
         x = lapply(seq_len(nrow(X)), function(i) I(num2str(unname(X[i, ])))))
  })
  c(r$value, list(warnings = r$warnings))
})
