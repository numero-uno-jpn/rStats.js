# Issue #472 log: coxph with no events

GitHub Issue #472. Session 13, group A4.

## Plan

- Intent: survival's `coxph` checks `sum(Y[, ncol(Y)]) == 0` before fitting and returns a fixed result (NA coefficients, zero variance, `loglik = c(0, 0)`, `score = 0`, `iter = 0`, `wald.test = 0`, `linear.predictors` = offset (0), `means = colMeans(X)`). rStats.js had no such branch: it ran (or with `iterMax: 0` skipped) Newton-Raphson and could report `init` as the estimate.
- Method: return that result right after the rows used and `nevent` are known, before tied times, strata and scaling. Data with events are untouched (no bit changes). The values match R, so no docs entry.

## Reproduction (main `27f9f06`, R 4.5.2, survival 3.8.3)

`coxph([1, 2], [0, 0], [[0], [1]], { weights: [1, 3], init: [5], control: { iterMax: 0 } })`

| field | R | before | after |
|---|---|---|---|
| coefficients | NA | [5] | [NaN] |
| var | [[0]] | (inverse of the zero information) | [[0]] |
| loglik / score / wald / iter | 0, 0 / 0 / 0 / 0 | | 0, 0 / 0 / 0 / 0 |
| means | 0.5 (`colMeans`, unweighted, nocenter ignored) | [0] | [0.5] |
| linear.predictors | 0, 0 | | 0, 0 |
| summary: se, z, p, conf.int | 0, NA, NA, NA | | 0, NaN, NaN, NaN |
| summary: logtest, sctest, waldtest | 0 on 0 df, p = 1 | | the same |
| summary: rsq, maxrsq | 0, 0 | | 0, 0 |

With the default control the old code also ran an iteration (`iter` 1, R 0). A second case, two columns without events (`x`, `x^2 + 3` for x = 2, 5, 7), gives R's NA, NA, zero 2 x 2 variance and means 4.666667, 29.

## Cause

`src/models/coxph.ts` `coxph`: `nevent` was counted but not used before the fit; the NA conversion of the coefficients is guarded by `iterMax > 0`, and the means are the weighted ones of the centred columns.

## Fix

- `coxph`: `if (nevent === 0) return zeroEventResult(...)` after the rows are selected (so the input checks still run). `zeroEventResult` builds R's fields and the `summary(fit)` values above; the means are `mean` of each covariate column over the rows used.

## Tests

- `test/issue472.test.ts`: both cases against R. With `src/` stashed both tests fail.
- `coxph`, `issue13`, `issue367`, `issue87`, `review16`, `review26`, `review43` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #472, see git log --grep='#472'>: `coxph` now takes survival's zero-event branch before fitting, so data without events give NaN (R's NA) coefficients, a zero variance, loglik [0, 0], score 0, Wald 0, iter 0, zero linear predictors and the unweighted column means (`colMeans(X)`), whatever `init` and `control` are. The example gives coefficients [NaN] and means [0.5] (were [5] and [0]); summary values as R (se 0, tests 0 on 0 df with p 1, rsq 0). Test: test/issue472.test.ts. (Not pushed yet.)
