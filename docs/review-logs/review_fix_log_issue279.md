# Issue #279 log: poissonTest rejects a time base T of 0

GitHub Issue #279. Session 12, judging of the issues classified C. Verdict: not planned (the policy of review 57, recorded in docs). The outdated option comment is corrected; no behaviour changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `poissonTest(0, { T: 0 })`, `poissonTest(1, { T: 0 })`: RangeError "'T' must be positive".
- R: `poisson.test(0, T = 0)` estimate NaN, interval [NaN, Inf], p 1; `poisson.test(1, T = 0)` estimate Inf, interval [Inf, Inf], p 0. A time base of 0 defines no rate.
- Review 57 made this an error ("Inputs without meaning"); docs/differences-from-r.md lists "a time base `T` of 0 in `poissonTest`". The comment beside the check says so, but the doc comment of `PoissonTestOptions.T` still said "nonnegative".

## Fix

- src/htest/poissonTest.ts: the doc comment of `T` now reads "positive and finite (R accepts 0 and returns NaN or Inf; an error here)". Comment only.

## Tests

- None (the error is covered by the tests of review 57).

## Out of scope

- None.

## close comment

Not planned: rejecting a time base of 0 is deliberate (review 57, "input without meaning"): T = 0 defines no rate, and R returns NaN or Inf for the estimate and the interval (poisson.test(1, T = 0): estimate Inf, interval [Inf, Inf]). It is listed in docs/differences-from-r.md. The option's doc comment, which still said "nonnegative", now says positive and finite. (Not pushed yet.)
