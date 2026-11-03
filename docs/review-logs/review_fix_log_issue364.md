# Issue #364 log: weightedMean losing products that underflow

GitHub Issue #364. Session 12, group A4 (small-number fallbacks).

## Plan

- Intent: `weightedMean` forms each product x w in double. A product of nonzero factors can underflow to 0 (or lose bits as a subnormal) while the quotient is in range; the plain quotient is then finite and the fallback is not reached. `weightedMean([1e-200], [1e-200])` was 0, while the mean of one value is that value.
- Method: flag a product of a nonzero value and a nonzero weight whose absolute value is below 2^-1022 (zero or subnormal), and send such inputs to the exact fallback of #334 (both sums exact in BigInt, the quotient rounded once). Products in the normal range do not set the flag, so their results keep their bits.

## Check (main after #334, `7979418`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `weightedMean([1e-200], [1e-200])` (R with 2^-664) | 0 | 0 | 1e-200 |
| `weightedMean([2^-700, 3 2^-700], [2^-700, 2^-700])` | | 0 | 2^-699 |
| `weightedMean([1, 2^-500], [2^-1050, 2^-600])` | | 2^-450 | 2^-450 + 2^-500 (the exact quotient rounded) |

## Fix

- `src/descriptive/basic.ts`: the flag in the products loop; the fallback condition includes it.
- docs (en, ja): the weighted.mean row of differences-from-r gains the underflowing product.

## Tests

- `test/issue364.test.ts`: the issue's call and products below the normal range; unchanged values in range. With `src/` stashed the first test fails.
- `test/issue334.test.ts`, `test/issue201.test.ts`, `test/descriptive.test.ts` (with the weightedMean fixture): pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #364, see git log --grep='#364'>: where a product of a nonzero value and a nonzero weight falls below the normal range (0 or subnormal), `weightedMean` now uses the exact fallback of #334 (both sums exact, the quotient rounded once), so `weightedMean([1e-200], [1e-200])` is 1e-200 (was 0; R also gives 0, recorded in docs/differences-from-r.md). Products in the normal range do not reach this path, so those values are unchanged. Test: test/issue364.test.ts. (Not pushed yet.)
