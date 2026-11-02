# Issue #125 log: splinefun and splinefunH where the range of the knots overflows

GitHub Issue #125. Prepared overnight (decisions_linalg_misc.md, Q2); on the morning of 2026-11-03 the user chose option A (every splinefun method and splinefunH, rescaled only where the range of the knots overflows). The plan was approved.

## Plan

- Intent: `splinefun` (fmm, natural, periodic, hyman, monoH.FC) and `splinefunH` take differences of the knots directly. With finite knots whose difference overflows (x from -1e308 to 1e308), the slopes are 0 or NaN and the interpolant is wrong. `spline` was fixed in review 50 by building the spline in x / 2^k.
- Method: one helper, `knotScale`, gives k = floor(log2(max abs(x))) when the sorted knots are finite and x_max - x_min overflows, and 0 otherwise. The condition is the range rather than neighbouring spacings, since the periodic method forms the period x_n - x_1 (finite spacings, overflowing period). `spline` now uses the same helper, so it takes the same condition.
  - Cubic methods (fmm, natural, periodic, hyman): built in x / 2^k, evaluated at u / 2^k; a derivative of order d is multiplied by 2^(-d k). Both scalings are exact for normal numbers.
  - Hermite (monoH.FC, splinefunH): `evalHermite` takes the knots divided by 2^k and slopes in units of 2^-e. splinefunH keeps the given slopes (e = 0): multiplying them by 2^k would overflow for abs(m) above about 2. monoH.FC computes its Fritsch-Carlson slopes in the divided coordinate (e = k), so they are neither multiplied nor divided. h m is formed as ldexp(h_s m_s, k - e), the secant as ldexp(dy / h_s, e - k), and the derivatives are scaled back by ldexp. With k = e = 0 every expression is the old one (ldexp(v, 0) is v).
- Why: user decision (option A). It makes splinefun and splinefunH agree with spline. Only inputs whose knot range overflows take the new path, so ordinary inputs keep their bits.

## Check (main `a82962b`, R 4.5.2)

| Call | R 4.5.2 | Before | After | True |
|---|---|---|---|---|
| `splinefun(c(-1e308, 1e308), c(0, 1))(0)`, fmm and natural | 0 | 0 | 0.5 | 0.5 |
| same, hyman | NaN | 0 | 0.5000000000000001 | 0.5 |
| same, monoH.FC | NaN | NaN | 0.5 | 0.5 |
| first derivative of the above | 0 or NaN | 0 | 5e-309 | 1/2e308 = 5e-309 |
| `splinefun(c(-1.5e308, 0, 1.5e308), c(0, 1, 0), method = "periodic")` at 0, -7.5e307 | 0, 0 | NaN | 1, 0.5 | |
| `spline(...)` with the same periodic data | — | NaN | 1, 0.5, 0.5 | |
| `splinefunH(c(-1e308, 1e308), c(0, 1), c(0, 0))(0)` | NaN | NaN | 0.5 | 0.5 |
| `splinefunH(c(-1e308, 1e308), c(0, 1), c(10, -3))`, derivative 1 at 0 | — | 10 | -1.75 | -1.75 |
| fmm, natural, hyman, monoH.FC on (-1.5e308, -5e307, 5e307, 1.5e308), (0, 1, 2, 3) at 0, 1e308 | — | 1.5, 2.5 (monoH.FC slope 1.0000000000000004e-308) | 1.5, 2.5, slope 1e-308 | linear |

- hyman's 0.5000000000000001 is the rounding of the Hermite rebuild (c and d) at the divided knots +-2.2250738585072014: hyman on those knots at the ordinary scale gives the same (R gives 0.4999999999999999 there).
- Ordinary inputs unchanged: a sweep (scratchpad `s125.ts`) of 400 random data sets (2 to 9 knots, scales 2^-1000 to 2^1000, queries inside and outside), every splinefun method with derivatives 0 to 3, spline for the four cubic methods and splinefunH with derivatives 0 to 3: 10222 lines of output, identical before and after.
- R returns 0, NaN or wrong values here, so the new values differ from R. Recorded in docs/differences-from-r.md (and docs/ja).

## Fix

- `src/numerics/interp.ts`: `knotScale`; `spline` uses it; `splinefun` builds the cubic methods and monoH.FC in x / 2^k when it is nonzero; `evalHermite` takes the scale k and the slope units e; `splinefunH` divides the knots by 2^k and keeps the slopes.
- docs (English and Japanese): a row in the table of overflowing differences.

## Tests

- `test/issue125.test.ts`: the issue's examples for every method with derivatives 0 to 3, periodic with an overflowing period (splinefun and spline), four knots whose outer differences overflow, splinefunH with zero slopes and with slopes beyond 2 (the value overflows as the true value does; derivatives finite), and ordinary inputs. With src stashed, 4 of the 5 tests fail.
- Whole suite `npx vitest run`: 273 files, 2564 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## Recorded as out of scope

- In the divided coordinate the cubic methods and monoH.FC form slopes dy / (dx / 2^k). If a data set's knot range overflows and one interval also has a slope above about 2 in the original units (for example x = (-1e308, 0, 1, 1e308), y = (0, 0, 10, 10)), that slope overflows and the spline is not finite. Before the fix the same input was already wrong because the range overflowed. spline (review 50) has the same limit.
- The value of splinefunH is still Infinity when h m itself overflows (slopes of 10 across 2e308). Here the true value overflows too.

## close comment

Fixed in <commit of #125, see git log --grep='#125'>: splinefun (all of fmm, natural, periodic, hyman and monoH.FC) and splinefunH now detect knots whose range x_max - x_min overflows (all finite), as spline has done since review 50. They are then built in x / 2^k with k the exponent of the largest knot and evaluated at u / 2^k, and a derivative of order d is scaled back by 2^(-d k), all exactly. splinefunH keeps the given slopes in their own units, so slopes beyond 2 do not overflow from the rescaling. splinefun(c(-1e308, 1e308), c(0, 1))(0) is now 0.5 for every method (was 0 or NaN; R gives 0 or NaN), its first derivative 5e-309, and splinefunH(c(-1e308, 1e308), c(0, 1), c(0, 0))(0) 0.5 (was NaN, as in R). The condition is the range rather than neighbouring spacings because the periodic method forms the period: splinefun(c(-1.5e308, 0, 1.5e308), c(0, 1, 0), method = "periodic") now gives 1 at 0 and 0.5 at -7.5e307 (was NaN; R gives 0), and spline uses the same condition. Ordinary inputs do not take this path: in a sweep of 400 data sets over every method and derivative order the output is bit-identical. Recorded in docs/differences-from-r.md. Test: test/issue125.test.ts. Recorded for later: in the divided coordinate a slope above about 2 in the original units still overflows when the range overflows (spline has the same limit). (Not pushed yet.)
