# Issue #380 log: interpolation where the ordinate difference overflows

GitHub Issue #380. Session 12, group A4 (small-number fallbacks).

## Plan

- Intent: three paths in `src/numerics/interp.ts` form y1 - y0 before dividing by a finite spacing: the two-knot branch of `fmmCoef` (fmm and natural with two knots), the secant `delta` of `evalHermite` (splinefunH, monoH.FC) and the divided differences of `hermiteInterp`. With y = (-1e308, 1e308) the difference overflows while the secant 1e308 is in range.
- Method: one helper `secant(y0, y1, h)`: dy / h as before, and only where dy overflows with finite y, 2 ((y1 / 2 - y0 / 2) / h). Halving values this large is exact and scaling the quotient by 2 is exact, so this is the exact secant rounded once (Infinity where it overflows). As in `linearAt` (approx), which already takes the halved difference.
- Values where the difference is finite are computed by the same expression (the same bits).

## Check (main after #364, `0bd99fa`)

| call | R 4.5.2 (with 2^1023) | before | after |
|---|---|---|---|
| `spline([0, 2], [-1e308, 1e308], xout 1)` | Inf | Infinity | 0 |
| `splinefun([0, 2], [-2^1023, 2^1023])(1)`, `(1, deriv 1)` | Inf, Inf | Infinity, Infinity | 0, 2^1023 |
| `splinefun(..., method "natural")(1)` | Inf | Infinity | 0 |
| `splinefunH([0, 2], [-2^1023, 2^1023], [0, 0])(1)`, `(1, deriv 1)` | 0, Inf | 0, Infinity | 0, 1.5 2^1023 |
| `hermiteInterp([0, 2], [-1e308, 1e308], [1e308, 1e308], [1])` | (not in R) | NaN | 0 |
| `splinefun([0, 1, 2], [-2^1023, 0, 2^1023])(0.5)` | -2^1022 | -2^1022 | the same |

## Fix

- `src/numerics/interp.ts`: `secant`, used by `fmmCoef` (two knots), `evalHermite` and `hermiteTable`.
- docs (en, ja): a row in the overflow table of differences-from-r.

## Tests

- `test/issue380.test.ts`: the calls above; unchanged values in range. With `src/` stashed the first test fails.
- `test/issue125.test.ts`, `issue216`, `issue98`, `jstat-replacement`, `numerics`, `review50`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `splinefun([0, 2], [-2^1023, 2^1023], method "monoH.FC")(1)` is still NaN (R NaN too): the Fritsch-Carlson slopes (`fritschCarlsonSlopes`) form the same difference. Not named in the issue.
- With three or more knots, the fmm, natural, periodic and hyman systems also take y[i+1] - y[i] / h; where neighbouring ordinates of opposite sign near the largest double overflow, the same happens. Not examined.

## close comment

Fixed in <commit of #380, see git log --grep='#380'>: where the difference of two finite ordinates overflows, the secant is now formed from the halved ordinates (2 ((y1 / 2 - y0 / 2) / h), the exact secant rounded once) in the two-knot fmm/natural spline, in the cubic Hermite evaluation (splinefunH, monoH.FC) and in the divided differences of hermiteInterp. `spline([0, 2], [-1e308, 1e308], { xout: [1] })` and `splinefun(...)([1])` are 0 (were Infinity, R Inf too, recorded in docs/differences-from-r.md), `splinefunH([0, 2], [-1e308, 1e308], [0, 0])([1], 1)` is 1.5e308, and `hermiteInterp([0, 2], [-1e308, 1e308], [1e308, 1e308], [1])` is 0 (was NaN). Where the difference is finite the values are unchanged. The monoH.FC slopes and the systems for three or more knots form the same difference and are recorded in the log, not changed. Test: test/issue380.test.ts. (Not pushed yet.)
