# Issue #173 log: scoreStatistic's weighted centre when the weights' sum overflows

GitHub Issue #173. Session 11, judging of the issues classified C. Verdict first: not planned (the defect is in an internal function and is not reached through the public API). Then, with #172's fix (user decision 6), the same guard was extended to the centre: completed (see the follow-up below).

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

## Follow-up (session 11, user decision 6 with #172)

- Intent: user decision 6 chose #172's option A (a guard only where a sum is not finite), and allowed covering #173 with it. The centre cannot be covered by #172's trigger alone (a total that is not finite): with weights [1e308, 1e308] and r = [1e-10, 1e-10] the sum of the weights overflows while swr does not, so the centre was 0 instead of 1e-10 and the statistic a finite 1.8e288 (true -2e287, the weights-1 value -2e-21 scaled).
- Fix: `src/models/glmConfint.ts`, `scoreStatistic`: with an intercept, only where sw or swr is not finite (and the weights are finite), both are summed again from the weights divided by 2^k (2^k at most the largest weight). Finite sums keep their bits; the public API does not reach this branch (above).

| direct call | before | after |
|---|---|---|
| x = [[1], [1]], r = [1, 1], v = [1e308, 1e308] (the issue) | NaN | -8.863311460481781e276 (centre 1; the rounding residue of an exact fit, as -4.9e-32 with weights 1) |
| x = [[1], [2]], r = [1e-10, 1e-10], v = [1e308, 1e308] | 1.8000000000000006e288 | -1.9999999999999978e287 (true -2e287) |
| x = [[1], [2], [3]], r = [1, 3, 2] e-100, v = 2^1022 each | NaN | the weights-1 value times 2^1022, exactly |

- Tests: `test/issue173.test.ts` adds the last row (exact scaling) and the issue's call (finite). With `src/` stashed, the new block fails. The #172 and glmAnova and glmConfint tests pass; `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #173, see git log --grep='#173'>, with the guard of #172. The helper is internal and the overflow of its weighted centre is not reached through glmAnova's or glmConfint's Rao tests (with an intercept the smaller fit satisfies sum v r = 0, and where some v r overflows the deviance overflows too; with y = [0, 3, 3] and Gaussian weights 1e307 the Rao statistics are the weights-1 values scaled). For a direct call, where the sum of the weights or of v r is not finite, both are now summed again from the weights divided by a power of 2; finite sums keep their bits. The issue's call gives a finite value (centre 1, the rounding residue -8.9e276 of an exact fit) instead of NaN, and weights 2^1022 on three rows give exactly the weights-1 statistic times 2^1022. Tests: test/issue173.test.ts. (Not pushed yet.)
