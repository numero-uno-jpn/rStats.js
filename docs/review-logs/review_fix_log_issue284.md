# Issue #284 log: quadeTest counts only complete blocks in b

GitHub Issue #284. Session 12, judging of the issues classified C. Verdict: not planned (R's behaviour is a bug, recorded in docs). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `quadeTest([[1, 2, 3], [2, 4, 3], [NaN, NaN, NaN]])`: F 3, df (2, 2), p 0.25, the same as without the empty block.
- R: `quade.test(rbind(c(1, 2, 3), c(2, 4, 3), c(NA, NA, NA)))` F 2, df (2, 4), p 0.25; without the block F 3, df (2, 2). R keeps the dropped block in b, so the same data give two results.
- docs/differences-from-r.md records this as a bug in R (the `quade.test` row with a missing value): rStats.js tests the complete blocks.

## Fix

- None (not planned).

## Tests

- None (covered by the existing quadeTest tests).

## Out of scope

- None.

## close comment

Not planned: this is deliberate and documented. R's quade.test keeps the dropped blocks in b (B = sum S_j^2 / b, (b - 1) B / (A - B), df (b - 1)(k - 1)), so a block of missing values changes the result: for the issue's matrix R gives F 2 with df (2, 4), but F 3 with df (2, 2) without the empty row. rStats.js tests the complete blocks (F 3, df (2, 2)), the same as for the data without the block; docs/differences-from-r.md lists it as a bug in R. (Not pushed yet.)
