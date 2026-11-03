# Issue #332 log: ecdf's binary-search midpoint beyond 2^31 values

GitHub Issue #332. Session 12, group A2.

## Plan

- Intent: the function returned by `ecdf` finds the count of values at or below q with the midpoint `(lo + hi) >> 1`. `>>` converts to a signed 32-bit integer, so once lo + hi reaches 2^31 (more than 2^31 values, 16 GB of doubles) the midpoint is negative, `s[mid]` is undefined and the search ends at a wrong count.
- Method: `Math.floor((lo + hi) / 2)`. Array lengths are below 2^32, so the sum is an exact integer in double, and for sums below 2^31 the index is the same as before (the same bits for every input that could be run).
- Why no runtime reproduction: it needs an input of more than 2^31 values; the plan (approved) was not to allocate it. `ecdf` copies its input (`Array.from`), so the search cannot be given a fake large array either.

## Check (main `6776019`)

- Code reading: at lo = 0, hi = 2^31 + 1 the old midpoint is `(2^31 + 1) >> 1` = -1073741824; the new one is 1073741824.
- No R comparison needed (R's ecdf is correct; this is an index arithmetic fix).

## Fix

- `src/descriptive/hist.ts`, `ecdf`: midpoint `Math.floor((lo + hi) / 2)`.

## Tests

- `test/issue332.test.ts`: the source of `ecdf` has no `) >> ` midpoint, and ordinary values are unchanged. With `src/` stashed, the source check fails.
- `test/descriptive.test.ts`, `test/jstat-replacement.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The same midpoint in other searches: see the logs of #333, #340 and #352 (and #340 for tukey.ts and interp.ts).

## close comment

Fixed in <commit of #332, see git log --grep='#332'>: the binary search of the function returned by `ecdf` now takes its midpoint as `Math.floor((lo + hi) / 2)` instead of `(lo + hi) >> 1`, which wrapped to a negative index once lo + hi reached 2^31. The input of more than 2^31 values was not allocated; the fix was checked by reading the code, and below 2^31 the index is the same as before, so ordinary results are unchanged.

Test: test/issue332.test.ts. (Not pushed yet.)
