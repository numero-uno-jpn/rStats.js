# Issue #314 log: tTest with a standard error of 0 and mean 0

GitHub Issue #314. Session 12.

## Plan

- Intent: the constant-data guard `stdErr < 10 eps abs(mean)` is `0 < 0` when the data (or the paired differences) are all 0, so the test went on to t = 0 / 0 and NaN results. A test on data without variation has no meaning (policy: input without meaning is an error; review 59 made two constant samples in `varTest` an error).
- Method: `stdErr === 0` is also "data are essentially constant", in the one-sample (and paired) and the two-sample guards. Data with a positive standard error take the old code (the same bits).

## Check (main `3782721`, R 4.5.2)

| call | R's `t.test` | before |
|---|---|---|
| `tTest([0, 0])` | t NaN, df 1, p NaN, interval NaN, stderr 0 | the same |
| `tTest([0, 0], [0, 0])`, also `varEqual` | t NaN, p NaN | the same |
| `tTest([1, 1], [1, 1], { paired: true })` | t NaN, p NaN | the same |
| `tTest([0, 0], { mu: 1 })` | t -Inf, p 0, interval NaN | the same |
| `tTest([5, 5])` | "data are essentially constant" | the same error |

## Fix

- `src/htest/tTest.ts`: `stdErr === 0 ||` in both guards; the header comment and the comment on the interval's NaN ends (no longer reached).
- `docs/differences-from-r.md` and `docs/ja/`: added to "Input that has no meaning is an error".

## Tests

- `test/issue314.test.ts`: the error for zeros (one sample, with `mu`, Welch, equal variances with n = 1, paired) and R's value for `[-1, 1]` (t 0, df 1, p 1). With `src/` stashed, the error test fails.
- `test/ttest.test.ts`: the 43 fixture cases with a standard error of 0 (`c(0, 0, 0)` with and without `c(0, 0, 0, 0)`, and the paired `1:3` vs `1:3`) are recorded with `substitute` as the error.
- `test/errors.test.ts`, `test/formulaTests.test.ts`, `test/htest-basic.test.ts` (with `pairwiseTTest`), scale-invariance tests: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `pairwiseTTest` with `poolSd: false` calls `tTest`, so two groups of zeros now throw there too (R's `pairwise.t.test` gives a NaN p-value for zeros and the same error for other constant groups).

## close comment

Fixed in <commit of #314, see git log --grep='#314'>. `tTest` now treats a standard error of 0 as "data are essentially constant" whatever the mean. The guard compared the standard error with 10 eps times the absolute mean, which is `0 < 0` for samples of zeros or zero paired differences, and the result had t = NaN (or ±Inf with a nonzero `mu`) and NaN p-values and intervals (R's `t.test` does the same). Data with a positive standard error give the same values as before. (Not pushed yet.)
