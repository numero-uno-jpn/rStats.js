source("/oracle/_common.R")

# digamma, trigamma, psigamma (R's base).
# Not yet run: written without R at hand, together with the mpmath reference fixtures
# (scripts/mpmath/psigamma.py). The tests compare with these R fixtures once they exist.

px <- c(1e-300, 1e-100, 1e-10, 1e-5, 0.001, 0.1, 0.5, 1, 1.4616321449683623, 1.46, 1.47, 1.5, 2, 2.5, 3,
        5, 7.75, 9.5, 10, 10.5, 20, 33.3, 100, 1e3, 1e5, 1e8, 1e9, 1e15, 1e17, 1e100, 1e300,
        -1e-10, -0.1, -0.3, -0.5, -0.504083008264455409, -0.6, -0.9, -1.5, -2.25, -2.5, -10.5, -10.4,
        -100.3, -1000.5, -100000.25, -1.4570024900576, -2.4234036318227, -3.4317729856038,
        0, -1, -2, -100, Inf, -Inf, NaN)
ref_digamma <- function(x) if (is.finite(x) && (x > 0 || x != round(x))) digamma(Rmpfr::mpfr(x, 500)) else NA
write_fixture("digamma", data.frame(x = px), function(r) digamma(r$x), function(r) ref_digamma(r$x))
write_fixture("trigamma", data.frame(x = px), function(r) trigamma(r$x))
write_fixture("psigamma", grid_of(x = px, deriv = c(0, 1, 2, 3, 5, 10, 20, 50, 100)),
              function(r) psigamma(r$x, r$deriv))
