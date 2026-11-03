# Issue #393 log: one scale for all groups loses a small group's variation

GitHub Issue #393. Session 12, group B (user decision 15).

## Plan

- Intent: `groupMoments` and `scaleToUnit` divide all groups by one power of 2 (that of the largest value), so a small group's variance or deviations fall below the normal range and become 0 or subnormal: `onewayTest` (Welch), `varTest` and `leveneTest` then gave NaN, a wrong error, or NaN. The same root as #270 (`bartlettTest`).
- User decision (2026-11-03): a fallback of the #270 form in the three places, only where the variation falls below the normal range on the common scale; elsewhere the same bits.
  - `varTest`: where either common-scale variance is below 2^-1022, each sample on its own scale 2^-k, ratio (v_x / v_y) 2^(2 (k_x - k_y)).
  - `leveneTest`: where a group's common-scale deviations are subnormal, or all 0 for a group that is not constant, each group's deviations on its own scale, then all on the scale of the largest deviation, before `aov`.
  - `onewayTest` (Welch): where a common-scale variance is below 2^-1022 and no group is constant on its own scale, the pairwise form F = sum_{i<j} w_i w_j (m_i - m_j)^2 / sum w / ((k - 1)(1 + 2 (k - 2) c)), with 1 - w_i / sum w as the sum of the other weights over sum w.
- Applied to today's main: since #313, a group whose common-scale variance is exactly 0 takes the constant-group limit. The fallback is tested first (its own-scale variances are all positive), so the #313 branch keeps the groups that are truly constant.
- Own judgment within the plan: the prep's prototype carried the Welch weights in logs (relative error about 1e-13). On today's main the issue's first example already gives the exact F 1 through the #313 limit, and the log form would move it to 1.0000000000000568. So the weights and terms are carried as a mantissa and a power of 2 instead (no logs): F 1 stays exact, and the other examples agree with the exact values to an ulp or two. `ldexpWide` (v 2^k in steps of 2^1000, for exponents beyond the +-2046 of `ldexp`) is added to `src/internal/summary.ts` and used by `varTest` and `onewayTest`.

## Reproduction (main `e00654a`, R 4.5.2, car)

| call | before | R | exact | after |
|---|---|---|---|---|
| `onewayTest([[0, 1e-100], [0, 1e100]])` | F 1, df (1, 1), p 0.5 (the #313 limit) | 1, (1, 1), 0.5 | about 1 | the same |
| `onewayTest([[1e200, 2e200], [0, 1e-100], [5, 7]])` | RangeError "two or more constant groups" | F NaN, df2 1.333, p NaN | F 15, df2 4/3 | F 15, df2 1.3333333333333333 |
| `onewayTest([[1, 3, 2], [5, 9, 6], [0, 1e-160, 3e-160]])` | | | 17.107692307692307, 2.6666666666666665 | 17.10769230769231, 2.6666666666666665 |
| `varTest([1e308, 1e308], [0, 1e-100])` | RangeError "both samples have zero variance" | F Inf, p 0 | ratio 0 | F 0, p 0, estimate 0 |
| `varTest([1, 2], [0, 1e-100])` | 1e200 | 1e200 | | unchanged |
| `leveneTest([1e308, 1e308, 0, 1e-100], A A B B)` | F NaN | F 6.21e31, p 1.61e-32 | F Inf (deviations 0 in A only) | F Inf, p 0 |

The exact values are from Python `Fraction` on the doubles.

## Fix

- `src/htest/onewayTest.ts`: the fallback branch before the #313 one, `ownScaleMoments`, `splitPow2`.
- `src/htest/varTest.ts` (`varTest`), `src/htest/leveneTest.ts`: the fallbacks.
- `src/internal/summary.ts`: `ldexpWide`.
- docs (en, ja): a row in "Where R is inaccurate".

## Tests

- `test/issue393.test.ts`: the examples above. With `src/` stashed, the four tests of changed values fail (the first `onewayTest` example and the unchanged `varTest` value pass, as they should).
- `formulaTests`, `htest-basic`, `issue313`, `issue44`, `moreTests`, `review58`, `review59`, `scaleInvariance`, `scaleInvarianceAll`, `issue270`: pass (the R and scipy fixtures are unchanged).

## Out of scope (recorded)

- `onewayTest` (Welch) with one truly constant group and another whose variance underflows on the common scale (`[[1e308, 1e308], [0, 1e-100], [5, 7]]`) still throws "two or more constant groups": the #313 limit would need the other weights on their own scales too.
- `flignerTest` and `gamesHowellTest` share the root (recorded under #270); not in this issue.

## close comment

Fixed in <commit of #393, see git log --grep='#393'>: where a group's variance or deviations fall below the normal range on the common scale, `onewayTest` (Welch), `varTest` and `leveneTest` now compute each group on its own scale, as `bartlettTest` does since #270. `onewayTest([[1e200, 2e200], [0, 1e-100], [5, 7]])` threw "two or more constant groups" (R NaN) and now gives F 15, df2 4/3; `varTest([1e308, 1e308], [0, 1e-100])` threw "both samples have zero variance" (R F Inf) and now gives the ratio 0; `leveneTest([1e308, 1e308, 0, 1e-100], ["A", "A", "B", "B"])` gave F NaN (car 6.2e31) and now F Inf, p 0. The issue's first example, `onewayTest([[0, 1e-100], [0, 1e100]])`, already gave F 1, df (1, 1), p 0.5 since #313, and still does. Other data keep the same bits (the fixtures are unchanged). Recorded in docs/differences-from-r.md.

Test: test/issue393.test.ts. (Not pushed yet.)
