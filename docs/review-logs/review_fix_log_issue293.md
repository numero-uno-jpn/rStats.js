# Issue #293 log: formula expansion rejects the power 1

GitHub Issue #293. Session 12, judging of the issues classified C. Verdict: not planned (R gives the same error). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `lm("y ~ (a + b)^1", data)` and `^1.9`: Error "invalid power in formula".
- R: `lm(y ~ (a + b)^1, d)` and `^1.9`: error "invalid power in formula" (terms.formula requires a power of 2 or more). The R fixtures test/fixtures/modelMatrix.json already hold `y ~ A^1`, `y ~ A^0.5` and `y ~ (A + B)^1.5` with this error.

## Fix

- None (not planned).

## Tests

- None (the fixtures cover it).

## Out of scope

- None.

## close comment

Not planned: R gives the same error. In R 4.5.2, lm(y ~ (a + b)^1, d) and lm(y ~ (a + b)^1.9, d) stop with "invalid power in formula"; R's formula expansion requires a power of at least 2. The R fixtures (y ~ A^1, y ~ (A + B)^1.5) check that rStats.js matches. (Not pushed yet.)
