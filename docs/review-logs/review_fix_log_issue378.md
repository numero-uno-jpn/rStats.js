# Issue #378 log: distSummary("nbinom") variance with prob squared underflowing

GitHub Issue #378. Session 12, group A3 (distSummary).

## Plan

- Intent: the nbinom variance is size q / (p * p). For size 1e-300, prob 1e-200 the square underflows to 0 and the variance is Infinity, although it is 1e100 and the sd (from sdDirect) is finite.
- Method: the receptacle of #376. Where the variance is not a normal number, `rescaled()` evaluates (x q) / (y y) at size and p scaled to [1, 2) (q unscaled, it is in [0, 1)) and multiplies back by 2^(e_size - 2 e_p). Normal values keep their bits.

## Check (main `c89555a`)

| call | before | after | Rmpfr (2000 bits) |
|---|---|---|---|
| `nbinom(size 1e-300, prob 1e-200)` variance | Infinity | 0x1.249ad2594c37dp+332 (1e100) | the same |
| sd | 1e50 (sdDirect) | 1e50 within 1 ulp (sqrt of the variance) | 1.00000000000000003e50 |
| `nbinom(size 1, prob 1e-200)` variance | Infinity | Infinity | 1e400, overflows |

## Fix

- `src/distributions/summary.ts`, `case "nbinom"`: the variance of the general path through `rescaled()` (the mu path for mu / size < 2^-26 is separate and unchanged).

## Tests

- `test/issue378.test.ts`: the issue's call (fails with `src/` stashed) and unchanged values.
- The distSummary test files, `test/nbinom.test.ts` and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #378, see git log --grep='#378'>. Where the nbinom variance leaves the normal range, it is now size q / p^2 evaluated at size and prob scaled to [1, 2) by powers of 2 and scaled back, so p^2 no longer underflows: size 1e-300, prob 1e-200 has variance 1e100 (0x1.249ad2594c37dp+332, correctly rounded). Values in the normal range are unchanged. (Not pushed yet.)
