# Issue #306 log: pAdjust with no p-values and a large n

GitHub Issue #306. Session 12.

## Plan

- Intent: with no non-NaN p-values (empty or all NaN) and an explicit `n`, `pAdjust` still ran the adjustment. `hommel` pads to `n` values, so `n = 2^32` threw "Invalid array length" and a large `n` did O(n^2) work, although the result is the input itself.
- Method: return the input when there is no p-value to adjust, after the checks of `n` (so `n` = Infinity or below the count is still an error). Only the scope of the issue: the cost of `hommel` with p-values and a huge `n` is #391 (pending, not touched).

## Check (main `1e67174`, R 4.5.2)

| call | R's `p.adjust` | before | after |
|---|---|---|---|
| `pAdjust([], { method: "hommel", n: 2 ** 32 })` | error "'R_Calloc' could not allocate memory" | RangeError "Invalid array length" | `[]` |
| `pAdjust([NaN], { method: "hommel", n: 2 ** 32 })` | (not run) | RangeError "Invalid array length" | `[NaN]` |
| `pAdjust([], { method: "hommel", n: 10 })` | `1` (a value for an empty input) | `[]` | `[]` |
| `pAdjust([NaN], { method: "hommel", n: 10 })` | `NA` | `[NaN]` | `[NaN]` |

Results with p-values are unchanged (the same code).

## Fix

- `src/htest/pAdjust.ts`: `lp === 0` returns with `n <= 1`.

## Tests

- `test/issue306.test.ts`: empty and all-NaN input with n = 2^32 (hommel) and 1e6 (BY); the checks of `n` still throw. With `src/` stashed, the first test fails with "Invalid array length".
- `test/review59.test.ts` and the other pAdjust tests: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- R's `p.adjust(numeric(0), "hommel", n = 10)` returns `1`, a value for an empty input (rStats.js returned `[]` before and after). Not a change here; not in docs.
- `hommel` with p-values and a huge `n` (#391) is a separate pending decision.

## close comment

Fixed in <commit of #306, see git log --grep='#306'>. `pAdjust` now returns the input unchanged when there are no non-NaN p-values (empty or all NaN), after the checks of `n`. Before, `hommel` padded to `n` values even then, so `pAdjust([], { method: "hommel", n: 2 ** 32 })` threw "Invalid array length" and a large `n` did O(n^2) work for an empty result. Results with p-values are unchanged; the cost of `hommel` with a huge `n` and p-values is #391. (Not pushed yet.)
