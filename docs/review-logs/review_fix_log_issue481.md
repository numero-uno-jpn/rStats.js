# Issue #481 log: poissonTest expected count underflowing to 0

GitHub Issue #481. Session 13, group A1.

## Plan

- Intent: in `expectedCount1`, the direct expression n r T1 / (T1 + r T2) can underflow to 0 in n r T1 while the denominator is normal; the guard accepted that 0, so the exponent-scaled fallback (already able to give the subnormal value) was never reached.
- Method: the guard no longer accepts v = 0 when n and r are positive (T1 is always positive). Only inputs that gave 0 change; every other input keeps its bits. An exact 0 from n = 0 or r = 0 stays.

## Reproduction (main `f54af86`, R 4.5.2)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `poissonTest([0, MAX], { T: [MIN, MAX], r: MIN }).parameter` | 0 | 0 | 5e-324 (MIN_VALUE) |
| same with T1 = 3 MIN | | 0 | 1.5e-323 (3 MIN) |

With n = T2 = MAX_VALUE the value is T1 r T2 / (T1 + r T2), and r T2 is about 8.9e-16, so it is T1 to about 2^-1024 relative: MIN_VALUE. R computes the same direct expression and underflows to 0 as well, so the new value differs from R; recorded in docs next to the #223 row.

## Cause

`src/htest/poissonTest.ts` `expectedCount1`: `if (Number.isFinite(v) && Number.isFinite(den) && den >= MIN_NORMAL) return v;` accepted a product that had underflowed to 0.

## Fix

- `expectedCount1`: the condition `(v !== 0 || n === 0 || r === 0)` added to the guard.
- docs (en, ja): the #223 row of the expected count extended with this case.

## Tests

- `test/issue481.test.ts`: the issue's call and T1 = 3 MIN; r = 0 and an ordinary call unchanged. With `src/` stashed the first test fails.
- poissonTest tests (`htest-basic` with the fixtures, `issue223`, `issue323`, `issue325`, `review48`, `review57`) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #481, see git log --grep='#481'>: where n r T1 underflows to 0 with positive n and r, the expected count goes to the exponent-scaled fallback, so `poissonTest([0, Number.MAX_VALUE], { T: [Number.MIN_VALUE, Number.MAX_VALUE], r: Number.MIN_VALUE }).parameter` is Number.MIN_VALUE (was 0; R 4.5.2 also gives 0 from the same direct expression, recorded in docs/differences-from-r.md). An exact 0 for r = 0 and all other inputs are unchanged. Test: test/issue481.test.ts. (Not pushed yet.)
