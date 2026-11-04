# Issue #486 log: rbinom with a half-integer size

GitHub Issue #486. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R is wrong; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2.
- Why: classified C (the issue says R rounds the size half to even, so `rbinom(1, 2.5, 1)` is 2 and the current code gives 3).

## Check (main `c7fcff4`, R 4.5.2)

- `rbinom(1, 2.5, 1)`, `rbinom(1, 4.5, 1)`, `rbinom(1, -2.5, 1)`: [NaN] each (not 3 as the issue says: `rbinom1` returns NaN where `Math.round(nin)` differs from the size, so the rounding mode never decides the result).
- R: `rbinom(1, 2.5, 1)`, `rbinom(1, 4.5, 1)`, `rbinom(1, -2.5, 1)`: NA with the warning "NAs produced" (R's rbinom.c returns NaN when the size differs from its rounding). The same result.
- docs/differences-from-r.md (the `qbinom` row) already notes that `dbinom`, `pbinom` and `rbinom` give NaN for a non-integer size.

## Fix

- None.

## Tests

- `test/issue486.test.ts`: NaN for sizes 2.5, 4.5 and −2.5.

## Out of scope

- None.

## close comment

Not planned: rStats.js does as R here. In R 4.5.2, rbinom(1, 2.5, 1) and rbinom(1, 4.5, 1) are NA with the warning "NAs produced" (rbinom returns NaN for a size that is not an integer), not 2 and 4; rStats.js returns NaN for both (not 3), so the rounding mode of the size never decides the result. Added test/issue486.test.ts. (Not pushed yet.)
