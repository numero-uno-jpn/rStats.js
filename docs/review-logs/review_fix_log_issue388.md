# Issue #388 log: lm drops a positive subnormal weight from the rss

GitHub Issue #388. Session 12, group A6 (lm and anova weights).

## Plan

- Intent: `fitLmUnit` (`src/models/lm.ts`) forms the sums of squares with the weights divided by 2^kw (kw from the largest weight). A positive weight far below the largest underflows to 0 there, so its row leaves the rss while it still counts in the residual df: weights 1e308 and 5e-324 gave sigma 0.
- Method: only where a positive weight divided by 2^kw is below 2^-1022, form the rss from the residuals and the original weights, each term as (w 2^(2a - ks)) (r 2^-a)^2 (a the exponent of r, ks even from the largest term), and carry the exponent difference rs = ks - kw into sigma, the standard errors, R^2, F and the stored rss. rs = 0 elsewhere (the same bits). Different mechanism from #194 (Householder losing light rows, recorded only).

## Reproduction (main `1f27c67`, R 4.5.2)

| call | R | before | after |
|---|---|---|---|
| `lm([[1], [0]], [0, 1], { intercept: false, weights: [1e308, 5e-324] })` and the formula form | sigma 0x1p-537, rss 0x1p-1074 | sigma 0 | sigma 2^-537, rss 5e-324 |
| `lm(y ~ x)`, x = 0:3, y = 0, 1, 2, 4, weights 1e308 x 3 and 5e-324 | sigma 0 (rss / 2 rounds to 0), se 0, R^2 and F NaN | sigma 0 | sigma 2^-537.5, R^2 1, F Inf, se 1.43e-316 and 1.11e-316 |

The second row differs from R: R's rss / df underflows. Recorded in docs.

## Fix

- `src/models/lm.ts` `fitLmUnit`: the rss from the original weights where a scaled weight is subnormal or 0; sigma, standard errors, R^2, F and `rss` through rs.
- docs (en, ja): a row in "Where R fails and rStats.js returns a value".

## Tests

- `test/issue388.test.ts`: the issue's call (matrix and formula), the two-df case, and a case with a negligible small weight (unchanged). Two fail with `src/` stashed.
- The 75 test files with lm, aov or weights: pass.

## Out of scope (recorded)

- None new.

## close comment

Fixed in <commit of #388, see git log --grep='#388'>: where a positive weight underflows when the weights are divided by the common power of 2 used for the sums of squares, `lm` now forms the residual sum of squares from the original weights (in units of a power of 2, so nothing overflows). `lm([[1], [0]], [0, 1], { intercept: false, weights: [1e308, Number.MIN_VALUE] })` gives rss 5e-324 and sigma 2^-537 (0x1p-537, as R); it was 0. Fits whose scaled weights stay in the normal range are unchanged. Test: test/issue388.test.ts. (Not pushed yet.)
