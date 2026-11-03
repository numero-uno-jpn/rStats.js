# Issue #268 log: mcnemarTest's continuity correction raises the statistic for fractional counts

GitHub Issue #268. Session 11, group B5 of the second preparation (user decision: clamp the correction at 0, record the difference from R).

## Plan

- Intent: the 2 x 2 statistic with the continuity correction is (abs(b - c) - 1)^2 / (b + c). The table input accepts fractional counts (as R does), and where 0 < abs(b - c) < 1 the corrected difference is negative and its square makes the statistic larger than without the correction, the opposite of what a continuity correction does.
- Method (the user's choice among: clamp at 0, keep R's value, reject fractional counts): use max(0, abs(b - c) - 1) as the corrected difference.
- Why this: fractional counts stay accepted (as decided in review 47 and as R); the correction only ever shrinks the difference, as R's own `chisq.test` (YATES = min(0.5, abs(x - E))) and `prop.test` do. Integer counts with b != c have abs(b - c) >= 1, so their values do not change by a bit; the symmetric table (b = c) keeps getting no correction, as before and as R.
- R differs (it squares the negative difference), so the case is recorded in docs/differences-from-r.md and docs/ja.

## Check (main `e3279e1`)

| table [[0, b], [c, 0]] | R 4.5.2 | Before | After |
|---|---|---|---|
| b = 1.5, c = 1 (the issue) | statistic 0.1 (`0x1.999999999999ap-4`), p 0.7518296 | the same | statistic 0, p 1, method "... with continuity correction" |
| b = 0.5, c = 0.2 | 0.7 (`0x1.6666666666666p-1`; 0.129 without the correction) | the same | 0, p 1 |
| [[3, 5], [2, 4]] | statistic `0x1.2492492492492p-1`, p `0x1.cc7c01b6392a8p-2` | the same statistic, p 2 ulps below R's | unchanged |
| [[3, 3], [2, 4]] (abs(b - c) = 1) | 0, p 1 | the same | unchanged |
| [[0, 2.5], [1, 0]] (fractional, abs(b - c) >= 1) | statistic `0x1.2492492492492p-4`, p `0x1.941af0500ce87p-1` | the same statistic, p 1 ulp above R's | unchanged |

The 1 to 2 ulp differences of the p-values come from the chi-squared tail, not from this branch.

## Fix

- `src/htest/mcnemarTest.ts`: `pairTerm(Math.max(0, Math.abs(b - c) - 1), b, c)` in the corrected branch; the header comment updated.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row in the hypothesis tests table of "Where R is inaccurate".

## Tests

- `test/issue268.test.ts`: the issue's table and b = 0.5, c = 0.2 give statistic 0 and p 1 with the corrected method name; three tables with abs(b - c) >= 1 keep R's statistics and the p-values from before the fix. With `src/` stashed the first test fails.
- `npx vitest run`: 333 files passed (2749 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None found.

## close comment

Fixed in <commit of #268, see git log --grep='#268'>: the continuity correction of the 2 x 2 `mcnemarTest` now uses max(0, abs(b - c) - 1), so it never makes the statistic larger. `mcnemarTest([[0, 1.5], [1, 0]])` now gives statistic 0 and p-value 1 (it gave 0.1, the same as without the correction), and `[[0, 0.5], [0.2, 0]]` gives 0 instead of 0.7. R's `mcnemar.test` squares the negative difference as rStats.js did (its `chisq.test` and `prop.test` clamp their corrections), so this is recorded in docs/differences-from-r.md. Integer counts are unchanged.

Test: test/issue268.test.ts. (Not pushed yet.)
