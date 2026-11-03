# Issue #317 log: propTrendTest with an infinite score

GitHub Issue #317. Session 12.

## Plan

- Intent: only NaN scores were left out of the regression; an infinite score made the weighted score mean infinite, the centred score Inf - Inf, and the statistic and p-value NaN. R's `prop.trend.test` stops in `lm` there.
- Method: after the rows with a score are chosen, a non-finite score among them throws "non-missing scores must be finite". NaN stays a missing score (documented). Finite scores take the old code (the same bits). R stops too, so `docs/differences-from-r.md` is not changed.

## Check (main `0460de8`, R 4.5.2)

| call | R's `prop.trend.test` | before |
|---|---|---|
| `propTrendTest([1, 2, 3], [10, 10, 10], [1, Infinity, 3])`, also `-Infinity` | error "NA/NaN/Inf in 'x'" | statistic NaN, p NaN |
| `propTrendTest([1, 2, 3], [10, 10, 10], [1, NaN, 3])` | 1.25, p 0.2635525 | 1.2499999999999996, p 0.26355247728297276 (unchanged) |

## Fix

- `src/htest/trendTests.ts`: the check, and the doc comment of `score`.

## Tests

- `test/issue317.test.ts`: the error for ±Infinity and R's value with a NaN score. With `src/` stashed, the error test fails.
- `test/moreTests.test.ts`, `test/issue50.test.ts`, `test/issue271.test.ts`, `test/errors.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- Tiny scores: `propTrendTest([1, 2, 3], [10, 10, 10], [1e-200, 2e-200, 3e-200])` gives statistic Infinity and p 0 (R: 1.25, p 0.2635525, the same as for 1:3). The squared centred scores underflow, so sxx is 0 while sxy is not quite. The statistic does not depend on the scale of the scores; scaling them by a power of 2 first would fix it. Not filed.
- Identical scores (#318) and a pooled proportion of 0 or 1 (#319, pending) are separate issues.

## close comment

Fixed in <commit of #317, see git log --grep='#317'>. `propTrendTest` now throws "non-missing scores must be finite" for an infinite score. Such a score entered the weighted regression and made the centred score Inf - Inf, so the statistic and p-value were NaN (R's `prop.trend.test` stops in `lm` with "NA/NaN/Inf in 'x'"). A NaN score is still a missing score, and finite scores give the same values as before. (Not pushed yet.)
