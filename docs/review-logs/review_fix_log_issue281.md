# Issue #281 log: cohensD and hedgesG with paired: true and no second sample

GitHub Issue #281. Session 12, judging of the issues classified C. Verdict: not planned (same values as effectsize). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `cohensD([1, 2, 3], undefined, { paired: true })`: d 2, CI [-0.14156417860223136, 4.105494594597393], the one-sample value (`cohensD([1, 2, 3])` gives the same). `hedgesG`: 1.1283791670955128, [-0.0799, 2.3163].
- R (effectsize 1.0.3): `cohens_d(c(1, 2, 3), paired = TRUE)` d 2, CI [-0.142, 4.105]; `hedges_g(...)` 1.1284, [-0.0799, 2.3163]. The same: with one sample, effectsize treats the values as the paired differences.
- The effect sizes follow effectsize's definitions (policy, reviews 32 to 35).

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: with paired: true and a single sample, cohensD and hedgesG give effectsize's values: cohens_d(c(1, 2, 3), paired = TRUE) is d 2 with CI [-0.142, 4.105] and hedges_g 1.1284 [-0.0799, 2.3163], as here. A single sample is then the vector of paired differences, which is the one-sample effect size. The effect sizes follow effectsize's definitions by policy. (Not pushed yet.)
