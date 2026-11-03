# Issue #342 log: mauchlyTest with one tested dimension

GitHub Issue #342. Session 12, group A5 (tests).

## Plan

- Intent: `mauchlyTest` rejected only pp = 0 tested dimensions. With pp = 1 (one measurement, two measurements with X = ~1, or M one dimension larger than X), sphericity holds whatever the data: W is identically 1 and the chi-squared df pp (pp + 1) / 2 - 1 is 0. The function returned W 1 and p 1, a test with nothing to test.
- Method: a RangeError "one tested dimension: sphericity holds trivially and the test has no degrees of freedom", next to the pp = 0 check. This follows the policy that a test with no defined degrees of freedom is an error (as the pp = 0 and n < pp checks here). `aovEz` computes Mauchly's test only for p >= 2 already and is unchanged.
- This departs from R (W 1, p 1), so docs (en, ja) gain a row, and the one R fixture case with pp = 1 is recorded as rejected.

## Check (main after #389, `1114427`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `mauchlyTest([[1], [2], [4], [8]])` | (R needs an mlm; with M = diag(3), X = diag(3)[, 1:2]: W 1, p 1) | W 1, p 1 | RangeError |
| 15 x 2 data with `X: "~1"` (fixture case 9) | W 1, p 1 | W 1, p 1 | RangeError |
| 4 x 3 data with `X: "~1"` (pp = 2) | W 0.47639, p 0.4764 | W 0.47638962579195404 | the same |

## Fix

- `src/models/mauchly.ts`: the pp = 1 check.
- docs (en, ja): a row next to the one for too few residual degrees of freedom.

## Tests

- `test/issue342.test.ts`: both pp = 1 calls throw; pp = 2 unchanged. With `src/` stashed the first test fails.
- `test/mauchlyTest.test.ts`: fixture case 9 (two measurements, X = ~1; R W 1, p 1) is now expected to throw (`REJECTED`, 1 R fixture case of 10 changed); the test "rejects an X that is not inside M" used M = ~W, X = ~V (pp = 1) as an X inside M that does not throw, and now expects the pp = 1 error instead of the subspace error.
- `test/review32.test.ts`, `review38`, `scaleInvariance`, `scaleInvarianceAll`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #342, see git log --grep='#342'>: `mauchlyTest` now throws a RangeError ("one tested dimension: sphericity holds trivially and the test has no degrees of freedom") where the tested contrast space has one dimension, as it does for zero dimensions. There W is 1 whatever the data and the chi-squared df is 0; it returned W 1 and p 1, as R's `mauchly.test` does (recorded in docs/differences-from-r.md). Two or more dimensions are unchanged; `aovEz` already tests sphericity only for two or more. Test: test/issue342.test.ts. (Not pushed yet.)
