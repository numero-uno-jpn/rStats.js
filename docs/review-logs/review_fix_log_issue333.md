# Issue #333 log: hist's cell-lookup midpoint beyond 2^31 breaks

GitHub Issue #333. Session 12, group A2.

## Plan

- Intent: `cellOf` (hist.ts, the cell of each value) binary-searches the breaks with the midpoints `(a + b) >> 1` (right-closed cells) and `(a + b + 1) >> 1` (left-closed). `>>` converts to a signed 32-bit integer, so with more than 2^31 breaks (16 GB) the midpoint can be negative and a value lands in a wrong cell or none.
- Method: `Math.floor((a + b) / 2)` and `Math.floor((a + b + 1) / 2)`. Array lengths are below 2^32, so the sums are exact, and below 2^31 the index is the same as before (the same bits).
- Why no runtime reproduction: it needs more than 2^31 breaks; the plan (approved) was not to allocate them. `cellOf` is module-private and hist builds the shifted breaks itself, so no fake large array can be passed.

## Check (main `8254dec`)

- Code reading: with a = 1, b = 2^31 + 1 the old midpoint `(2^31 + 2) >> 1` is -1073741823; the new one is 1073741825.

## Fix

- `src/descriptive/hist.ts`, `cellOf`: both midpoints with `Math.floor`.

## Tests

- `test/issue333.test.ts`: the source of `cellOf` has no `) >> ` midpoint; counts for right- and left-closed cells. With `src/` stashed, the source check fails.
- `test/descriptive.test.ts`, `test/issue22.test.ts`, `test/issue228.test.ts`, `test/issue229.test.ts`, `test/issue230.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None new (the other searches: #332, #340, #352).

## close comment

Fixed in <commit of #333, see git log --grep='#333'>: hist's cell lookup now takes its midpoints as `Math.floor((a + b) / 2)` and `Math.floor((a + b + 1) / 2)` instead of `>> 1`, which wrapped to a negative index once the sum reached 2^31 (more than 2^31 breaks). The large break vector was not allocated; the fix was checked by reading the code, and below 2^31 the index is the same as before, so ordinary counts are unchanged.

Test: test/issue333.test.ts. (Not pushed yet.)
