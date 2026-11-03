# Issue #282 log: exact mantelhaenTest with counts beyond the safe integers

GitHub Issue #282. Session 12, judging of the issues classified C. Verdict: completed (already fixed for #232 by e3279e1). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `mantelhaenTest([[[1e20, 1e20], [1e20, 1e20]], [[1, 1], [1, 1]]], { exact: true })`: RangeError "the exact distribution of S has 200000000000000000000 values, more than 2^24: use exact: false". The check (MAX_SUPPORT = 2^24, added for #232) comes before any allocation, for each stratum and for the convolution.

## Fix

- None (fixed by e3279e1, #232).

## Tests

- None (#232's tests cover the bound).

## Out of scope

- None.

## close comment

Completed: this was fixed by the bound added for #232 (e3279e1). The exact branch now checks the size of the support before allocating it, so the example is a RangeError "the exact distribution of S has 200000000000000000000 values, more than 2^24: use exact: false". (Not pushed yet.)
