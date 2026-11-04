# Revision of reviews 45 and 46: a bound on the time of dwilcox, pwilcox and qwilcox

## Plan
- Intent: Harding's table takes min(m, n) passes over the entries up to the value asked for (the smaller tail, at
  most mn/2), about 10 to 15 ns per entry and pass. The length was bounded (2^25 entries) but not the work: m = n =
  1e5 at q = 1e6 takes about 20 minutes. Criterion K4 (about 10 s at most, a RangeError before the computation; the
  exact tests point to `exact: false`).
- Decision: D7 (session 14, `prep/limits.md` question 1, recommended option (a)): min(m, n) times the table length at
  most 2^29.
- Form: in `buildTable`, after the length check and before any allocation, `m * (J + 1) > 2^29` (m <= n there) is a
  RangeError. `table` doubles the length of a cached table that is too short; the doubling is now capped at the
  largest length within the bound, so that a request within the bound does not fail because of the cache (a table
  beyond the cap took more than 2^29 steps before, so no value inside the bound changes). `wilcoxTest`'s exact
  rank-sum branch (p-value and interval) appends ": use exact: false" to the RangeErrors of the exact distribution
  ("wilcox: ..."), as the prep recommends.
- RangeError from distribution functions: the note to K1 (session 14) is about NaN for invalid parameters; these are
  valid and the error is K4's time bound, as the prep recommends (as for phyper, revision of review 25).

## Original decisions
- Review 45 (DIST-008): mn beyond 2^53 made NaN (which also bounds the passes); review 46: the table ends where its
  entries overflow near the center (a RangeError "cannot be computed accurately"). The time of large tables was not
  bounded; the prep of issue 407 recorded "minutes for a few thousand". No user decision.

## Gap with the current criteria
- K4: no bound on the time.

## Reproduction (main)
| call | rStats.js before |
|---|---|
| `pwilcox(9e4, 600, 600)` | 3.2209170573632217e-54, 0.4 s |
| `dwilcox(5e4, 400, 700, log)` | -185.81796075499884, 0.15 s |
| `qwilcox(1e-30, 500, 2000)` | 336752, 3.0 s (several tables in the search, each within the bound) |
| `pwilcox(1e5, 3000, 3000, log)` (3.0e8 steps) | -3351.0931472532966, 2.8 s |
| `pwilcox(2e5, 3000, 3000, log)` (6.0e8 steps) | -3015.5704888087253, 5.0 s |
| `pwilcox(1e6, 1e5, 1e5)` (1e11 steps) | (prep: about 20 minutes; not run) |
R (prep): `pwilcox(2e4, 200, 200)` 1.5 s (24 ms here); m = n = 400 did not end in 48 s.

## Fix
- `src/distributions/wilcox.ts`: `MAX_WORK` 2^29, the RangeError "wilcox: m = ..., n = ... needs N steps for a table
  of L entries (at most 2^29)" in `buildTable`, the capped doubling in `table`, the `@throws` of the three functions.
- `src/htest/wilcoxTest.ts`: `rankSumExact` around the exact p-value and `rankSumExactCI`.
- Docs (en, ja): a bullet with the limits of session 12 (Hypothesis tests).

## Tests
- `test/rev45.test.ts`: pwilcox (both tails, both orders of m and n), dwilcox and qwilcox beyond the bound throw at
  once (under 100 ms); `wilcoxTest(exact: true)` with 3000 and 3000 values, and 1000 and 3000 ("less"), throws with
  "use exact: false"; values inside the bound are the ones before. With src stashed the "keeps" test passes; the
  first rejection computed in 5.0 s on main (the table above), the others are not run on the old code (minutes).
- wilcox (fixtures), review45, review46, issue407, issue414, rank, random, htest-basic, formulaTests, guide,
  issue102_rev, issue145, issue210, issue37, issue49, locationScaleExtremes, review59, thresholds pass.

## Out of scope (recorded)
- The breakdown near the center of large samples (review 46) is found only while the table is built (m = n = 1000 at
  the center: 4 s, then "cannot be computed accurately"); it is not predicted before.
- `dsignrank`, `psignrank` and `qsignrank` have the same form (a table of at most 2^25 entries, n passes) with no
  bound on the work (`psignrank(1e5, 3000)` 0.3 s; n about 11585 at J about 2^25 would take minutes). Not in D7.
