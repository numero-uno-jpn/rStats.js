# Issue #173 log: scoreStatistic's weighted centre when the weights' sum overflows

GitHub Issue #173. Session 11, judging of the issues classified C. Verdict: not planned (the defect is in an internal function and is not reached through the public API). No code changed; a test added.

## Plan

- Intent: check whether `sw += v[i]` and `swr += v[i] * r[i]` in `scoreStatistic` (src/models/glmConfint.ts) can give a NaN centre through the public API.
- Method: `scoreStatistic` is not exported (src/index.ts, src/entries/*.ts). It is reached only through the Rao tests of glmAnova and glmConfint, with a fit's working residuals and weights. Run Gaussian, Poisson and Gamma fits with weights 1e307 and 1e308 through `glmAnova([f0, f1], { test: "Rao" })`, and compare with R.
- Why: a C verdict needs the public API not to reach the defect.

## Check (main `260715b`, R 4.5.2)

The issue's call (`scoreStatistic([[1], [1]], [1, 1], [1e308, 1e308], true)`) gives NaN when the helper is called directly. Through the public API:

- The centre is used only when the smaller model has an intercept. Its fit then satisfies the normal equation sum v r = 0, so the issue's constant nonzero residuals cannot occur, and swr is a sum that cancels.
- For swr to overflow, some v r must exceed about 1.8e308 in size with v at most 1.8e308, so abs(r) > 1 and the term v r^2 overflows too: the smaller model's deviance itself is then Infinity and the Rao statistic is the difference of two overflowing sums (as the deviance column).
- Poisson and Gamma fits with weights 1e308 fail before the test ("no valid set of coefficients has been found: please supply starting values"); R 4.5.2 fails in the same way for the Gaussian fits below.

`y = [0, 3, 3]`, Gaussian, equal weights w, f0 = intercept only, f1 = with x:

| w | x | Resid. Dev (f0) | Rao |
|---|---|---|---|
| 1 | [2, 1, 3] | 6 | 1.7763568394002505e-15 (true 0) |
| 1 | [1, 2, 3] | 6 | 4.499999999999999 |
| 1e307 | [2, 1, 3] | 6e307 | 0 |
| 1e307 | [1, 2, 3] | 6e307 | 4.499999999999998e307 |
| 1e308 | [2, 1, 3] | Infinity | 7.98336123813888e292 (deviance Infinity; rounding of the 6e308 total) |
| 1e308 | [1, 2, 3] | Infinity | Infinity (true 4.5e308 overflows) |

With weights summing to 3e307 the statistic is the weights-1 statistic scaled. No NaN appears; where the weights reach 1e308 the deviance overflows first. R 4.5.2: `glm(y ~ 1, weights = rep(1e308, 3))` stops with "no valid set of coefficients has been found".

## Fix

- None (not planned). If #172's option A is chosen (a guard for a sum of squares that is not finite), the same guard can sum the weights after dividing them by a power of 2, which would also cover the helper's direct call.

## Tests

- `test/issue173.test.ts`: `scoreStatistic` is not in the public API; the Rao statistics above with weights 1 and 1e307 (0 and 4.5 scaled). Passes on the current main (no source changed).

## close comment

Not planned: scoreStatistic is an internal helper, and the overflow of its weighted centre is not reached through the public API. It is called only by the Rao tests of glmAnova and glmConfint, with a fit's working residuals and weights. The centre is used only when the smaller model has an intercept, and then the fit satisfies sum v r = 0, so constant nonzero residuals as in the issue do not occur. For sum v r to overflow, some v r must exceed the double range with v at most 1.8e308, so abs(r) > 1 and v r^2 overflows too: the model's deviance is then Infinity itself. With y = [0, 3, 3] and Gaussian weights 1e307 (sum 3e307), the Rao statistics are 0 and 4.499999999999998e307, the weights-1 values (0 and 4.5) scaled; with weights 1e308 the deviance overflows, and R 4.5.2 cannot fit those models at all ("no valid set of coefficients has been found"). A test was added: test/issue173.test.ts. The related overflow of the squares in #172 is reachable and is handled there. (Not pushed yet.)
