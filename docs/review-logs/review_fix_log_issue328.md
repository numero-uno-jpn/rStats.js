# Issue #328 log: ppois(1e16, 1e16) on the wrong side of 0.5

GitHub Issue #328. Session 12, judging of the issues classified C. Verdict: not planned (no defect: fixed in review 54; the source comment describes the earlier value). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `ppois(1e16, 1e16)`: 0.5000000026596152; `qpois(0.5, 1e16)`: 1e16.
- R: `ppois(1e16, 1e16)` 0.5000000026596, `qpois(0.5, 1e16)` 1e16. The same.
- The comment in ppois1 (src/distributions/poisson.ts) reads "ppois(1e16, 1e16) was 0.4999999987, below 1/2 (R: 0.5000000027)": the value before review 54 (567f52f), which introduced the x + 1 correction below it. The issue read it as the current value.

## Fix

- None (not planned).

## Tests

- None (test/review54.test.ts, test/issue118.test.ts cover ppois beyond 2^53).

## Out of scope

- None.

## close comment

Not planned: there is no defect. ppois(1e16, 1e16) is 0.5000000026596152 and qpois(0.5, 1e16) is 1e16, the same as R (0.5000000026596 and 1e16). The comment in ppois1 that mentions 0.4999999987 describes the value before the beyond-2^53 correction of review 54, which is the code below it. (Not pushed yet.)
