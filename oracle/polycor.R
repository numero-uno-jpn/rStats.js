source("/oracle/_anova.R")
suppressPackageStartupMessages({library(polycor); library(mvtnorm)})

# Polychoric and polyserial correlation, two-step estimates (fixture polycor), and the bivariate normal rectangle
# probabilities they rest on (fixture pbvnorm).
#   polycor   fn "polychor" (x, y: integer categories, or table: a contingency table) or "polyserial" (x numeric,
#             y categories); ML = FALSE and std.err = FALSE (polycor's defaults). Written: rho, warnings.
#   pbvnorm   lower = (a1, a2), upper = (b1, b2), rho: mvtnorm::pmvnorm(lower, upper, corr) for the standard bivariate
#             normal (in two dimensions mvtnorm's algorithm is deterministic and accurate to about 1e-15).
set.seed(20261127)
n <- 300
z <- MASS::mvrnorm(n, c(0, 0), matrix(c(1, 0.55, 0.55, 1), 2))
cut3 <- function(v, b) as.integer(cut(v, c(-Inf, b, Inf)))
cases <- list()
add <- function(...) cases[[length(cases) + 1]] <<- list(...)
add(fn = "polychor", x = I(cut3(z[, 1], 0)), y = I(cut3(z[, 2], 0.3)))                     # tetrachoric
add(fn = "polychor", x = I(cut3(z[, 1], c(-0.5, 0.6))), y = I(cut3(z[, 2], c(-1, 0, 1))))
add(fn = "polychor", x = I(cut3(z[, 1], c(-1, -0.2, 0.4, 1.2))), y = I(cut3(-z[, 2], c(-0.7, 0.7))))  # negative
add(fn = "polychor", table = matrix(c(20, 5, 2, 8, 30, 6, 1, 9, 25), 3))
add(fn = "polychor", table = matrix(c(40, 0, 3, 0, 0, 0, 2, 0, 35), 3))                     # a zero row and column
add(fn = "polychor", table = matrix(c(50, 1, 1, 48), 2))                                    # strong association
for (b in list(0, c(-0.5, 0.6), c(-1, -0.2, 0.4, 1.2)))
  add(fn = "polyserial", x = I(round(z[, 1], 3)), y = I(cut3(z[, 2], b)))
add(fn = "polyserial", x = I(round(-z[, 1], 3)), y = I(cut3(z[, 2], c(-0.3, 0.9))))
write_anova_fixture("polycor", cases, function(a) {
  r <- with_warnings(function() switch(a$fn,
    polychor = if (!is.null(a$table)) polychor(a$table) else polychor(unclass(a$x), unclass(a$y)),
    polyserial = polyserial(unclass(a$x), unclass(a$y))))
  list(rho = num2str(r$value), warnings = r$warnings)
})
grid <- list()
for (rho in c(-0.99, -0.6, -0.1, 0, 0.3, 0.75, 0.95, 0.999)) for (box in list(c(-Inf, -Inf, 0, 0), c(-1, -0.5, 0.3, 1.2),
    c(0.5, -Inf, Inf, -0.2), c(-Inf, 1, 2, Inf), c(-3, -3, -2.5, -2.4), c(2, 2, Inf, Inf), c(-0.2, -0.1, 0.1, 0.2)))
  grid[[length(grid) + 1]] <- list(lower = I(box[1:2]), upper = I(box[3:4]), rho = rho)
write_anova_fixture("pbvnorm", grid, function(a)
  list(value = num2str(as.numeric(pmvnorm(lower = unclass(a$lower), upper = unclass(a$upper), corr = matrix(c(1, a$rho, a$rho, 1), 2))))))
