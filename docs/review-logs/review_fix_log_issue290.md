# Issue #290 log: binomTest rejects confidence levels 0 and 1

GitHub Issue #290. Session 12, judging of the issues classified C. Verdict: not planned (R rejects them too). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `binomTest(3, 10, { confLevel: 0 })` and `confLevel: 1`: RangeError "'conf.level' must be a single number between 0 and 1".
- R: `binom.test(3, 10, conf.level = 0)` and `conf.level = 1`: error "'conf.level' must be a single number between 0 and 1" (R 4.5.2 checks `conf.level > 0 && conf.level < 1`, not the closed interval).

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: R rejects these too. In R 4.5.2, binom.test(3, 10, conf.level = 0) and conf.level = 1 stop with "'conf.level' must be a single number between 0 and 1" (the check is 0 < conf.level < 1), and rStats.js gives the same error. (Not pushed yet.)
