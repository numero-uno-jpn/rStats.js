# Issue #418 log: noncentral rbeta(0, 0, ncp = 0)

GitHub Issue #418. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the documented difference.
- Why: classified C (reproduced, but documented as intended, including the extra uniform).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rbeta(1, 0, 0, { ncp: 0 })`: 0; the next uniform is the 2nd of seed 1 (0.3721): one uniform drawn.
- R: `set.seed(1); rbeta(1, 0, 0, ncp = 0)`: NaN; the next uniform is the 1st (0.2655): nothing drawn.
- The report reproduces. Beta(0, 0) is the limit with mass 1/2 at 0 and at 1; R's central `rbeta(n, 0, 0)` draws that 0 or 1, and the noncentral path here does the same.

## Earlier decision

- `docs/differences-from-r.md`, "Where R fails" table: the row "`rbeta(n, 0, 0, ncp = 0)` (and the Poisson-0 component for ncp > 0)": R NaN (0 / 0); rStats.js "0 or 1 with probability 1/2 each (Beta(0, 0)), as the central `rbeta(n, 0, 0)`; one uniform is drawn there, where R draws none".
- Tests: `test/review20.test.ts`.

## Fix

- None.

## Tests

- None (test/review20.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. With shape1 = shape2 = 0 the beta distribution is the limit with mass 1/2 at 0 and at 1, which the central rbeta(n, 0, 0) draws in R as well; the noncentral path with ncp = 0 (and the Poisson-0 component for ncp > 0) returns that 0 or 1 instead of R's 0 / 0 = NaN, drawing one uniform where R draws none. docs/differences-from-r.md lists this, including the extra uniform (the rbeta(n, 0, 0, ncp = 0) row of "Where R fails"). (Not pushed yet.)
