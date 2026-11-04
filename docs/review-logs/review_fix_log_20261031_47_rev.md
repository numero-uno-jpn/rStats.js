# Revision of reviews 47 and 52: bounds on the time of the Bessel functions

## Plan
- Intent: where the bounds on the log of the result (review 47's `largeOrder`, `logISeriesBounds`, `logKBounds`) do
  not decide, the Bessel functions run a continued fraction or a recurrence whose length grows with x and the order,
  without a bound (tens of seconds; the J/Y continued fraction stops at its loop limit of 1e8 terms unconverged).
  Criterion K4 (about 10 s at most, a RangeError before the computation).
- Decision: D7 (session 14, `prep/limits.md` question 1, recommended option (a)): the continued fraction x <= 2^25,
  the recurrences J 2^31 steps, Y, I and K 2^28 steps.
- Form: checks only, after every answer that comes at once (the range decisions, the series, the asymptotic and
  Hankel expansions) and before `cf1JY` and the recurrences (`yForward`, J's backward recurrence, `kScaled`). Inside
  the bounds nothing changes.
- RangeError from these functions: the note to K1 (session 14) is about NaN for invalid parameters of distribution
  functions; these are valid arguments and the error is K4's time bound, as the prep recommends.

## Difference from the plan: the continued fraction's measure is x - nu, not x
- Counted with a copy of `cf1JYDD` (session scratchpad `g5_cf.ts`): the terms are about x - nu + O(x^(1/3)) (x = 1e6:
  981102 at nu = 0.02x, 501120 at 0.5x, 11080 at 0.99x, 1062 at nu = x, 245 at 1.01x). The prep's "about x terms"
  holds only for nu much smaller than x.
- A bound on x itself would reject `besselJ(1e8 - 1, 1e8)` (0.5 s; review 52's SPEC-008, recorded only) and every
  call near a turning point above x = 2^25, so the J bound of 2^31 steps (nu about 2e9, the prep's estimate) could
  never be reached. The bound is on x - nu (about 5 to 13 s at 2^25), which rejects a subset of what a bound on x
  would reject, and keeps the prep's values (`besselJ(5e7, 4e7)`, x above 2^25, 1e7 terms, 1.6 s, still answers).

## Original decisions
- Review 47 (SPEC-009): results far out of range at large orders decided by bounds before the recurrences; "where the
  bounds do not decide the time grows with the order; Debye / Airy-type uniform expansions are future work"
  recorded only. Review 52 (SPEC-008, `besselJ(1e8 - 1, 1e8)`, 471 ms): recorded only. No user decision.

## Gap with the current criteria
- K4: no bound on the time.

## Reproduction (main; R 4.5.2 from the prep)
| call | rStats.js before | R |
|---|---|---|
| `besselJ(1e7, 2e5)` (cf1, 9.8e6 terms) | -0.00017683488917586456, 1.6 s | |
| `besselJ(5e7, 4e7)` (cf1, 1e7 terms) | 0.00010221005067009132, 1.6 s | |
| `besselJ(1e8 - 1, 1e8)` (J recurrence) | 0.0009617874113150171, 0.5 s | (prep: 0 with a warning at nu = 1e7) |
| `besselY(3e7 - 1, 3e7)` (Y recurrence) | -0.0025007758459470357, 0.6 s | |
| `besselK(3e9, 3e8, expon.scaled)` (K recurrence) | Infinity, 4.4 s (the stashed run) | |
| `besselJ(1e8, 2e6)` (cf1, 9.8e7 terms) | (prep: 20 to 40 s, up to the loop limit; not run) | |

## Fix
- `src/special/besselJY.ts`: `MAX_CF1_TERMS` 2^25, `MAX_J_STEPS` 2^31, `MAX_Y_STEPS` 2^28 and `checkTime`; in
  `besselJYPos` (which now takes the caller's name and order for the message) before the x <= 2 path (Y's forward
  recurrence) and before `cf1JY` in the x > 2 path (x - nu terms, and nu steps unless Steed's method is applied at
  the order itself, x >= nu > 2; 2^28 where Y is needed). Messages "besselJ: x = ..., nu = ... needs a continued
  fraction of about N terms (at most 2^25)" and "... needs a recurrence of about N steps (at most 2^31)".
- `src/special/besselIK.ts`: `MAX_K_STEPS` 2^28 at the start of `kScaled` (used by I's Wronskian and by K), with the
  caller's name and order passed through `iPos` and `kPos`.
- JSDoc of the four functions; docs (en, ja): a bullet with the limits of session 12 (Hypothesis tests).

## Tests
- `test/rev47.test.ts`: the continued fraction (J, Y, a negative order) and the recurrences (J 3e9, Y 3e8, J of a
  negative non-integer order, I and K 3e8) throw at once (under 100 ms); results decided by the bounds on the log
  still answer; values inside the bounds are the ones before (three points, including x above 2^25 with x - nu below
  2^25). With src stashed the "keeps" tests pass; the K case computed Infinity in 4.4 s (a tsx run); the other
  rejections are not run on the old code (10 s to minutes).
- bessel (fixtures), review47, review52, review53, thresholds pass.

## Out of scope (recorded)
- `cf2JY` stops at 1e6 terms unconverged; at nu = x its terms grow as about 9 x^(1/3) (854 at x = 1e6), so the limit
  is reached near x = 1e15. `cf1IK` likewise stops at 1e6 terms. Not measured further.
