# Issue #194 log: lm drops positive-weight rows when common weight scaling underflows before the square root

GitHub Issue #194. Session 11, group A7 (lm).

## Plan

- Intent: the formula form refits the kept columns in double-double (`preciseFit`) with the weights divided by 2^kw (kw even, the largest weight then in [1, 4)). The division came before the square root, so with weights 1e308 and 1e-308, 1e-308 * 2^-1022 underflowed to 0: the row was left out and its column became NaN (the double-precision QR, on sqrt(w) unscaled, still said rank 2).
- Method: (1) where w 2^-kw is below the normal range (and w > 0), take sqrt(w) in double-double and multiply both parts by 2^(-kw/2); elsewhere the square root of w 2^-kw as before. (2) The scaled square root can itself be just below the normal range (1e-154 * 2^-511 = 1.5e-308), and the Householder steps in double-double square the column, so its norm underflowed to 0 as well. A column of sqrt(w) x whose largest entry is outside [2^-256, 2^256] (`rangeExponent`, the bound used for the decompositions) is divided by its power of 2 before the decomposition, and its coefficient divided back. Q'y does not change with a column's scale, so the effects, residuals and sums of squares are those of the unscaled problem.
- Why this: both steps are exact powers of 2 and are taken only outside the ranges where the old computation was exact, so every fit whose weights and columns were in range keeps its bits (the whole suite, with its R fixtures, is unchanged). The double-precision QR (rank, pivoting, the matrix form) already used sqrt(w) unscaled and is not touched.

## Check (main `bc39a38`)

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| `lm("y ~ 0 + a + b", { y: [1, 2], a: [1, 0], b: [0, 1], w: [1e308, 1e-308] }, { weights: "w" })` coefficients, rank | 1, 2; rank 2 | NaN, NaN; rank 2 | 1, 2; rank 2 (fitted 1, 2, residuals 0, 0, effects ±1e154, ±2e-154) |
| the same in the matrix form | | 1, 2 | 1, 2 (unchanged) |
| weights (1, 1, 1e-16, 3e-16), `y ~ 0 + a + b` with a = (1, 1, 0, 0), b = (0, 0, 1, 1), y = (1, 1.5, 2, 3) | 1.25, 2.75 | 1.25, 2.75 | the same bits (coefficients, standard errors, sigma, effects) |

R gives the issue's values, so nothing is recorded in docs/differences-from-r.md.

## Fix

- `src/models/lm.ts` (`preciseFit`): it takes the given weights and kw; the square roots as above; the columns outside [2^-256, 2^256] scaled by their power of 2 and the coefficients scaled back.

## Tests

- `test/issue194.test.ts`: the issue's fit (coefficients, rank, fitted values, residuals, effects; the matrix form), and a fit with weights within range whose bits are unchanged. With `src/` stashed the first test fails.
- `npx vitest run`: 324 files passed (2725 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Weights so far apart that the residual of the heavy rows swamps the light rows in a Householder step are not fitted correctly, before and after this change, in R too. With y = (1, 1.5, 2, 3), a = (1, 1, 0, 0), b = (0, 0, 1, 1) and weights (10^e, 10^e, 10^-e, 3 * 10^-e), the true coefficients are 1.25 and 2.75 for every e. The coefficient of b in the matrix form (and in R) is 0 from e = 20; in the formula form it is 0 at e = 50 and -1.44e67 at e = 100 (before this change too), and at e = 308 it was NaN before and is -1.7e276 now (R -0). The reflection of the second column has its pivot in a heavy row (the column's entry there is 0), and the light rows' contribution, about 10^-2e of the heavy residual, is lost in the cancellation. Row pivoting (Powell and Reid) or ordering the rows by weight would be needed; this is a separate limitation of the decomposition, not the underflow of the issue.

## close comment

Fixed in <commit of #194, see git log --grep='#194'>: the double-double refit of the formula form now takes the square root of a weight before the common power-of-2 scaling wherever the scaled weight would fall below the normal range, and divides a column whose entries are far from 1 by its power of 2 before the decomposition (its coefficient divided back; Q'y does not change). `lm("y ~ 0 + a + b", { y: [1, 2], a: [1, 0], b: [0, 1], w: [1e308, 1e-308] }, { weights: "w" })` now gives the coefficients `[1, 2]` with rank 2, as R (they were NaN). Fits with weights and columns in range keep their bits.

Separately (not changed, recorded in the log): with weights about 1e40 or more apart and a residual in the heavy rows, the Householder decomposition loses the light rows (R and the matrix form give 0 for such a coefficient); row pivoting would be needed.

Test: test/issue194.test.ts. (Not pushed yet.)
