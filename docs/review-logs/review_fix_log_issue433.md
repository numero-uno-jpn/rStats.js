# Issue #433 log: rnbinom with an overflowing gamma scale (1 - p) / p

GitHub Issue #433. Session 13, judging of the issues classified C. Verdict: not planned (an intentional difference decided in review 50, documented). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the earlier decision.
- Why: classified C (reproduced, but the behaviour is the decision of review 50; the same as issue 431).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rnbinom(1, 1, { prob: 5e-309 })`: 3.1028271314468052e307; the next uniform is the 6th of seed 1 (0.8984).
- R: `set.seed(1); rnbinom(1, 1, prob = 5e-309)`: NA with "NAs produced"; the next uniform is the 1st (0.2655).
- The report reproduces. The JS value is the negative binomial draw: the unit gamma variate times (1 - p), divided by p.

## Earlier decision

- Review 50 (user decision; `docs/review-logs/review_fix_log_20261031_50.md`, RNG-004): where the scale overflows, `poissonOfGamma` forms (g (1 - p)) / p from a unit gamma variate g (mu version (g mu) / size); Infinity only where the mean itself overflows.
- `docs/differences-from-r.md`, "Where R fails" table: the row "`rgeom(n, 1e-309)`, `rnbinom(n, 1, prob = 1e-309)`, `rnbinom(n, 0.5, mu = 1e308)`".
- Tests: `test/review50.test.ts`.

## Fix

- None.

## Tests

- None (test/review50.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. Where the gamma scale (1 - prob) / prob overflows, rnbinom draws a unit-scale gamma variate g and forms the Poisson mean as (g (1 - prob)) / prob, so setSeed(1); rnbinom(1, 1, { prob: 5e-309 }) gives about 3.1e307 instead of R's NA; the stream departs from R's only at such a call. This was decided in an earlier review and is listed in docs/differences-from-r.md (the rnbinom(n, 1, prob = 1e-309) row of "Where R fails"). (Not pushed yet.)
