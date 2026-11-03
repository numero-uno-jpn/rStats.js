# Issue #195 log: predict(lm) is NaN where the products of the linear predictor overflow and cancel

GitHub Issue #195. Session 11, group B1 (user decision: an exact inner product for #195 and #208).

## Plan

- Intent: the matrix form of `predict` for lm sums x_j b_j left to right. With finite new data and coefficients, the products can overflow (2 * 1e308) and cancel, so the prediction is NaN although x'b is in range.
- Method (the user's decision, option (b) of the preparation): only where the plain sum is not finite, take x'b again with the exact inner product of `src/linalg/dot.ts` (`rescaledDot`, made exact for #208) over the coefficients that are not NaN (aliased coefficients count as 0, as in the plain sum).
- Why this: the same fallback as `matMul`, `crossprod` and `tcrossprod`; the plain sum is kept wherever it is finite (the same bits, as R), and inside the fallback the value is the correctly rounded exact x'b. A NaN or infinite entry keeps the plain sum (NaN or Inf).
- R gives NaN (R 4.5.2), so the new value is recorded in docs/differences-from-r.md and docs/ja.

## Check (main `ef0a5bb`)

| call | R 4.5.2 | Before | After | True value (Rmpfr) |
|---|---|---|---|---|
| coefficients of `lm([[1, 0], [0, 1], [1, 1]], [2, -2, 0], { intercept: false })` | `0x1.0000000000001p+1`, `-0x1.0000000000002p+1` | the same bits | (unchanged) | |
| `predict(fit, [[1e308, 1e308]]).fit` | NaN | NaN | -4.440892098500626e292 (`-0x1.1ccf385ebc8ap+972`) | -0x1.1ccf385ebc8ap+972 (for the double 1e308 and these coefficients) |
| `predict(fit, [[1e300, 1e300]]).fit` (plain sum finite) | | -5.948067633911132e284 | the same bits | -4.4409e284 (the plain sum keeps the rounding of the products, as R) |
| a NaN or infinite entry in the row | NaN | NaN | NaN (unchanged) | |

The issue expects 0, but the least-squares coefficients are not exactly ±2 (one and two ulps away, in R too), so the exact linear predictor is 1e308 (b1 + b2) = 1e308 * -2^-51 = -4.44e292, not 0. The standard error (3.6e292) and the intervals were finite before and are unchanged (R gives se Inf).

## Fix

- `src/models/lm.ts` (`predict`): the value of a row whose plain sum is not finite is `rescaledDot` of the row and the coefficients restricted to the columns whose coefficient is not NaN.

## Tests

- `test/issue195.test.ts`: the issue's prediction (also with `interval: "confidence"`), the coefficients' bits, and unchanged values where the plain sum is finite or the row has NaN or Inf. With `src/` stashed the first test fails.
- `npx vitest run`: 321 files passed (2715 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The same plain sum of x'b is in `fitLm` for the fitted values of rows of weight 0 (`src/models/lm.ts`, the `fv` of the rows not in the fit) and in `glmPredict` (`src/models/glm.ts`, `eta` from newdata). They can also be NaN where products overflow and cancel; not changed here (the issue and the decision cover `predict` for lm).

## close comment

Fixed in <commit of #195, see git log --grep='#195'>: where the plain sum of a row's linear predictor is not finite, `predict` for lm now takes x'b again with the exact inner product that `matMul` uses (#208): each product as an integer times a power of 2, summed exactly and rounded once. For the issue's fit, `predict(fit, [[1e308, 1e308]]).fit` is now -4.440892098500626e292 (it was NaN, as in R). It is not 0 because the least-squares coefficients are 2 + 1 ulp and -(2 + 2 ulp) (in R too); -4.440892098500626e292 is the exact value for these coefficients (Rmpfr agrees to the bit). Rows whose plain sum is finite keep their values, and a NaN or infinite entry still gives NaN. Recorded in docs/differences-from-r.md.

Test: test/issue195.test.ts. (Not pushed yet.)
