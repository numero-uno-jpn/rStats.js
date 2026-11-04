# Issue #473 log: mean losing a third band of magnitudes

GitHub Issue #473. Session 13, group A5. Picked up from the Out of scope of `review_fix_log_issue374.md`.

## Plan

- Intent: `meanDD` (behind `mean` and every statistic that centres by the mean) accumulates with the two-component `wideSumAdd`, so a value in a third band far below the others is rounded away and lost when the larger bands cancel, as `sum` before #374.
- Method: the #374 approach (user decision there, option A), extended to the mean. The loop of `sum` becomes `boundedSum` (same operations, same bits as `wideSumAdd`, plus the bound `lost`), shared by `sum` and `meanDD`. `meanDD` keeps its value (s / n corrected by the deviations, or the scaled recursion where the sum overflows) and checks it: the true mean is within lost (1 + n 2^-52) / n of s / n, and the result within abs(result - s / n) of that; only where this interval could reach a rounding boundary of the result is the mean formed exactly (BigInt sum, quotient by n with 128 extra bits and a sticky bit, rounded once for the high and once for the low part). The plain-double mode (`setDoubleDouble(false)`) keeps the old loop.
- R differs (its long double loses the band too), so docs (en, ja) get a `mean` item in the "Sums" subsection.

## Reproduction (main `6d4b65a`, R 4.5.2; doubles passed to R as hex floats)

| call | before | after | R | exact |
|---|---|---|---|---|
| `mean([1e308, 1e100, 1, -1e308, -1e100])` | 0 | 0.2 | -2.2e99 (-0x1.a559d2be075aap+330) | 0.2 |
| `mean([1e308, 1e308, 1e100, 1, -1e308, -1e308, -1e100])` | 0 | 1/7 | | 1/7 |
| `mean([1e20, 1e3, 1e-10, -1e20, -1e3])` | 2.000888343900442e-11 | 2.0000000000000002e-11 | -360 | 1e-10 / 5 |
| `mean([1e30, 1e3, 1e-10, -1e30, -1e3])` | 2.000888343900442e-11 | 2.0000000000000002e-11 | | 1e-10 / 5 |

The exact values (and the low parts of `meanDD`, -1.1102230246251566e-17 and -1.2924697071141058e-27) were checked with Python `fractions` on the doubles. The issue's "R gives 0.2" is not what R 4.5.2 returns.

## Cause

`src/internal/summary.ts` `meanDD`: `wideSumAdd` without the loss bound of `sum`; the correction pass over the deviations is double-double too and loses the same band.

## Fix

- `src/internal/summary.ts`: `boundedSum` (the loop of `sum`, moved), `meanDD` with `scaledMean`, `meanFromSum` (the old body), `mayMissMean` (the check above, in units of 2^shift; always exact where the overflow path's mean is below 2^-1000 there) and `exactMean`.
- Bits: the whole suite passes with no fixture change (514 files). Time for 1e6 values: 37-48 ms after, 44-57 ms before (the inlined loop of #374).

## Tests

- `test/issue473.test.ts`: the cases above (values and low parts) and ordinary means. With `src/` stashed the first test fails.
- `npx vitest run` (all): pass except a timing check of `distributionProperties` (signrank), which passes alone. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `cumsum` still uses `wideSumAdd` without the bound (as recorded in #374).
- Where the check does not trigger, the low part of `meanDD` may still be off by up to the bound (far below half an ulp of the high part), as before.

## close comment

Fixed in <commit of #473, see git log --grep='#473'>: `mean` now carries the loss bound of `sum` (#374): where what its double-double lost could change the rounded mean, the mean is formed from the exact sum (BigInt) and rounded once. `mean([1e308, 1e100, 1, -1e308, -1e100])` is 0.2 (was 0) and `mean([1e20, 1e3, 1e-10, -1e20, -1e3])` 2.0000000000000002e-11 (was 2.0009e-11). Note that R 4.5.2 does not give 0.2: its long double loses the same band and returns -2.2e99 (and -360 for the second), so this is recorded under "Sums" in docs/differences-from-r.md. Other means are unchanged (the whole test suite and its fixtures keep their bits). Test: test/issue473.test.ts. (Not pushed yet.)
