# Issue #319 log: propTrendTest with all proportions 0 or all 1

GitHub Issue #319. Session 12, group B (user decision 9).

## Plan

- Intent: with no events in any group (or only events), the pooled proportion p is 0 (or 1), every weight n_i / (p (1 - p)) is Infinity, and the statistic and p-value were NaN. Every proportion is the same, so there is no trend to test.
- User decision (2026-11-03): a RangeError, as R (whose `lm.wfit` stops with "NA/NaN/Inf in 'x'"). This reverses review 59's "record only" for this case. No docs entry: R also stops (only the message differs).
- The check is on the counts (every x_i = 0, or every x_i = n_i), not on the rounded p, so it does not depend on the overflow handling of #271. It comes before the score checks; R stops for any scores.

## Reproduction (main `0690766`, R 4.5.2)

| call | R `prop.trend.test` | before | after |
|---|---|---|---|
| `([0, 0, 0], [10, 10, 10])` | error "NA/NaN/Inf in 'x'" | NaN, NaN | RangeError "all proportions are 0 or all are 1: the test for trend is not defined" |
| `([10, 10, 10], [10, 10, 10])` | same error | NaN | same RangeError |
| `([0, 0, 0], [10, 10, 10], [1, 2, 3])`, `([0, 0], [10, 10], [1, NaN])` | same error | NaN | same RangeError |
| `([0, 0, 3], [10, 10, 10], [1, 2, NaN])` (events only in the group without a score) | 0, p 1 | 0, 1 | unchanged |

## Fix

- `src/htest/trendTests.ts`, `propTrendTest`: the RangeError after the checks of x and n; a sentence in the doc comment.

## Tests

- `test/issue319.test.ts`: the errors and the unchanged case above. With `src/` stashed, the error test fails.
- `test/issue271.test.ts`: its "leaves the other cases as before" expected NaN for `([0, 0, 0], [3, 4, 5])` and `([3, 4, 5], [3, 4, 5])` (the behavior recorded in review 59); now the error.
- `issue50`, `issue317`, `moreTests` (the 3 R fixtures of prop.trend.test): pass.

## Out of scope (recorded)

- The pooled p can also round to 0 or 1 for huge counts that are not all 0 or all n: `propTrendTest([9007199254740991, 9007199254740992], [9007199254740992, 9007199254740992])` sums the events to 2^54, p = 1, and the result is NaN, NaN. A rounding of the totals, not this issue.

## close comment

Fixed in <commit of #319, see git log --grep='#319'>: `propTrendTest` with no events in any group or only events (`propTrendTest([0, 0, 0], [10, 10, 10])`, `propTrendTest([10, 10, 10], [10, 10, 10])`) had a pooled proportion of 0 or 1, infinite weights, and returned NaN. All proportions are the same, so there is no trend to test; it now throws "all proportions are 0 or all are 1: the test for trend is not defined". R's `prop.trend.test` also stops there (with "NA/NaN/Inf in 'x'" from `lm.wfit`). Other inputs are unchanged.

Test: test/issue319.test.ts. (Not pushed yet.)
