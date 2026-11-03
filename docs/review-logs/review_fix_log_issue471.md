# Issue #471 log: pAdjust "hommel" with n = 2

GitHub Issue #471. Session 13, group A3.

## Plan

- Intent: R's `p.adjust` replaces "hommel" with "hochberg" when n == 2. rStats.js ran the Hommel loop for every n; for p in [0, 1] the two agree, but p outside [0, 1] (taken as they are, as R) differ.
- Method: dispatch n = 2 to the Hochberg branch, as R. For p in [0, 1] both give min(2 p_(1), p_(2)) and p_(2) with exact operations, so those values keep their bits.

## Reproduction (main `f77ef13`, R 4.5.2)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `pAdjust([-2, 0.3], "hommel")` | [-4, 0.3] | [-2, 0.3] | [-4, 0.3] |
| `pAdjust([1.5, 0.3], "hommel")` | [1, 0.6] | [1.5, 0.6] | [1, 0.6] |
| `pAdjust([Infinity, 0.3], "hommel")` | [1, 0.6] | [Infinity, 0.6] | [1, 0.6] |
| `pAdjust([0.3], { method: "hommel", n: 2 })` | 0.6 | 0.6 | 0.6 |
| `pAdjust([0.04, NaN, 0.03], "hommel")` | [0.04, NaN, 0.04] | the same | the same |

## Cause

`src/htest/pAdjust.ts` `adjust`: `case "hommel": return hommel(p, n);` without R's n == 2 substitution.

## Fix

- `adjust`: `n === 2 ? adjust(p, "hochberg", n) : hommel(p, n)`. Now as R; no docs entry.

## Tests

- `test/issue471.test.ts`: the cases above against R, and an n = 3 case (Hommel loop, as R). With `src/` stashed the first test fails.
- `padjust`, `htest-basic`, `errors`, `issue154`, `issue306`, `issue391`, `mcompPMCMR`, `review59`, `reviewModels14` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #471, see git log --grep='#471'>: as R's `p.adjust`, `pAdjust` with method "hommel" and n = 2 uses Hochberg's method, so `pAdjust([-2, 0.3], { method: "hommel" })` is [-4, 0.3] and `[1.5, 0.3]` gives [1, 0.6] (were [-2, 0.3] and [1.5, 0.6]). p-values in [0, 1] give the same values as before. Test: test/issue471.test.ts. (Not pushed yet.)
