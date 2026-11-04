# Revision of review 25: bounds on the time of phyper and qhyper

## Plan
- Intent: the tail sums of `phyper` step through the support one value at a time, about 9 standard deviations sigma
  per tail, so a large sigma runs for tens of seconds (m = n = k = 1e15, sigma 1.1e7: about 40 s), and `qhyper`
  calls the distribution function a few times in its search. Criterion K4 (about 10 s at most, a RangeError before
  the computation).
- Decision: D7 (session 14, `prep/limits.md` question 1, recommended option (a)): phyper's estimated number of terms
  at most 2^26, qhyper's sigma at most 2^21.
- Form: in `phyper1`, after every answer that needs no sum (NaN, the binomial limit, the ends of the support, beyond
  2^53), the terms are estimated from the normal approximation: about sqrt(u^2 + 83 sigma^2) - u for a tail starting
  u past the mean (83 = 120 ln 2, where the terms fall below 2^-60 of the sum), at most the distance to the end of
  the support, and both tails where the start is within 1 of the mean (the only place the first tail can exceed 1/2
  and `phyperRaw` sums the other one too). In `qhyper1`, after the boundaries and before the search, sigma (the
  expression already there, now shared as `hyperVariance`, same bits). Inside the bounds nothing changes.
- RangeError from distribution functions: the note to K1 (session 14) says distribution functions return NaN for
  invalid parameters; these parameters are valid and the error is K4's time bound, as the prep recommends (the same
  as `pwilcox`'s "cannot be computed accurately" RangeError).

## Original decision
- Review 25: supports beyond 2^53 made NaN (K7); "below 2^53 the time grows as sqrt(m + n), as R's" recorded only.
  No user decision.

## Gap with the current criteria
- K4: no bound on the time.

## Reproduction (main; R 4.5.2)
| call (m = n = k = M) | rStats.js before | R |
|---|---|---|
| `phyper(M/2 - sqrt M, M, M, M)`, M = 1e10 / 1e12 / 1e13 | 36 ms / 426 ms / 885 ms | (prep: 1e12 in 30 ms, 0.0023388778240069490 for 0.002338877824030954) |
| `phyper(M/2, M, M, M)`, M = 1e13 | 0.5000001784124118, 1.3 s (both tails, about 2.0e7 terms, 65 ns each) | 0x1.000005fc64d77p-1 (0.5000001783941305), 0.11 s |
| `phyper(M/2, M, M, M)`, M = 1e15 | (prep and review 25: about 40 s at sigma 3.5e7; not run) | 0x1.000000979f235p-1, 1.0 s |
| `qhyper(0.3, M, M, M)`, M = 1e13; `qhyper(0.5, 1.8e13, ...)` (sigma 1.5e6) | 2.5 s; 3.6 s | (prep: proportional to M, 0.7 s at 1e7) |
| `qhyper(0.3, 4e13, 4e13, 4e13)` (sigma 2.24e6) | 4.3 s (the stashed run of the new test) | |

Term counts of a double copy of the `tailSum` loop against the estimate (sigma 350 to 3.5e4, z from -12 to 30,
skewed and symmetric parameters, 900 points, session scratchpad `g4_e3.ts`): count / estimate from 0.49 (the start
within about 1 of the mean, where both tails are counted but only one is summed) to 1.013 (far tails). The first
tail exceeded 1/2 only with the start at most 0.17 from the mean.

## Fix
- `src/distributions/hypergeometric.ts`: `phyperTerms` / `tailTerms` and the RangeError "phyper: m = ..., n = ...,
  k = ... needs about N terms at q = ... (at most 2^26)"; in `qhyper1` "qhyper: m = ..., n = ..., k = ... has a
  standard deviation of about S (at most 2^21)".
- `src/random/hyper.ts`: `rhyper`'s inversion through `qhyper1` (parameters beyond 2147483647) passes
  `limitTime = false`, so that `rhyper` is unchanged (not in the decision; see Out of scope).
- Docs (en, ja): a bullet with the limits of session 12 (Hypothesis tests); the review 25 bullet's "about 40 s at
  1e16" replaced by a pointer to it; the "Where R fails" row `qhyper(0.5, 1e15, 1e15, 1e15)` (now a RangeError)
  replaced by `qhyper(0.5, 1e13, 1e13, 1e13)` (2.5 s; R's search takes days there).

## Tests
- `test/rev25.test.ts`: phyper at the center of 1e15 and at z = -2.7 and 2.7 (sigma 1.1e7), with log and upper
  tail, and in a vector, throw at once (under 100 ms); qhyper at 1e15 and 4e13 throws at once; the ends of the
  support, p = 0 and 1, the binomial limit and a far tail (z = -1000, about 5e5 terms) still answer; values inside the
  bounds are the ones before (M = 1e10). The qhyper case at 4e13 fails with src stashed (4.3 s, no error); the others
  are not run on the old code (40 s or more).
- hyper (fixtures), fisher, random, review25, review18, review55, review58, issue118, issue145, issue232, issue237,
  issue278, issue286, issue336, issue410, audit, errors, jstat-replacement, locationScaleExtremes, thresholds pass.

## Out of scope (recorded)
- `rhyper` with parameters beyond 2147483647 inverts `qhyper1` per draw and keeps its time (about 5 s per draw at
  sigma 2^21, more beyond): a bound there would make a random generator throw, which D7 did not cover.
