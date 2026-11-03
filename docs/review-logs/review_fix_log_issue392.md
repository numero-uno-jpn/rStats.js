# Issue #392 log: icc two-way MSE lost to cancellation

GitHub Issue #392. Session 12, group B (user decision 14).

## Plan

- Intent: the two-way MSE is (ssTotal - msr (n - 1) - msc (k - 1)) / ((n - 1)(k - 1)). With subject and rater effects of 1e8 and an interaction of ±1 the subtraction cancels to 0: ICC 1, F Infinity, bounds NaN (agreement: df2 and p NaN).
- User decision (2026-11-03): only where the subtraction is below 2^-20 of ssTotal (0 or less included), form the residual sum of squares directly, sum (x - row mean - column mean + grand mean)^2 in double-double. Elsewhere the same bits.
- Why not always direct: 21 of the 30 two-way fixture values would change (within tolerance) and fewer would match R bit for bit; the threshold kept the sweep of the prep (43 cases, effects 10^1 to 10^14) within 1.1e-14 in F. Why not only at 0 or less: 18 of those cases stayed off by more than 1e-12.

## Reproduction (main `ad07b94`, R 4.5.2 with irr)

| call (issue's 3 x 3, twoway) | before | irr | exact | after |
|---|---|---|---|---|
| consistency, single | value 1, F Inf, p 0, bounds NaN | 1, Inf, 0, NaN, NaN | MSE 3/2, msr 3e16: F 2e16, value 0.9999999999999999 | value 0.9999999999999999, F 2e16, p 1e-32, lbound 0.9999999999999984, ubound 1 |
| agreement, single | value 0.2, F Inf, df2 NaN, p NaN | | | value 0.2, F 2e16, df2 4, p 1e-32 |

## Fix

- `src/htest/agreement.ts` (`icc`): the threshold test on the subtraction and `residualSumOfSquares` (double-double row, column and grand means, residuals and squares). The ratings are already scaled to the unit by a power of 2, so the squares stay in range.
- docs (en, ja): a row in "Where R is inaccurate".

## Tests

- `test/issue392.test.ts`: consistency (F 2e16, value 0.9999999999999999, finite bound, p > 0) and agreement (F, finite df2). With `src/` stashed, both fail.
- `test/agreement.test.ts` (irr fixtures), `test/scaleInvarianceAll.test.ts`: pass (the fallback does not apply to them).

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #392, see git log --grep='#392'>: where the two-way residual sum of squares obtained by subtraction (total minus subject minus rater) falls below 2^-20 of the total sum of squares, `icc` now forms it directly from the residuals x - row mean - column mean + grand mean in double-double. The issue's example (effects of 1e8, interaction ±1) gave ICC 1 and F Infinity with NaN bounds (irr gives the same); it now gives the exact MSE 3/2, F 2e16 and ICC 0.9999999999999999, and the agreement type gets finite degrees of freedom. Other data keep the same bits (the irr fixtures are unchanged). Recorded in docs/differences-from-r.md.

Test: test/issue392.test.ts. (Not pushed yet.)
