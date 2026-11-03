# Issue #219 log: r2dtable builds the table of log factorials for zero tables

GitHub Issue #219. Session 11, group A1 (input checks and early returns).

## Plan

- Intent: `r2dtable(0, r, c)` asks for no table, but the table of log factorials (grand total + 1 doubles) and the work matrix were built before the loop. With the issue's margins (total 2e9, within the accepted 2147483647) that is a 16 GB allocation for an empty result.
- Method: after all the checks of `n` and the margins (equal sums, the cap on the total), return `[]` when the truncated count is 0, before `logFactorialTable`.
- Why: R checks the margins for n = 0 too (unequal sums and a single row are errors there), so the checks stay first; only the allocation is skipped. No uniforms are drawn either way, so the random stream is unchanged.
- Expected effect: none for n >= 1; n in [0, 1) returns `[]` at once.

## Check (main `c2a515a` with #203; R 4.5.2)

- The issue's call (margins 1e9, 1e9) was not run before the fix, as asked (it would try to allocate 2e9 + 1 doubles). In the test, a `Float64Array` constructor that throws above a million entries shows the allocation: before the fix the call fails with "Float64Array of 2000000001 entries"; after it, it returns `[]`.
- R 4.5.2: `set.seed(1); r2dtable(0, c(3, 2), c(2, 3))` is `list()` and the next `runif(1)` is 0.26550866314209998 (no draws); `r2dtable(0.7, ...)` is `list()`; `r2dtable(0, c(3, 2), c(2, 4))` "arguments 'r' and 'c' must have the same sums"; `r2dtable(0, 3, 3)` "invalid argument 'r'". rStats.js gives the same, before and after.

## Fix

- `src/random/r2dtable.ts`: `if (count === 0) return [];` after the checks.
- No docs change (the results are R's).

## Tests

- `test/issue219.test.ts`: the issue's call (and n = 0.7) under the guarded `Float64Array`; the margin checks and the untouched random stream at n = 0. With src stashed the first test fails at once with the guard's error.
- The test files that use `r2dtable`: 48 passed. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #219, see git log --grep='#219'>: `r2dtable` now returns `[]` when the truncated `n` is 0, after checking the margins (as R does for n = 0) and before building the table of log factorials, so the issue's call with a grand total of 2e9 no longer tries to allocate 16 GB. No uniforms are drawn, as in R (`set.seed(1); r2dtable(0, c(3, 2), c(2, 3))` is `list()` and leaves the stream as it was). Other `n` are unchanged. Test: test/issue219.test.ts. (Not pushed yet.)
