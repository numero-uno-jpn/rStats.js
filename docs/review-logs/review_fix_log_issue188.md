# Issue #188 log: glmAnova's Cp is NaN for a model without parameters with a huge dispersion

GitHub Issue #188. Session 11, group A3.

## Plan

- Intent: the Cp column is `dev + 2 * dispersion * (n - dfRes)`, R's order. For `glm([[]], [1e154], gaussian, log, no intercept)` the dispersion is 1e308, `2 * 1e308` overflows to Infinity, and the penalty of 0 parameters becomes `Infinity * 0 = NaN`. The true Cp is the residual deviance 1e308.
- Method: compute the penalty as `2 * (n - dfRes) * dispersion`.
- Why: `2 * (n - dfRes)` is an exact integer, and multiplying by 2 is exact (while nothing overflows), so `(2 m) d` and `(2 d) m` are both exactly `2 (m d)`: every value where R's order does not overflow keeps its bits. No branch is needed.

## Check (main after #178; R 4.5.2)

| Fit | R 4.5.2 | Before | After |
|---|---|---|---|
| Issue's example (`glm(1e154 ~ 0, gaussian("log"))`), Resid. Dev 1e308 | Cp NaN | NaN | 1e308 |
| poisson, x = 1..4, y = (1, 3, 2, 5) | | 5.203421521662885, 4.950895493471682 | unchanged |
| Gamma, same data | | 1.7871822603668452, 1.451601910333297 | unchanged |
| gaussian, x = 1..5, y = (1.3, 3.1, 2.2, 5.7, 4.1) | 14.93066666666667, 11.48933333333334 (`%a` 0x1.ddc8057619f0fp+3, 0x1.6fa89e60f04c6p+3) | 14.930666666666667, 11.489333333333338 | unchanged |

## Fix

- `src/models/glmAnova.ts`: the Cp penalty reordered.
- Docs: a row in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue188.test.ts`: the issue's example (Cp 1e308) and the unchanged Cp of the three fits above. With src stashed the first fails.
- Full `npx vitest run`: 305 files passed. `npx tsc --noEmit -p .`: exit 0.

## Out of scope

- None.

## close comment

Fixed in <commit of #188, see git log --grep='#188'>: `glmAnova`'s Cp penalty is now computed as 2 (n − df) × dispersion. The products by 2 are exact, so Cp keeps its bits wherever R's order 2 × dispersion × (n − df) does not overflow, and a model without parameters gets a penalty of 0 instead of Inf × 0. The issue's example gives Cp 1e308, its residual deviance (was NaN; R 4.5.2 also gives NaN, recorded in docs/differences-from-r.md). Test: test/issue188.test.ts. (Not pushed yet.)
