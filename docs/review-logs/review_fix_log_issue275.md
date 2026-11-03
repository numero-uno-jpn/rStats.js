# Issue #275 log: qansariExact accepts fractional sample sizes

GitHub Issue #275. Session 12, judging of the issues classified C. Verdict: not planned (internal helper; the public API never calls it). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `qansariExact` is not exported (`"qansariExact" in api` is false). Its only callers are the R reference tests (test/htest-core/ansari.test.ts). `ansariTest` uses `pansariExact` and `qansariR`, and checks m and n itself (`checkAnsariExactSize`); its sample sizes are lengths of arrays, so always integers.

## Fix

- None (not planned).

## Tests

- None (fixture tests of the helper exist: test/htest-core/ansari.test.ts).

## Out of scope

- None.

## close comment

Not planned: qansariExact is an internal helper (src/htest/core/ansari.ts) that is not exported and is not called by any public function; ansariTest uses pansariExact and qansariR with m and n taken from the lengths of the samples, so a fractional sample size cannot reach it. (Not pushed yet.)
