# Issue #283 log: pivoted chol does not apply tol to the first pivot

GitHub Issue #283. Session 12, judging of the issues classified C. Verdict: not planned (R and LAPACK dpstrf give the same rank). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `chol([[1]], { pivot: true, tol: 2 })`: r [[1]], rank 1; `chol([[1, 0], [0, 0.5]], { pivot: true, tol: 2 })`: rank 1.
- R: `chol(matrix(1), pivot = TRUE, tol = 2)` gives 1 with rank 1, and `chol(diag(c(1, 0.5)), pivot = TRUE, tol = 2)` rank 1. LAPACK's dpstrf, which R calls, also factors the first pivot and only compares later pivots with the tolerance (its first check is that the largest diagonal is positive).

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: this is how LAPACK's dpstrf works, and R's chol(pivot = TRUE) gives the same: chol(matrix(1), pivot = TRUE, tol = 2) has rank 1, and chol(diag(c(1, 0.5)), pivot = TRUE, tol = 2) rank 1. dpstrf only stops on the first pivot if it is not positive, and compares the later pivots with the tolerance; rStats.js follows it. (Not pushed yet.)
