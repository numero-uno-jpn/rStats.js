# Issue #311 log: power functions solving for n with no effect

GitHub Issue #311. Session 12, group A8 (power messages; values unchanged).

## Plan

- Intent: with no effect the power does not depend on n, so the root search for n fails with a generic error. Detect it first and say why, as already done for `sd` (delta 0) and `withinVar` (betweenVar 0).
- Method: before `solveFor` for n, throw a RangeError for `delta === 0` (`powerTTest`), `p1 === p2` (`powerPropTest`) and `betweenVar === 0` (`powerAnovaTest`). No value changes.

## Reproduction (main `3bf56f1`, R 4.5.2)

| call | R | before | after |
|---|---|---|---|
| `powerTTest({ delta: 0, sd: 1, power: 0.8 })` | "did not succeed extending the interval endpoints" | "no sign change found in 1000 iterations" | "'n' cannot be determined when 'delta' is 0: the power does not depend on it" |
| `powerPropTest({ p1: 0.5, p2: 0.5, power: 0.8 })` | "no sign change found in 1000 iterations" | the same | "'n' cannot be determined when 'p1' equals 'p2': ..." |
| `powerAnovaTest({ groups: 3, betweenVar: 0, withinVar: 1, power: 0.8 })` | "f() values at end points not of opposite sign" | the same | "'n' cannot be determined when 'betweenVar' is 0: ..." |

## Fix

- `src/htest/power.ts`: the three checks.
- docs (en, ja): the sentence on the power functions' errors extended.

## Tests

- `test/issue311.test.ts`: the three messages and an unchanged n (16.71477, R). Three fail with `src/` stashed.
- issue197, issue272, powerStats, review33: pass.

## Out of scope (recorded)

- `powerAnovaTest({ n: 5, betweenVar: 0, withinVar: 1, power: 0.8 })` (solving for `groups`) still fails with "f() values at end points not of opposite sign" (R the same); the power does not depend on groups there either. Not in the issue (sample size), left as is.

## close comment

Fixed in <commit of #311, see git log --grep='#311'>: solving for `n` with no effect now throws a RangeError saying that the power does not depend on n: `delta = 0` in `powerTTest`, `p1 = p2` in `powerPropTest`, `betweenVar = 0` in `powerAnovaTest`. Before, the root search failed with "no sign change found" or "f() values at end points not of opposite sign" (R gives the same kind of errors). No values change. Test: test/issue311.test.ts. (Not pushed yet.)
