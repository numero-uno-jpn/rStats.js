# Issue #210 log: wilcoxTest ties overflowing differences from mu at Infinity

GitHub Issue #210. Session 11, group A8.

## Plan

- Intent: the signed rank test forms `x - mu` and the rank sum test `x - mu` (against y) by plain subtraction. A finite observation and a finite `mu` of opposite signs can have a difference above `Number.MAX_VALUE`, so distinct differences become Infinity and tie, the exact test is switched off and the statistic and p-value change.
- Method: only where some finite observation gives a non-finite difference, form the differences in half units, `x / 2 - mu / 2`. Such an overflow needs `abs(mu) >= 2^970` (otherwise `x - mu` rounds to at most `Number.MAX_VALUE`), so `mu / 2` is exact, and every half difference is exactly half the rounded difference: for a normal x both halves are exact, and a subnormal x only moves `x / 2 - mu / 2` by far less than the spacing of `mu / 2`. The signs, zeros and order of the absolute values are therefore those of the true differences.
  - One sample (and paired with mu): rank the half differences. The interval is then formed from the observations that differ from mu themselves (adding mu back would overflow again).
  - Two samples: y is not halved (halving merges neighbouring subnormals, e.g. 3 and 4 times 2^-1074, which would change the ties). A comparison-based ranking (`rankSumHalf`) compares a half difference h with y / 2, which is exact except for a subnormal y; there h is 0 (then compared with y itself) or above 2^900 in magnitude, so the order is exact. Infinite values compare as themselves. The "all tied" shortcut is off there (an overflowing difference equals no y).
- Why this: the power of 2 commutes with the rounding, so the result is the test on the true differences, and everywhere the differences are finite the code path and the bits are unchanged (HANDOFF "fallback only where it overflows").
- R gives the tied result (R 4.5.2), so the new value is recorded in docs/differences-from-r.md and docs/ja.

## Check (main `c092d69`)

| call | R 4.5.2 | Before | After | Reference |
|---|---|---|---|---|
| `wilcoxTest([1e308, 1.1e308, 1.2e308], { mu: -1e308 })` | V = 6, p = 0.1489147 (normal approx., ties warning) | the same | V = 6, p = 0.25, exact | `wilcox.test(c(1, 1.1, 1.2), mu = -1)`: V = 6, p = 0.25 |
| same with `confInt: true` | | interval [NaN, NaN] | [1e308, 1.2e308], estimate 1.1e308 | scaled: 1, 1.2, 1.1 |
| `wilcoxTest([1e308, 1.1e308, 1.2e308], [1, 2, 3], { mu: -1e308 })` | W = 9, p = 0.06360257 | the same | W = 9, p = 0.1, exact | `wilcox.test(c(1, 1.1, 1.2), c(1, 2, 3) * 1e-300, mu = -1)`: p = 0x1.999999999999ap-4 |
| `wilcoxTest([1e308, 1.1e308, -1e308], [3 * 2^-1074, 4 * 2^-1074, 0, -1e308, 5], { mu: -1e308 })` | | W = 11.5, p = 0.2909009 | W = 11.5, p = 0.2938258471896372 | the same ties as `wilcox.test(c(2, 2.1, 0), c(3e-300, 4e-300, 0, -1, 5e-200))`: p = 0x1.2ce0aed1988fap-2 (bit equal) |
| `wilcoxTest([1e308], [1e308], { mu: -1e308 })` | | | W = 1 (not tied) | |

## Fix

- `src/htest/wilcoxTest.ts`: `signedRank` and `rankSum` switch to half units where a finite observation's difference from mu is not finite; new `rankSumHalf` (ranks, W, the tie-corrected sigma and whether there are ties, from comparisons of h with y / 2).

## Tests

- `test/issue210.test.ts`: the one-sample example (statistic, p, method, interval, estimate), the two-sample example, subnormal y with x = mu, a single overflowing difference against 1e308, and unchanged results with finite differences and with infinite observations. With `src/` stashed the three tests fail.
- `npx vitest run`: 329 files passed (2739 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The paired test forms `x - y` in `wilcoxTest` before `signedRank`; with finite pairs of opposite signs near 1e308 those differences overflow and tie in the same way (the issue covers the subtraction of mu). Not changed.
- The normal-approximation intervals (`signedRankNormalCI`, `rankSumNormalCI`) shift the data by d with plain subtraction, which can overflow for data spanning both signs near 1e308. Not changed.

## close comment

Fixed in <commit of #210, see git log --grep='#210'>: where a finite observation's difference from `mu` overflows, `wilcoxTest` now forms the differences in half units, `x / 2 - mu / 2`. Such an overflow needs abs(mu) >= 2^970, so each half difference is exactly half the rounded difference and the ranks, signs and zeros are those of the true differences. In the two-sample test, y stays in its own units and is compared with the half differences (halving y would merge neighbouring subnormals). `wilcoxTest([1e308, 1.1e308, 1.2e308], { mu: -1e308 })` now gives V = 6 and the exact p = 0.25 (it gave the normal approximation p = 0.1489 from a three-way tie at Infinity, as R does), and the two-sample form against y = [1, 2, 3] gives W = 9 and the exact p = 0.1. Results where the differences are finite are unchanged. Recorded in docs/differences-from-r.md. The paired differences `x - y` can overflow the same way; noted in the log as out of scope.

Test: test/issue210.test.ts. (Not pushed yet.)
