# Issue #432 log: rexp with a rate whose reciprocal overflows

GitHub Issue #432. Session 13, judging of the issues classified C. Verdict: not planned (an intentional difference decided in review 48, documented). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the earlier decision.
- Why: classified C (reproduced, but the behaviour is the decision of review 48).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rexp(1, { rate: 5e-309 })`: 1.5103636662566905e308; the next uniform is the 2nd of seed 1 (0.3721): one exponential variate drawn.
- R: `set.seed(1); rexp(1, 5e-309)`: NaN with "NAs produced"; the next uniform is the 1st (0.2655): nothing drawn.
- The report reproduces. The JS value is the exponential variate with rate 5e-309, E / rate.

## Earlier decision

- Review 48 (user decision; `docs/review-logs/review_fix_log_20261031_48.md`, RNG-002): for 0 < rate with 1 / rate = Inf, `expRand() / rate`, one exponential variate per value.
- `docs/differences-from-r.md`, "Where R fails" table: the row "`rexp(n, rate = 1e-310)` (positive rate, 1 / rate overflows)", which states that R draws nothing and rStats.js draws one exponential variate each.
- Tests: `test/review48.test.ts`.

## Fix

- None.

## Tests

- None (test/review48.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. For a positive rate whose reciprocal overflows, rexp returns the exponential variate E / rate (one exponential draw per value), so setSeed(1); rexp(1, { rate: 5e-309 }) gives about 1.51e308 where R returns NaN without drawing. This was decided in an earlier review and is listed in docs/differences-from-r.md (the rexp(n, rate = 1e-310) row of "Where R fails"). (Not pushed yet.)
