# Issue #193 log: lm overflows finite responses on zero-weight rows when scaling active responses

GitHub Issue #193. Session 11, group A7 (lm).

## Plan

- Intent: `fitLm` scales the response by the 2^-k chosen from the rows of non-zero weight and fits in those units. A row of weight 0 is not in the fit, but its response (and its x'b) is scaled too, so a finite value there can overflow: `lm([[], []], [1e-308, 1e308], { weights: [1, 0] })` gave the residual Infinity instead of 1e308.
- Method: after the fit (scaled back, or not scaled), only for rows of weight 0 whose fitted value or residual is not finite, take them again in the units of the response: the fitted value is x'b from the coefficients (aliased ones count as 0), with the exact inner product `rescaledDot` (src/linalg/dot.ts) where the plain sum is not finite, as `predict` since #195; the residual is y minus the fitted value.
- Why this: the rows in the fit and the finite values of rows of weight 0 keep their bits (only non-finite values are recomputed). The x'b of a left-out row can also overflow in the scaled units (the coefficients carry 2^-k), so the fitted value is recomputed as well, not only the residual. The #195 log listed the plain sum of these rows (NaN where products overflow and cancel) as out of scope; it is the same code, so the same fallback as `predict` is used here (the brief allows it where it overlaps). A NaN or infinite x or y of a row of weight 0 still gives the non-finite value it gave.

## Check (main `0e41a47`)

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| `lm([[], []], [1e-308, 1e308], { weights: [1, 0] })` residuals (also the formula `y ~ 1`) | 0, 1e308 | 0, Infinity | 0, 1e308 |
| `lm([1, 2, 1e300], [1e-308, 2e-308, 5], { weights: [1, 1, 0] })` row 3 | fitted 1e-8, residual 5 - 1e-8 | 1e-8, Infinity | 1e-8, 5 - 1e-8 |
| `lm([1e-300, 2e-300, 1e10], [1e-300, 2e-300, 5], { weights: [1, 1, 0], intercept: false })` row 3 | 1e10, -1e10 | Infinity, Infinity | 1e10 b (b = 0.9999999999999997), 5 - 1e10 b |
| `lm([[1, 0], [0, 1], [1, 1], [1e308, 1e308]], [1.9, -1.9, 0, 0], { weights: [1, 1, 1, 0], intercept: false })` row 4 | NaN, NaN (coefficients 1.9 and -(1.9 + 3 ulp), the same as rStats.js) | NaN, NaN | -6.661338147750939e292 and its negation, = `predict` of the fit without row 4 (exactly 1e308 * -3 * 2^-52) |

The formula form of the last example has double-double coefficients exactly 1.9 and -1.9, and its row 4 was NaN before (the double-double sum of the overflowing products) and is now 0 through the fallback. The R difference of the last row is recorded in docs/differences-from-r.md and docs/ja.

## Fix

- `src/models/lm.ts`: `zeroWeightRows` (called by `fitLm` after the fit in both branches) recomputes the fitted value and residual of a row of weight 0 when the fitted value is not finite, and the residual alone when only it is not finite.

## Tests

- `test/issue193.test.ts`: the issue's example (matrix and formula), the slope example, the overflowing x'b in scaled units, the cancelling products (equal to `predict`), and unchanged values for the rows in the fit and for non-finite rows of weight 0. With `src/` stashed three of the four tests fail.
- `npx vitest run`: 323 files passed (2723 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The formula form with a column near 1e-300 in the fit (`lm("y ~ 0 + x", { x: [1e-300, 2e-300, 1e10], y: [1e-300, 2e-300, 5], w: [1, 1, 0] }, { weights: "w" })`) gives NaN coefficients: the double-double refit (`ddLeastSquares`) underflows on such a column. Not changed (the rows in the fit, not the issue's rows of weight 0).

## close comment

Fixed in <commit of #193, see git log --grep='#193'>: the fitted values and residuals of rows of weight 0 that are not finite in the scaled units of the fit are now taken again in the units of the response. `lm([[], []], [1e-308, 1e308], { weights: [1, 0] }).residuals` is now `[0, 1e308]` (the second was Infinity), as in R, also in the formula form. The fitted value x'b of such a row is recomputed too (it could overflow in the scaled units: a row with x = 1e10 gave Infinity, now 1e10 times the coefficient), and where its products overflow and cancel it takes the exact inner product, as `predict` does since #195 (R gives NaN there; recorded in docs/differences-from-r.md). Rows in the fit and finite values keep their bits.

Test: test/issue193.test.ts. (Not pushed yet.)
