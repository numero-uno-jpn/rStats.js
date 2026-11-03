# Issue #288 log: chisqTest with two factor vectors rejects a single-level factor

GitHub Issue #288. Session 12, judging of the issues classified C. Verdict: not planned (R gives the same error). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `chisqTest(["a", "a", "a", "a"], ["u", "u", "v", "v"])`: RangeError "'x' and 'y' must have at least 2 levels".
- R: `chisq.test(factor(c("a", "a", "a", "a")), factor(c("u", "u", "v", "v")))`: error "'x' and 'y' must have at least 2 levels". R checks the levels of the two factors before building the table.

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: R gives the same error. chisq.test(factor(c("a", "a", "a", "a")), factor(c("u", "u", "v", "v"))) stops with "'x' and 'y' must have at least 2 levels" before it builds a table; only a matrix with one row or column becomes a goodness-of-fit test. rStats.js matches it. (Not pushed yet.)
