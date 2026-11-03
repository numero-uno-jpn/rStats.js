# Issue #389 log: propTrendTest with scores far from 1

GitHub Issue #389. Session 12, group A5 (tests).

## Plan

- Intent: `propTrendTest` forms the weighted regression sums sxy and sxx of the proportions on the scores. With scores far from 1, sxx overflows or underflows: scores (0, 1e200) gave sxx = Infinity and the statistic sxy^2 / sxx = 0 with p 1 (the issue expected NaN; the actual result is worse, a wrong finite value), and scores times 2^-700 gave sxx = 0 and the statistic Infinity with p 0.
- Method: the statistic does not change when the scores are multiplied by a constant. Only where sxx is not in [2^-1022, Infinity) or sxy is not finite, the scores of the rows used are divided by the power of 2 that brings the largest into [1, 2) (`scaleToUnit`, exact) and the regression is formed again; the overflow branch for the counts (#50) uses the same scores. Elsewhere the code is the old one (the same bits).

## Check (main after #384, `fc62169`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `propTrendTest([0, 1], [1, 1], [0, 1e200])` (R with 2^664) | X-squared 2.0000000000000004, p 0.1573 | 0, p 1 | 2, p 0.157299207050285 (the value for scores (0, 1)) |
| `propTrendTest([0, 1], [1, 1], [0, 2^-664])` | the same | Infinity, p 0 | the same as (0, 1) |
| `propTrendTest([15, 10, 7], [30, 30, 30], [1, 2, 3] * 2^700)` | 4.655172413793104 | 0 | 4.655172413793106 (the value for (1, 2, 3)) |
| the same times 2^-700 | 4.655172413793104 | Infinity | 4.655172413793106 |

The values for ordinary scores differ from R's lm-based ones by an ulp or two, as before this fix (unchanged). No docs entry: R gives the finite values too.

## Fix

- `src/htest/trendTests.ts`, `propTrendTest`: the regression from the scores divided by a power of 2 where sxx or sxy is out of range.

## Tests

- `test/issue389.test.ts`: the issue's scores, 2^664 and 2^-664, and (1, 2, 3) times 2^700 and 2^-700 against the unscaled values. With `src/` stashed it fails.
- `test/issue50.test.ts`, `issue271`, `issue317`, `issue318`, `issue319`, `moreTests`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #389, see git log --grep='#389'>: where the weighted sum of squares of the scores overflows or underflows (or the cross sum is not finite), `propTrendTest` now forms the regression from the scores divided by a power of 2 (exact; the statistic does not depend on the scale of the scores). `propTrendTest([0, 1], [1, 1], [0, 1e200])` was not NaN but a wrong finite value, statistic 0 with p 1, and scores times 2^-700 gave Infinity with p 0; both now give the value for the unscaled scores (2, p 0.1573; R 4.5.2 the same up to an ulp). Ordinary scores are unchanged. Test: test/issue389.test.ts. (Not pushed yet.)
