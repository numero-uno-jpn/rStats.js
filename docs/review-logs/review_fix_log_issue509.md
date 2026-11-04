# Issue #509 log: anova of lm fits judged nesting on rows of weight 0

GitHub Issue #509. Session 15, group A1. Fixed: `anova(fit1, fit2)` of weighted `lm` fits passed every row, including rows of weight 0, to `nestedColumns`, so a predictor that differs only on such a row made nested models look non-nested and the F and p were NaN.

## Plan

- Intent: the comparison's residual sums of squares and degrees of freedom use the rows of positive weight only; the nesting check should use the same rows.
- Method: in `comparisonTable` (`src/models/anovaSequential.ts`), filter the rows of both model matrices to those of nonzero weight before `nestedColumns`, the same form as `glmAnova` (review 64, confirmed in Audit #991). `anova` already requires the fits to share their weights, so one weight vector decides.
- Why: without weights, or with no zero weight, the matrices are unchanged and every table keeps its bits. R tests any pair, so R agrees with the fixed value here.

## Reproduction (main `53ee5d7`, R 4.5.2)

Data `y = [0, 1, 1, 4, 999]`, `x = [0, 1, 2, 3, 4]`, `z = [0, 1, 2, 3, 100]`, `w = [0, 0, 1, 1, 0]`, weights `[1, 1, 1, 1, 0]`; `anova(lm(y ~ x), lm(y ~ z + w))`.

| | R 4.5.2 | rStats.js before | after |
|---|---|---|---|
| Res.Df, RSS | 2, 1.8; 1, 1.0 | same | same |
| F | 0.8 (0x1.9999999999991p-1) | NaN | 0.8 |
| Pr(>F) | 0.5354 (0x1.122550cc9a906p-1) | NaN | 0.5354409456024601 |

Without the row of weight 0, R and rStats.js give the same F and p. On the four rows `x` and `z` are equal, and `w` is in the span of the intercept and `x`.

## Fix

- `src/models/anovaSequential.ts`, `comparisonTable`: `nestedColumns(active(small.x), active(large.x))` with `active` keeping the rows whose weight is not 0. No docs change (R gives the same value).

## Tests

- `test/issue509.test.ts`: the issue's data give the same table as the fits without the row (to the bit) and F, p close to R's. With `src/` stashed it fails.
- `test/anovaLm.test.ts`, `issue350`, `issue178`, `issue188`, `review32`, `review34`, `review39`, `review60`, `reviewModels14`, `scaleInvarianceModels`, `etaSquared` pass.

## Out of scope (recorded)

- `lmerAnova` calls `nestedColumns` on the full matrices too, but `lmer` does not accept `weights`, so it has no rows of weight 0; not changed.

## close comment

Fixed in <commit of #509, see git log --grep='#509'>. The comparison of weighted lm fits now judges nesting on the rows of positive weight only, as glmAnova already did: rows of weight 0 are not in the residual sums of squares and no longer make nested models look otherwise. The issue's example gives F = 0.8 and p = 0.5354, the same as R 4.5.2 and as the fits without the row of weight 0 (before: NaN). Tables without zero weights are unchanged. A test was added: test/issue509.test.ts. (Not pushed yet.)
