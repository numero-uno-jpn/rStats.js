# Issue #400 log: the value of splinefunH where h m overflows

GitHub Issue #400. Session 13, group 5b (evalHermite).

## Plan

- Intent: the value branch of `evalHermite` forms `ldexp(h * m_i, k - e)` before the basis factor t (t - 1)^2 or t^2 (t - 1). With h = m = 1e200 and t = 1e-100 the products overflow and the two terms give Inf - Inf, although the value is 1e300.
- Method (fallback only): a term that is not finite with finite m and basis is formed by a new helper `scaledProduct` (each factor as m 2^f, the exponents summed, one `ldexpWide` at the end). Finite terms are the same expression as before (the same bits).

## Check (main after #399, R 4.5.2)

| call | R | before | after | exact |
|---|---|---|---|---|
| `splinefunH([0, 1e200], [0, 0], [1e200, 1e200])(1e100)` | NaN | NaN | 1e300 | 1e300 (nearest double) |
| the same at 0 (the first knot, basis 0) | | NaN | 0 | 0 |
| `splinefunH([0, 3], [1, 2], [0.5, 0.25])(1)` | | 1.4259259259259258 | the same | the same (nearest) |

The exact values are those of the Hermite cubic of the given doubles in BigInt rationals (scratch script).

## Fix

- `src/numerics/interp.ts`: `scaledProduct` (also used by #401) and the value branch of `evalHermite`.
- docs (en, ja): a row in the overflow table.

## Tests

- `test/issue400.test.ts`: the rows above and one more ordinary value. With `src/` stashed the first test fails.
- `issue399`, `issue125`, `issue380`, `numerics`, `jstat-replacement`: pass. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #400, see git log --grep='#400'>: in the value branch of `evalHermite` (splinefunH, monoH.FC), a term whose h m overflows before the basis factor is now formed with the exponents of h, m and the basis factor kept apart. `splinefunH([0, 1e200], [0, 0], [1e200, 1e200])([1e100])` is 1e300 (was NaN, R NaN too; recorded in docs/differences-from-r.md), and the value at the first knot is 0 (was NaN). Finite terms are computed as before, so ordinary values are unchanged. Test: test/issue400.test.ts. (Not pushed yet.)
