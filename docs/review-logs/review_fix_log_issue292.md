# Issue #292 log: fisherTest rejects confidence levels 0 and 1

GitHub Issue #292. Session 12, judging of the issues classified C. Verdict: not planned (R rejects them too). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `fisherTest([[3, 1], [1, 3]], { confLevel: 0 })` and `confLevel: 1`: RangeError "confLevel must be a single number between 0 and 1".
- R: `fisher.test(matrix(c(3, 1, 1, 3), 2), conf.level = 0)` and `conf.level = 1`: error "'conf.level' must be a single number between 0 and 1" (the check is 0 < conf.level < 1). Same as #43.

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: R rejects these too. In R 4.5.2, fisher.test(matrix(c(3, 1, 1, 3), 2), conf.level = 0) and conf.level = 1 stop with "'conf.level' must be a single number between 0 and 1", and rStats.js gives the same error. (Not pushed yet.)
