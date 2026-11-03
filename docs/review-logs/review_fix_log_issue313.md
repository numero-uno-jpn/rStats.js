# Issue #313 log: Welch's onewayTest with a group of variance 0

GitHub Issue #313. Session 12, group B (user decision 8).

## Plan

- Intent: in Welch's test (`varEqual: false`, the default) the weight n_i / s_i^2 of a constant group is Infinity, w_i / sum w is NaN, and F, df2 and p were NaN. R's `oneway.test` also gives NaN.
- User decision (2026-11-03): with exactly one constant group (the others with positive variance), return the limit as its variance tends to 0; with two or more constant groups (all groups constant included), a RangeError. The R fixture with one constant group (R NaN) is recorded as `knownDifference`. docs (en, ja).
- The limit: with group z constant, the weighted mean tends to m_z, w_z (m_z - m_w)^2 to 0, (1 - w_i / W)^2 to 0 for i = z and 1 otherwise, so F = sum_{i != z} w_i (m_i - m_z)^2 / ((k - 1)(1 + 2 (k - 2) c)), c = sum_{i != z} 1 / (n_i - 1) / (k^2 - 1), df2 = 1 / (3 c). For k = 2 it is the square of Welch's t, which `t.test` (and `tTest`) return finite for one constant sample. With two constant groups, df2 (and F for equal means) depend on the ratio of the vanishing variances, so there is no limit.

## Reproduction (main `6609ba6`, R 4.5.2)

| data | R `oneway.test` | before | after |
|---|---|---|---|
| [1, 1, 1], [2, 3, 4] (the issue) | NaN (df1 1, df2 NaN) | NaN | F 12, df (1, 2), p 0.07417990022744855 |
| same, R `t.test` (Welch) | t^2 12.000000000000002, df 2, p 0.074179900227448528 | | (tTest the same p) |
| [1, 1, 1], [2, 3, 4], [5, 7, 6, 9] | NaN | NaN | F 23.72807881773399, df2 3.2, p 0.012045598238019806 |
| same with the first group [1 - e, 1, 1 + e], e = 1e-6 (R) | F 23.728078817713804, df2 3.2000000000050104, p 0.0120455982379801 | | (the limit) |
| [1e200 x 3], [2e200, 3e200, 4e200] | | NaN | F 12, df2 2 |
| [1, 1, 1], [2, 2], [2, 3, 4]; [1, 1, 1], [1, 1], [2, 3, 4]; [1, 1, 1], [2, 2, 2] | NaN | NaN | RangeError "Welch's test is not defined with two or more constant groups" |

With `varEqual: true` the code is unchanged (F 12 for the issue's data, R 0x1.8p+3).

## Fix

- `src/htest/onewayTest.ts`, Welch branch: where a group variance is exactly 0 (in the scaled coordinates of `groupMoments`), the limit for one such group, the error for two or more. Data without a zero variance take the old code (the same bits).
- `test/htest-basic.test.ts`: the R suite of onewayTest moved out of the generic loop to record the one fixture with a constant group ([1, 2, 3], [4, 4, 4], R NaN; now F 12, df2 2) as `knownDifference` (3 values).
- docs (en, ja): the limit and the error.

## Tests

- `test/issue313.test.ts`: the issue's data (against `tTest`), three groups (against R's values near the limit), the errors, `varEqual: true` unchanged. With `src/` stashed, three of the four fail.
- `test/htest-basic.test.ts`: passes (onewayTest: 105 R cases, 3 known differences; SciPy 150 cases).

## Out of scope (recorded)

- A positive but tiny variance (subnormal in the scaled coordinates) can still make n / s^2 Infinity and give NaN; that is the variance-underflow type of #393 (user decision 15), not this branch.

## close comment

Fixed in <commit of #313, see git log --grep='#313'>: in Welch's `onewayTest` (the default), a group of variance 0 made its weight n / 0 infinite and every result NaN (R's `oneway.test` the same). With exactly one constant group the result is now the limit as its variance tends to 0: F = sum over the other groups of w_i (m_i - m_z)^2 / ((k - 1)(1 + 2 (k - 2) c)), c = sum 1 / (n_i - 1) / (k^2 - 1) over them, df2 = 1 / (3 c). For [1, 1, 1] and [2, 3, 4] this is F 12, df (1, 2), p 0.0742, the same as Welch's `t.test`/`tTest` on these data; for three groups it is the limit of R's values as the spread of the constant group shrinks. With two or more constant groups the limit depends on how the variances tend to 0, so `onewayTest` now throws "Welch's test is not defined with two or more constant groups". Data without a constant group are unchanged. Recorded in docs/differences-from-r.md.

Test: test/issue313.test.ts. (Not pushed yet.)
