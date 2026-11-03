# Issue #318 log: propTrendTest with identical scores

GitHub Issue #318. Session 12, group B (user decision 9).

## Plan

- Intent: with one score value among the groups with a score (all identical, or only one group with a score) the regression has no slope; sxx = sxy = 0 and the statistic is 0 / 0 = NaN (R: NA).
- User decision (2026-11-03): a RangeError "at least 2 distinct non-missing scores are needed". This reverses the fix of #50, which chose NaN for "one score left" (`[NaN, NaN, NaN, 4]`) as R's NA; `test/issue50.test.ts` now expects the error. The policy is review 59's "input without meaning is an error" (no discordant pairs in `mcnemarTest`, only zero differences in `wilcoxTest`, two constant samples in `varTest`), as #309 and #320. docs (en, ja): R gives NA.
- The check comes after that of #317 (non-finite scores) and after #319 (all proportions 0 or 1), which is decided first as R stops there for any scores.

## Reproduction (main `c2d1e4e`, R 4.5.2)

| call | R `prop.trend.test` | before | after |
|---|---|---|---|
| `propTrendTest([1, 2, 3], [10, 10, 10], [5, 5, 5])` (the issue) | NA, NA | NaN, NaN | RangeError |
| `[5, NaN, 5]`, `[5, NaN, NaN]` | NA | NaN | RangeError |
| `propTrendTest([1], [10])` | NA | NaN | RangeError |
| `propTrendTest([1, 2, 3, 4], [10, 10, 10, 10], [NaN, NaN, NaN, 4])` (#50) | NA (warning "essentially perfect fit") | NaN | RangeError |
| `[1, 1, 3]` | 0.93749999999999964, p 0.3329216080655661 | unchanged | unchanged |

## Fix

- `src/htest/trendTests.ts`, `propTrendTest`: the RangeError when all scores of the rows with a score are equal; the doc comment of `score`.
- docs (en, ja): in "Input that has no meaning is an error".

## Tests

- `test/issue318.test.ts`: the errors and the unchanged `[1, 1, 3]` against R. With `src/` stashed, the error test fails.
- `test/issue50.test.ts`: the one-score case now expects the error (the test fails with `src/` stashed).
- `issue271`, `issue317`, `issue319`, `moreTests`: pass.

## Out of scope (recorded)

- Tiny scores (`[1e-200, 2e-200, 3e-200]`) give statistic Infinity, p 0 (see the #317 log).

## close comment

Fixed in <commit of #318, see git log --grep='#318'>: `propTrendTest` with fewer than two distinct scores among the groups with a score (`propTrendTest([1, 2, 3], [10, 10, 10], [5, 5, 5])`, or only one group with a score) has no slope to test; the statistic was 0 / 0 = NaN (R's `prop.trend.test` gives NA). It now throws "at least 2 distinct non-missing scores are needed". This also changes the case of one score left after missing scores, which #50 had left NaN as R's NA. Other inputs are unchanged. Recorded in docs/differences-from-r.md.

Test: test/issue318.test.ts. (Not pushed yet.)
