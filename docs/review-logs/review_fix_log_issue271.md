# Issue #271 log: propTrendTest overflows the pooled totals for finite counts

GitHub Issue #271. Session 11, group A6 of the second triage (overflow in tests and descriptive statistics).

## Plan

- Intent: `propTrendTest` pools p = sum x / sum n with plain sums, so finite counts whose totals overflow give Inf / Inf = NaN, and NaN goes into every weight and the statistic. The same happens where the weights n_i / (p (1 - p)) overflow (a tiny pooled proportion with large n), and where sxy^2 overflows in sxy^2 / sxx although the statistic is finite (R's lm does not square sxy and returns the value there).
- Method: the old computation is kept and its statistic formed through the shared `squareOver(sxy, sxx)` (the same bits as (sxy sxy) / sxx wherever sxy^2 is a normal number). Only where sum n overflows, or where 0 < p < 1 and the total weight, sxy or sxx is not finite, the counts are divided by a power of 2 with `scaleToUnit` (exact), p is pooled from those, the regression is run with the weights n_i 2^-k (the factor 1 / (p (1 - p)) cancels in the weighted means) and the statistic is (sxy / p) (sxy / sxx / (1 - p)) multiplied back by 2^k. The proportions f_i = x_i / n_i are taken from the original counts.
- Why this: the statistic is not invariant to the units of the counts (it scales with them), so the result has to be multiplied back; scaling only in the fallback leaves every ordinary input to the bit. Dividing by p and 1 - p before multiplying keeps the case of a tiny p (where sxy and sxy / sxx are both of order p) out of underflow. p = 0 or 1 stays NaN as before (infinite weights, as in R).
- R stops with "NA/NaN/Inf in 'x'" from lm.wfit for the first two cases, so they are recorded in docs.

## Check (main `31272fc`, R 4.5.2, Rmpfr)

| Call | R | Before | After |
|---|---|---|---|
| `propTrendTest([5e307, 5e307], [1e308, 1e308])` (the issue) | error "NA/NaN/Inf in 'x'" | NaN, NaN | statistic 0, p-value 1 |
| `propTrendTest([1, 0], [1e300, 1e300])` (weights overflow) | the same error | NaN | 0.9999999999999999 (Rmpfr from the double counts 1.0000000000000000000), p 0.3173105078629141 |
| `propTrendTest([15, 10, 8, 4] × 2^1000, [30, 30, 30, 30] × 2^1000)` (sxy^2 overflows) | 1.025801e+302 | Infinity, p 0 | 1.0258011413636036e+302 (Rmpfr 1.0258011413636033616e+302, 2 ulp) |
| `propTrendTest([15, 10, 8, 4], [30, 30, 30, 30])` | 9.573428850537288 | the same | unchanged (also p 0.001974137263574751, and 9.679490161417874 with the score [1, NaN, 3, 4]) |
| `propTrendTest([0, 0, 0], [3, 4, 5])`, `([3, 4, 5], [3, 4, 5])` | not run | NaN | unchanged |

## Fix

- `src/htest/trendTests.ts`: the weighted regression moved into a helper `trendRegression` (the same sums in the same order); the statistic through `squareOver`; the scaled fallback as above.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row in "Where R fails and rStats.js returns a value".

## Tests

- `test/issue271.test.ts`: the issue's call gives 0 and 1, the overflowing weights and sxy^2 cases match Rmpfr (relative 1e-15), the ordinary cases keep the values from before the fix. With `src/` stashed the first three tests fail.
- `npx vitest run`: 353 files passed (2807 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Scores so large that w (s - s̄)^2 overflows even with the scaled weights are not handled (the statistic does not depend on the units of the scores, so they could be scaled as well).

## close comment

Fixed in <commit of #271, see git log --grep='#271'>: where the totals of the counts or the weights n / (p (1 - p)) overflow for finite counts, `propTrendTest` now pools the proportion from the counts divided by a power of 2 and runs the regression with the scaled weights (the common factor 1 / (p (1 - p)) cancels), multiplying the statistic back at the end; the statistic sxy^2 / sxx also no longer overflows in sxy^2 (via the shared `squareOver`). `propTrendTest([5e307, 5e307], [1e308, 1e308])` now gives statistic 0 and p-value 1 instead of NaN (R stops with "NA/NaN/Inf in 'x'"), `propTrendTest([1, 0], [1e300, 1e300])` gives 0.9999999999999999 (Rmpfr 1) instead of NaN, and the example counts times 2^1000 give 1.0258011413636036e+302 as R instead of Infinity. Ordinary inputs are unchanged to the bit; the R differences are recorded in docs/differences-from-r.md. (Not pushed yet.)
