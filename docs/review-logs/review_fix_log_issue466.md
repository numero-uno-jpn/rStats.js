# Issue #466 log: splinefunH's second derivative where the secant overflows

GitHub Issue #466. Session 13, group A (#463, #465, #466).

## Plan

- Intent: the second-derivative branch of `evalHermite` forms the secant delta = (y1 - y0) / h before the basis factor 6 - 12 t. With y1 - y0 = 1e200, h = 1e-200 and t = 1/2 the secant overflows and the result is Inf * 0 = NaN, although the second derivative is 0. Recorded as out of scope in the #401 log.
- Method (fallback only, as #401 for the first derivative): where delta is not finite for finite ordinates, the secant term is (y1 - y0) (6 - 12 t) / h^2 by `scaledProduct`, in the original units (2^-2k), with the halved ordinates when y1 - y0 itself overflows. The slope terms are as before. Where delta is finite, the same expression as before (the same bits).

## Check (main `15b01bd`, R 4.5.2)

| call | R | before | after | exact |
|---|---|---|---|---|
| `splinefunH([0, 1e-200], [0, 1e200], [0, 0])(5e-201, 2)` | NaN | NaN | 0 | 0 |
| `splinefunH([0, 1], [-1.5e308, 1.5e308], [0, 0])([0.5 - 2^-10, 0.5], 2)` | Inf, NaN | Infinity, NaN | 3.515625e306, 0 | 3e308 x 12 2^-10 = 3.515625e306, 0 |
| `splinefunH([0, 3], [1, 2], [0.5, 0.25])([1, 1.5], 2)` | -0x1.c71c71c71c71dp-4, -0x1.5555555555555p-4 | -0.11111111111111112, -0.08333333333333333 | the same | |

## Fix

- `src/numerics/interp.ts`, `evalHermite`, case 2: the fallback above.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row after the #401 row.

## Tests

- `test/issue466.test.ts`: the first two rows (fail with `src/` stashed) and the ordinary values.
- The 9 test files that use `splinefunH`, `splinefun` or `monoH` (32 tests) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- Where delta is finite but the slope terms over h overflow (slopes 1e300 over h = 1e-200), the result is -Infinity; the true value (-2e500) is out of range too.

## close comment

Fixed in <commit of #466, see git log --grep='#466'>. As for the first derivative in #401, where the secant overflows for finite ordinates the second derivative of `splinefunH` now forms (y1 - y0) (6 - 12 t) / h^2 with the exponents apart: `splinefunH([0, 1e-200], [0, 1e200], [0, 0])([5e-201], 2)` gives [0] instead of [NaN] (R 4.5.2 also gives NaN; recorded in docs/differences-from-r.md), and `splinefunH([0, 1], [-1.5e308, 1.5e308], [0, 0])([0.5 - 2 ** -10], 2)` gives 3.515625e306 (R: Inf). Where the secant is finite the values are unchanged. A test has been added. (Not pushed yet.)
