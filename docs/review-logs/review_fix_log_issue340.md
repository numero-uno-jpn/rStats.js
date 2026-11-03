# Issue #340 log: cut and findInterval midpoints beyond 2^31 breaks

GitHub Issue #340. Session 12, group A2.

## Plan

- Intent: `binCode` (used by `cut`) and `findInterval` (table.ts) binary-search the breaks with `(lo + hi) >> 1`. `>>` converts to a signed 32-bit integer, so with more than 2^31 breaks (16 GB) the midpoint can be negative, `vec[mid]` is undefined and the interval is wrong.
- Method: `Math.floor((lo + hi) / 2)` in both. Array lengths are below 2^32, so the sum is exact, and below 2^31 the index is the same as before (the same bits).
- Why no runtime reproduction: it needs more than 2^31 breaks; the plan (approved) was not to allocate them. `findInterval` checks the order of every break first and `binCode` is module-private (cut builds the breaks), so a fake large array is not practical.

## Check (main `b31af2d`)

- Code reading: at lo = 0, hi = 2^31 + 1 the old midpoint `(2^31 + 1) >> 1` is -1073741824; the new one is 1073741824.

## Fix

- `src/descriptive/table.ts`, `binCode` and `findInterval`: midpoint `Math.floor((lo + hi) / 2)`.

## Tests

- `test/issue340.test.ts`: neither function has a `) >> ` midpoint in its source; ordinary `findInterval` and `cut` values (both closures). With `src/` stashed, the source check fails.
- `test/descriptive.test.ts`, `test/issue227.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The same 32-bit midpoint, with no issue filed, not changed here:
  - `src/distributions/tukey.ts` 602, `evalCurve`: `(lo + hi + 1) >> 1` over the Chebyshev segments of a fixed internal table (a handful of segments; it cannot reach 2^31).
  - `src/numerics/interp.ts` 449 (spline evaluation, the knot search) and 626 (the knot count of a query point): `(lo + hi) >> 1` over the user's knots, so the same wrap with more than 2^31 knots.

## close comment

Fixed in <commit of #340, see git log --grep='#340'>: the binary searches of `findInterval` and of `cut` (binCode) now take their midpoint as `Math.floor((lo + hi) / 2)` instead of `(lo + hi) >> 1`, which wrapped to a negative index once lo + hi reached 2^31 (more than 2^31 breaks). The large break vector was not allocated; the fix was checked by reading the code, and below 2^31 the index is the same as before, so ordinary results are unchanged.

Test: test/issue340.test.ts. (Not pushed yet.)
