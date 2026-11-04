# Issue #506 log: the normal-approximation interval of ansariTest with an empty search range

GitHub Issue #506. Session 15, group A1. Fixed: `ansariTest(..., { exact: false, confInt: true })` threw a RangeError from `uniroot` when no positive ratio of the samples exists; the limits and the estimate are now NaN, as in the exact path.

## Plan

- Intent: `normalInterval` searches between the ratios of the positive values and of the non-positive x to the negative y. With all x positive and all y negative (or all x non-positive and all y positive) neither pair exists, `ends` is empty, the bracket is [Infinity, -Infinity] and `uniroot` throws "lower < upper is not fulfilled".
- Method: when `ends` is empty, return NaN limits (shaped by the alternative, as the exact path's `L === 0` case) and a NaN estimate.
- Why: the module documents NaN for limits that cannot be formed, and `exactInterval` already gives NaN on the same data. R's intent is NA (its warning says "returning NA"), though it then stops. Only the empty-range case changes, so every other input keeps its bits.

## Reproduction (main `53ee5d7`, R 4.5.2)

| Call | R 4.5.2 | rStats.js before |
|---|---|---|
| `ansari.test(c(1, 2), c(-1, -2), exact = FALSE, conf.int = TRUE)` | warnings "no non-missing arguments to min/max", "samples differ in location: cannot compute confidence set, returning NA", then error "invalid 'xmin' value" | RangeError "lower < upper is not fulfilled" (all three alternatives) |
| the same without `conf.int` | AB = 3, p = 1 | AB = 3, p = 1 |
| `exact = TRUE, conf.int = TRUE` | error "object 'absigma' not found" | [NaN, NaN], estimate NaN |

## Fix

- `src/htest/ansariTest.ts`, `normalInterval`: `if (ends.length === 0)` returns `shapeInterval(alternative, 1 - confLevel, () => [NaN, NaN])` and estimate NaN: [NaN, NaN] two-sided, [0, NaN] for "less", [NaN, Infinity] for "greater".
- Docs (en, ja): a row in the table of R errors next to the ansari row.

## Tests

- `test/issue506.test.ts`: the issue's call for the three alternatives and with the samples swapped; statistic 3 and p 1 as R; the exact path gives the same NaN. With `src/` stashed it fails.
- `test/issue209.test.ts`, `issue476.test.ts`, `htest-basic.test.ts`, `formulaTests.test.ts` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #506, see git log --grep='#506'>. When no positive ratio of the samples exists (all x on one side of 0 and all y on the other), the normal-approximation interval of ansariTest no longer calls uniroot on an empty bracket: the limits and the estimate are NaN ([NaN, NaN] two-sided, [0, NaN] for "less", [NaN, Inf] for "greater"), as the exact path already gives on the same data. The statistic and p-value are unchanged (AB = 3, p = 1 for the issue's example, as R). R 4.5.2 warns "samples differ in location ... returning NA" and then stops with "invalid 'xmin' value"; this is recorded in docs/differences-from-r.md. A test was added: test/issue506.test.ts. (Not pushed yet.)
