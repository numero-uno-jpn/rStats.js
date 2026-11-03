# Issue #289 log: binomTest([0, 0]) is an error

GitHub Issue #289. Session 12, judging of the issues classified C. Verdict: not planned (existing policy, recorded in docs). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `binomTest([0, 0])`: RangeError "'n' must be a positive integer >= 'x'".
- R: `binom.test(c(0, 0))`: estimate NaN, interval [0, 1], p 1.
- With no trials neither the estimate nor the test is defined. docs/differences-from-r.md ("Input that has no meaning is an error") lists `binomTest([0, 0])`, and the comment at the check says so.

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: the error is deliberate. With no trials there is no estimate (R's is NaN) and no test (R's p-value of 1 and interval [0, 1] come from a sample of size 0). binomTest([0, 0]) is listed under "Input that has no meaning is an error" in docs/differences-from-r.md, and the comment at the check states it. (Not pushed yet.)
