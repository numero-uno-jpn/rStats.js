# Issue #312 log: powerPropTest solving for a probability at an endpoint

GitHub Issue #312. Session 12, group A8 (power messages; values unchanged).

## Plan

- Intent: `powerPropTest` searches p1 in [0, p2] and p2 in [p1, 1]. With p2 = 0 or p1 = 1 the interval is a point and `uniroot` throws "lower < upper is not fulfilled". Say why instead.
- Method: a RangeError before `solveFor` for p2 = 0 (unknown p1) and p1 = 1 (unknown p2). No value changes.

## Reproduction (main `c146ad5`, R 4.5.2)

| call | R | before | after |
|---|---|---|---|
| `powerPropTest({ n: 50, p2: 0, power: 0.8 })` | "lower < upper  is not fulfilled" | the same | "'p1' cannot be determined when 'p2' is 0: no p1 in [0, p2] differs from p2" |
| `powerPropTest({ n: 50, p1: 1, power: 0.8 })` | the same | the same | "'p2' cannot be determined when 'p1' is 1: no p2 in [p1, 1] differs from p1" |

## Fix

- `src/htest/power.ts` `powerPropTest`: the two checks.
- docs (en, ja): the sentence on the power functions' errors extended.

## Tests

- `test/issue312.test.ts`: the two messages, and interior solutions (R 0.23316995582343609 and 0.76683004417656395). The first fails with `src/` stashed.
- issue311, powerStats, review33: pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #312, see git log --grep='#312'>: `powerPropTest` solving for `p1` with `p2 = 0`, or for `p2` with `p1 = 1`, now throws a RangeError saying that the search interval is a single point, instead of uniroot's "lower < upper is not fulfilled" (R gives that same error). No values change. Test: test/issue312.test.ts. (Not pushed yet.)
