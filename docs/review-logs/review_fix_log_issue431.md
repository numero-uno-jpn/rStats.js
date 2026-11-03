# Issue #431 log: rgeom with overflowing odds (1 - p) / p

GitHub Issue #431. Session 13, judging of the issues classified C. Verdict: not planned (an intentional difference decided in review 50, documented). No code changed.

## Plan

- Intent: run the issue's call on the current main through the public API and in R 4.5.2, and compare with the earlier decision.
- Why: classified C (reproduced, but the behaviour is the decision of review 50).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rgeom(1, 5e-309)`: 1.5103636662566905e308; the next uniform is the 4th of seed 1 (0.9082), i.e. the exponential variate and the Poisson step's draws were made.
- R: `set.seed(1); rgeom(1, 5e-309)`: NA with "NAs produced"; the next uniform is the 2nd (0.3721).
- The report reproduces. The variate is the geometric draw beyond R's overflow: (1 - p) / p overflows, but E (1 - p) / p does not.

## Earlier decision

- Review 50 (user decision; `docs/review-logs/review_fix_log_20261031_50.md`, RNG-003'): where (1 - p) / p overflows, the mean is formed as (E (1 - p)) / p after the exponential draw; Infinity only where the mean itself overflows.
- `docs/differences-from-r.md`, "Where R fails" table: the row "`rgeom(n, 1e-309)`, `rnbinom(n, 1, prob = 1e-309)`, `rnbinom(n, 0.5, mu = 1e308)`", which also says the Poisson draws are made and the stream departs from R's only there.
- Tests: `test/review50.test.ts`.

## Fix

- None.

## Tests

- None (test/review50.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. Where (1 - prob) / prob overflows, rgeom draws the exponential variate first and forms the Poisson mean as (E (1 - prob)) / prob, so setSeed(1); rgeom(1, 5e-309) gives about 1.51e308 instead of R's NA; the Poisson step's draws are made, so the stream departs from R's only at such a call. This was decided in an earlier review and is listed in docs/differences-from-r.md (the rgeom(n, 1e-309) row of "Where R fails"). (Not pushed yet.)
