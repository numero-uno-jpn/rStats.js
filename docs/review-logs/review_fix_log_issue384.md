# Issue #384 log: sfTest with W above 1

GitHub Issue #384. Session 12, group A4 (small-number fallbacks).

## Plan

- Intent: `sfTest` forms W = cov(x, q)^2 / (var(x) var(q)) from three separately rounded moments. For data almost affine in the normal scores the quotient can exceed 1 by an ulp; log(1 - W) is then NaN and so is the p-value.
- Method: W = min(quotient, 1). W is a squared correlation, at most 1; R's `cor()` (which nortest's `sf.test` uses) also clamps to [-1, 1]. Quotients at or below 1 are unchanged (the same bits).
- The issue expected the p-value to reach "the limiting zero tail". That is wrong: with W = 1, log(1 - W) = -Inf and the upper tail of the normal approximation is 1, which is what R gives.

## Check (main after #394, `cfd70fd`)

x = (-1.598874458275358, -0.6738324234819416, 1.3552527156068805e-10, 0.6738324237529921, 1.5988744585464087), passed to R as the issue's hex floats.

| | R 4.5.2 (nortest) | before | after |
|---|---|---|---|
| W | 1 | 1.0000000000000002 | 1 |
| p | 1 | NaN | 1 |

## Fix

- `src/htest/normalityTests.ts`, `sfTest`: W at most 1. R gives the same values, so no docs entry.

## Tests

- `test/issue384.test.ts`: the issue's data (W 1, p 1). With `src/` stashed it fails.
- `test/issue304.test.ts`, `test/moreTests.test.ts`, `test/scaleInvarianceAll.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #384, see git log --grep='#384'>: `sfTest` now keeps W = cov^2 / (var var) at most 1 (a squared correlation; R's `cor()` clamps too), so the issue's data give W = 1 and p = 1, as nortest's `sf.test` in R 4.5.2 (W was 1.0000000000000002 and p NaN). Note that the p-value at W = 1 is 1, not 0: log(1 - W) is -Inf and the test takes the upper tail. Values with W below 1 are unchanged. Test: test/issue384.test.ts. (Not pushed yet.)
