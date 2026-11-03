# Issue #301 log: jointDenDF overflows when averaging equal huge degrees of freedom

GitHub Issue #301. Session 12, judging of the issues classified C. Verdict: not planned (internal; not reached through the public API). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `jointDenDF` is exported from src/models/lmerTest.ts for the tests only; it is not in src/index.ts or the mixed entry. Its caller is the joint F-test of lmerAnova and lmerContest, with the Satterthwaite df of the rotated contrasts, nu = 2 d^2 / (g' A g).
- The sum overflows only when the equal df (equal within the absolute tolerance 1e-8, so at that size exactly equal) are each above about 9e307. Satterthwaite df are of the order of the number of observations: a balanced 3-level within-group factor gave denDF 9 with 12 rows and 5997 with 6000 rows. No fit with df near 1e308 was found. Infinite df (g = 0) are handled separately (review 28).

## Fix

- None (not planned).

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: jointDenDF is an internal helper (exported from its module only for the tests, not from the package). Its inputs are Satterthwaite degrees of freedom of a lmer fit, which are of the order of the number of observations (5997 for 6000 rows in a balanced design); the sum overflows only for equal df above about 9e307, which no fit produces. Equal infinite df are already handled. (Not pushed yet.)
