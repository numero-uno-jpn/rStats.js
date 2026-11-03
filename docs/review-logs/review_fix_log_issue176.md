# Issue #176 log: glmDispersion overflows its weighted residual sum although the dispersion is finite

GitHub Issue #176. Session 11, group A3.

## Plan

- Intent: `dispersionOf` (behind `glmDispersion`, `glmSummary`, `glmRstandard`, `glmCooksDistance`, `glmPredict` and `glmAnova`) sums `W r^2` in a plain double and divides by the residual degrees of freedom only at the end. In the issue's Gamma/log fit with prior weights 2e304 the sum (about 1.98e308 in exact arithmetic) overflows, so the dispersion is Infinity although it is about 2.0e306.
- Method: keep the plain sum wherever it is finite. Only where it is Infinity (and every used weight and residual is finite), form each term as `(sqrt(W) r)^2`, with the residuals divided by a power of 2 first (`scaleToUnit`) and then the products `sqrt(W) abs(r)` divided by a power of 2, sum the squares (now at most 4 per row), divide by the residual degrees of freedom and add the exponents back with `ldexp` (`scaledPearsonMean` in `src/models/glm.ts`).
- Why: the fallback is reached only where the old value was Infinity, so every finite dispersion keeps its bits. Powers of 2 add no rounding; the only extra rounding is the square root of each weight (a few ulp). A sum that overflows cannot be changed by terms lost below 2^-1074 of the largest.

## Check (main after #192; R 4.5.2)

| Fit | R 4.5.2 | Before | After |
|---|---|---|---|
| Issue's example, weights 2e304 | Inf (`summary()$dispersion`); `sum(r^2) / 99 * 2e304` = 2e306 | Infinity (standard error Infinity) | 1.9999999199999876e306 (standard error 0.99999998) |
| Weights 2^1012 (the sum overflows) | | Infinity | exactly 2^1012 times the dispersion of weights 1 (same coefficients) |
| Weights 1 | | 99.99999599999872 | unchanged |
| Weights 2e300 | | 1.9999999200000117e302 | unchanged |

## Fix

- `src/models/glm.ts`: `dispersionOf` falls back to `scaledPearsonMean` where the sum is Infinity.
- Docs: a row in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue176.test.ts`: the issue's example (relative 1e-13 of 1.99999992e306, and the summary's standard error finite), the exact power-of-2 relation with weights 2^1012, and the unchanged values of weights 1 and 2e300. With src stashed the first two fail.
- Full `npx vitest run`: 303 files passed. `npx tsc --noEmit -p .`: exit 0.

## Out of scope

- None.

## close comment

Fixed in <commit of #176, see git log --grep='#176'>: where the weighted sum of squared Pearson residuals overflows, `glmDispersion` (and so `glmSummary`, `glmRstandard`, `glmCooksDistance`, `glmPredict` and `glmAnova`) now forms each term as (sqrt(w) r)^2 in units of powers of 2 and adds the exponents back after dividing by the residual degrees of freedom. The issue's example gives 1.99999992e306 (was Infinity; R 4.5.2 also gives Inf, recorded in docs/differences-from-r.md). Dispersions whose sum is finite are unchanged. Test: test/issue176.test.ts. (Not pushed yet.)
