# Issue #326 log: poissonTest's expected count for r = 0 with extreme exposures

GitHub Issue #326. Session 12, judging of the issues classified C. Verdict: completed (already fixed for #223 by e21db3e). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `poissonTest([1, 0], { r: 0, T: [Number.MIN_VALUE, 1e308] })`: statistic 1, expected count 0, p 0, estimate Inf, interval [Inf, Inf].
- R: `poisson.test(c(1, 0), T = c(5e-324, 1e308), r = 0)`: statistic 1, parameter 0, p 0, estimate Inf, interval [Inf, Inf]. The same.
- The issue cites the blob 61c2c6a of src/htest/poissonTest.ts, the version just before e21db3e (#223), which added `if (n === 0 || r === 0) return 0` before the fallback. test/issue223.test.ts covers r = 0 with T [1e-320, 1e308].

## Fix

- None (fixed by e21db3e).

## Tests

- None (test/issue223.test.ts).

## Out of scope

- None.

## close comment

Completed: this was fixed in e21db3e (#223), just after the source version the issue cites. expectedCount1 now returns 0 for n = 0 or r = 0 before the fallback, so poissonTest([1, 0], { r: 0, T: [Number.MIN_VALUE, 1e308] }) gives the expected count 0, p 0 and estimate Inf, the same as R's poisson.test(c(1, 0), T = c(5e-324, 1e308), r = 0). (Not pushed yet.)
