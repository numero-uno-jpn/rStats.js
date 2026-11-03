# Issue #309 log: kappa2 with one complete rating pair

GitHub Issue #309. Session 12.

## Plan

- Intent: `kappa2` rejected an empty set of complete pairs but accepted one. With n = 1 the null variance of kappa is 0, so z = value / sqrt(0) is 0 / 0 and the p-value NaN. `kappamFleiss` and `icc` already require 2 subjects (the policy that input without meaning is an error).
- Method: after the check of no complete pairs, throw a RangeError for fewer than 2 complete pairs. Two or more pairs take the old code (the same bits).

## Check (main `4e94e5b`, R 4.5.2, irr)

| call | irr's `kappa2` | before |
|---|---|---|
| `kappa2([[1, 2]])` (the issue's example), also `"squared"` | kappa 0, z NaN, p NaN | value 0, statistic NaN, pValue NaN |
| `kappa2([[1, 2], [NaN, 1]])` (one complete pair) | the same NaN | the same NaN |
| `kappa2([[1, 2], [2, 1]])` | kappa -1, z -1.41, p 0.157 | -1, -1.414213562373095, 0.15729920705028522 (unchanged) |

## Fix

- `src/htest/agreement.ts`, `kappa2`: "at least 2 complete rating pairs are needed"; the parameter doc says so.
- `docs/differences-from-r.md` and `docs/ja/`: added to the list of input without meaning that is an error (irr returns NaN).

## Tests

- `test/issue309.test.ts`: the error for one complete pair (three weights, with and without a dropped row) and the values for two pairs. With `src/` stashed, the error test fails.
- `test/agreement.test.ts`, `test/review48.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- With 2 or more pairs the null variance can still be 0 (every rating the same category, or `kappa2([[1, 2], [1, 2]])`: kappa 0, z NaN, p NaN in both irr and rStats.js). Not part of this issue (the sample size is valid there); left as it is.

## close comment

Fixed in <commit of #309, see git log --grep='#309'>. `kappa2` now throws a RangeError ("at least 2 complete rating pairs are needed") when fewer than 2 complete pairs remain, as `kappamFleiss` and `icc` require 2 subjects. With one pair the null variance is 0 and z was 0 / 0 (irr's `kappa2` gives the same NaN z and p). Two or more pairs give the same values as before. (Not pushed yet.)
