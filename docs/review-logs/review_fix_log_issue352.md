# Issue #352 log: mergeTiedTimes midpoint beyond 2^31 times

GitHub Issue #352. Session 12, group A2.

## Plan

- Intent: `mergeTiedTimes` (tiedTimes.ts, the timefix merge used by coxph, survfit and survdiff) finds the largest cut point not above each time with the midpoint `(lo + hi + 1) >> 1`. `>>` converts to a signed 32-bit integer, so with more than 2^31 distinct times (16 GB) the midpoint can be negative and a time maps to a wrong cut point.
- Method: `Math.floor((lo + hi + 1) / 2)`. Array lengths are below 2^32, so the sum is exact, and below 2^31 the index is the same as before (the same bits).
- Why no runtime reproduction: it needs more than 2^31 distinct times; the plan (approved) was not to allocate them. The cut points are built inside the function, so no fake large array can be passed.

## Check (main `b8ede56`)

- Code reading: at lo = 0, hi = 2^31 the old midpoint `(2^31 + 1) >> 1` is -1073741824; the new one is 1073741824.

## Fix

- `src/models/tiedTimes.ts`, `mergeTiedTimes`: midpoint `Math.floor((lo + hi + 1) / 2)`.

## Tests

- `test/issue352.test.ts`: the source has no `) >> ` midpoint; an ordinary merge (a time 1e-10 above another, infinite and repeated times). With `src/` stashed, the source check fails.
- `test/coxph.test.ts`, `test/survival.test.ts`, `test/issue253.test.ts`, `test/issue254.test.ts`, `test/issue87.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None new (tukey.ts and interp.ts: see the #340 log).

## close comment

Fixed in <commit of #352, see git log --grep='#352'>: the binary search of `mergeTiedTimes` now takes its midpoint as `Math.floor((lo + hi + 1) / 2)` instead of `(lo + hi + 1) >> 1`, which wrapped to a negative index once the sum reached 2^31 (more than 2^31 distinct times). The large input was not allocated; the fix was checked by reading the code, and below 2^31 the index is the same as before, so ordinary results are unchanged.

Test: test/issue352.test.ts. (Not pushed yet.)
