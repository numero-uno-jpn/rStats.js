# Issue #277 log: qansariR returns the largest quantile for a NaN probability

GitHub Issue #277. Session 12, judging of the issues classified C. Verdict: not planned (internal helper; the public API only passes probabilities in (0, 1)). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `qansariR` is not exported. Its only caller is `ansariTest` (src/htest/ansariTest.ts), with alpha / 2, 1 - alpha / 2 and 0.5, after `checkConfLevelOpen` has rejected a NaN, 0 or 1 confidence level.
- `ansariTest([1, 2, 3, 4], [2, 5, 6, 7], { exact: true, confInt: true, confLevel: NaN })` and `confLevel: 1`: RangeError "'conf.level' must be a single number between 0 and 1" (R's message).

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: qansariR is an internal helper (src/htest/core/ansari.ts), not exported. Its only caller, ansariTest, passes alpha / 2, 1 - alpha / 2 and 0.5 after rejecting a confidence level that is NaN or not strictly between 0 and 1 (ansariTest(..., { confLevel: NaN }) is a RangeError, as in R), so a NaN probability cannot reach it. (Not pushed yet.)
