# Issue #415 log: rlogis with a negative scale

GitHub Issue #415. Session 13, judging of the issues classified C. Verdict: not planned (an intentional difference decided in review 19, documented). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the earlier decision.
- Why: classified C (reproduced, but the behaviour is the decision of review 19).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rlogis(1, { location: 0, scale: -1 })`: NaN; the next uniform is the 2nd of seed 1 (0.3721): the uniform R draws is drawn.
- R: `set.seed(1); rlogis(1, 0, -1)`: 1.0175307312461772; the next uniform is the same 2nd one.
- The value differs as reported; the stream is R's. A negative scale defines no distribution: `dlogis`, `plogis` and `qlogis` give NaN for it, here and in R.

## Earlier decision

- Review 19 (`docs/review-logs/review_fix_log_20261031_19.md`): `rlogis(2, 0, -1)` made NaN, drawing R's uniforms; also applied in issue 92's log.
- `docs/differences-from-r.md`, "Random generators with parameters that define no distribution": "`rlogis` with a negative scale. The uniforms R draws are drawn as well, so the stream after the call is R's."
- Tests: `test/review19.test.ts`.

## Fix

- None.

## Tests

- None (test/review19.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. A negative scale defines no logistic distribution (dlogis, plogis and qlogis give NaN for it, in R too), so rlogis returns NaN for it; it still draws the uniform R draws, so the stream after the call is R's (setSeed(1); rlogis(1, { location: 0, scale: -1 }) followed by runif(1) matches R 4.5.2). It is listed in docs/differences-from-r.md under "Random generators with parameters that define no distribution". (Not pushed yet.)
