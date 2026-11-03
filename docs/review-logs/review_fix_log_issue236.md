# Issue #236 log: distSummary("nbinom") with size + mu overflowing

GitHub Issue #236. Session 11, group A3 (distSummary, simple overflows).

## Plan

- Intent: with the mu parameterization, `distSummary("nbinom")` forms p = size / (size + mu). For size = mu = 1e308 the sum overflows, p is 0, the check `p > 0` fails and every moment is NaN, although the distribution is the one with prob = 1/2.
- Method: only where size + mu is not finite, form p as (size / 2) / (size / 2 + mu / 2). Halving is exact for these magnitudes (the larger parameter is above 8.9e307), so p is the correctly rounded ratio as before; the rest of the summary is unchanged. Where the sum is finite the expression is the old one (the same bits). mu = Infinity still gives p = 0 and NaN throughout.
- Why not the double-double route of `fromMu` (negbinomial.ts): that would change the bits of p in the ordinary range; the issue is only the overflow.

## Check (main `6ec8f78`)

distSummary is not an R function (no R value to compare); the references are the closed forms and the equivalent prob parameterization.

| call | before | after |
|---|---|---|
| `nbinom(size 1e308, mu 1e308)` | NaN throughout | mean 1e308, variance Infinity (2e308), sd 1.4142135623730953e154, mode 1e308, skewness 2.1213e-154, kurtosis 6.5e-308, median NaN; identical to `prob: 0.5` |
| `nbinom(size 1.5e308, mu 1.7e308)` | NaN throughout | mean 1.7e308, mode 1.7e308; mean, skewness and kurtosis exactly the values for the parameters divided by 2^10, rescaled; sd within an ulp (from the factors, as the variance overflows) |
| `nbinom(size 1e200, mu 1e200)`, `nbinom(size 1, mu 1e308)` | finite | unchanged |

The median stays NaN: qnbinom returns NaN for quantiles beyond 2^53 (the policy for integers beyond 2^53), as it already did for `prob: 0.5`. The issue asked for a non-NaN median; that would contradict the policy.

## Fix

- `src/distributions/summary.ts`, `case "nbinom"`: p from the halved parameters where size + mu overflows.

## Tests

- `test/issue236.test.ts`: the issue's call (equal to the prob = 1/2 summary), a scale check against the parameters divided by 2^10, and unchanged values where the sum is finite. With `src/` stashed, the first two fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- With mu much smaller than size, q = 1 - p loses digits, so the mean (r q / p) is not mu: `nbinom(size 1e308, mu 1)` has mean 0 and variance 0, `nbinom(size 1e308, mu 1e300)` mean 1.0000000039e300. negbinomial.ts forms p and q in double-double for this reason; distSummary does not. A fix (taking q = mu / (size + mu) directly, or the mean as mu) changes the bits of ordinary values, so it is left as a note.

## close comment

Fixed in <commit of #236, see git log --grep='#236'>: where size + mu overflows, `distSummary("nbinom")` now forms p = size / (size + mu) from the halved parameters (exact at these magnitudes), so `distSummary("nbinom", { size: 1e308, mu: 1e308 })` is the summary for prob = 1/2: mean 1e308, mode 1e308, sd 1.414e154, variance Infinity (2e308 overflows). The median stays NaN, as `qnbinom` returns NaN for quantiles beyond 2^53 (the same for `prob: 0.5`). Values where the sum is finite are unchanged.

Test: test/issue236.test.ts. (Not pushed yet.)
