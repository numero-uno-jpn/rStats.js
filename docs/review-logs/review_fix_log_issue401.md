# Issue #401 log: the first derivative of splinefunH where the secant overflows

GitHub Issue #401. Session 13, group 5b (evalHermite).

## Plan

- Intent: the first-derivative branch of `evalHermite` forms the secant delta = (y1 - y0) / h before the basis factor -6 t (t - 1). With y1 - y0 = 1e200, h = 1e-200 and t = 1e-100 the secant overflows and the result is Inf, although the derivative is 6e300.
- Method (fallback only): where delta is not finite for finite ordinates, the secant term is (y1 - y0) times the factor over h by `scaledProduct` (#400), in the original units (2^-k), with the halved ordinates when y1 - y0 itself overflows (as `secant`). The slope terms are as before. Where delta is finite, the same expression as before (the same bits).

## Check (main after #400, R 4.5.2)

| call | R | before | after | exact |
|---|---|---|---|---|
| `splinefunH([0, 1e-200], [0, 1e200], [0, 0])(1e-300, 1)` | Inf | Infinity | 6e300 | 6e300 (nearest double) |
| `splinefunH([0, 2^-100], [-2^1023, 2^1023], [0, 0])(2^-300, 1)` | | Infinity | 6 2^924 | 6 2^924 in doubles |
| `splinefunH([0, 3], [1, 2], [0.5, 0.25])(1, 1)` | | 0.36111111111111116 | the same | 0.3611111111111111 (1 ulp, unchanged) |

The exact values are those of the Hermite cubic of the given doubles in BigInt rationals (scratch script).

## Fix

- `src/numerics/interp.ts` `evalHermite`, deriv 1.
- docs (en, ja): a row in the overflow table.

## Tests

- `test/issue401.test.ts`: the rows above and one more ordinary value. With `src/` stashed the first test fails.
- `issue399`, `issue400`, `issue125`, `issue380`, `numerics`, `jstat-replacement`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The second derivative forms delta (6 - 12 t) / h the same way; where delta overflows and 6 - 12 t is small (t near 1/2) a finite value can be lost. Not named in the issues; not examined.

## close comment

Fixed in <commit of #401, see git log --grep='#401'>: in the first-derivative branch of `evalHermite` (splinefunH, monoH.FC), where the secant is not finite for finite ordinates, the secant term is now formed as the ordinate difference times the basis factor over h with the exponents apart. `splinefunH([0, 1e-200], [0, 1e200], [0, 0])([1e-300], 1)` is 6e300 (was Infinity, R Inf too; recorded in docs/differences-from-r.md). Where the secant is finite the values are unchanged. Test: test/issue401.test.ts. (Not pushed yet.)
