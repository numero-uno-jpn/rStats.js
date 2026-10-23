source("/oracle/_common.R")

# besselI, besselK, besselJ, besselY (R's base).
# Not yet run: written without R at hand, together with the mpmath reference fixtures
# (scripts/mpmath/bessel.py). The tests compare with these R fixtures once they exist.

bx <- c(0, 1e-300, 1e-10, 1e-3, 0.1, 0.5, 1, 1.5, 2, 2.5, 3, 5, 7.5, 10, 20, 30, 50, 75, 100, 200, 500,
        1000, 1e4, 1e5, 1e6, Inf, -1, NaN)
bnu <- c(0, 0.25, 0.5, 1, 1.5, 2, 2.75, 5, 10, 20, 50, 100, 500, 1000,
         -0.25, -0.5, -1, -1.5, -2.75, -5, -10.5, -50.3, NaN)
gik <- grid_of(x = bx, nu = bnu, exponScaled = c(FALSE, TRUE))
write_fixture("besselI", gik, function(r) besselI(r$x, r$nu, expon.scaled = r$exponScaled))
write_fixture("besselK", gik, function(r) besselK(r$x, r$nu, expon.scaled = r$exponScaled))
gjy <- grid_of(x = bx, nu = bnu)
write_fixture("besselJ", gjy, function(r) besselJ(r$x, r$nu))
write_fixture("besselY", gjy, function(r) besselY(r$x, r$nu))
