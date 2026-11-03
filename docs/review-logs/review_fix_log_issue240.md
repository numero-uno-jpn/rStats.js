# Issue #240 log: distSummary("weibull") sd 0 and NaN moments for huge shapes

GitHub Issue #240. Session 11, group B (prepared in bprep_2 B2 with #249; decided by the user: the T coordinate for shapes above 100).

## Plan

- Intent: for a shape k, X = E^(1/k) (E ~ Exp(1), scale 1) lies within O(1/k) of 1. The central moments were integrated in x, which cannot resolve that width, and the fallback raw moments Gamma(1 + r/k) round to 1. The issue names k = 1e308 (sd 0, skewness and kurtosis NaN), but the values are already wrong from about k = 1e4: the skewness was -3.03 for -1.139 there, and k = 1e5 gave the kurtosis -16416 for 2.40.
- Method (user's decision, option (a) of the prep): for k > 100 only, integrate in T = k expm1(log(e) / k) = k (X - 1) over the base variable e ~ Exp(1). T has a spread of order 1 for every shape. E[T] comes from dqagse/dqagie, and the central moments from the existing `central()` split where T = E[T]. Then sd = scale (sd_T / k), the variance is sd², and the skewness and kurtosis are those of T. If an integral does not converge, the old route is used. Shapes up to 100 keep the old route and its bits: the old error starts to grow past 1e-14 there (1.8e-14 at k = 100, 4.4e-13 at 1000).
- The helper `expShape(s, w, upper)` takes the shape, the density of the base variable and its upper end, so that #249 (Kumaraswamy, e = b W with W ~ Beta(1, b)) can use it in the next commit.
- The mean (Gamma(1 + 1/k)), median and mode are unchanged.
- distSummary is not an R function, so docs/differences-from-r.md is not changed (as in #34).

## Check (main `c2d7b75`)

References: Rmpfr (12000 bits in the prep, bprep2_b2.R; 4000 bits for 101, 150 and 500) from the raw moments Gamma(1 + r/k). Relative errors:

| k | before: sd, skew, kurt | after: sd, skew, kurt |
|---|---|---|
| 101 | (old route) | 5.6e-16, 3.8e-15, 8.2e-15 |
| 1000 | 4.7e-15, 4.4e-13, 3.0e-13 | 8.9e-16, 2.0e-15, 5.3e-15 |
| 1e4 | 0.2, 1.7 (-3.03), 2.8 | 0, 2.0e-15, 1.6e-14 |
| 1e5 | 3.9e-7, 1.6e-2, 6.8e3 (-16416) | 2.2e-16, 9.8e-15, 9.2e-15 |
| 1e6 to 1e308 | sd 0, NaN, NaN | at most 1.9e-15, 7.4e-15, 2.1e-14 |

- The issue's call, `distSummary("weibull", { shape: 1e308 })`, now gives mean 1, variance 0 (true 1.64e-616), sd 1.2825498301618625e-308 (Rmpfr 1.282549830161865e-308; the sd is subnormal, so only about 2e-15 is available), skewness -1.1395470994046533 and kurtosis 2.400000000000021.
- The scale: shape 1e10 with scale 1e160 gives sd 1.282549829994108e150 and variance 1.6449e300. The variance is sd², so it does not overflow through scale².
- A sweep of 828 shapes from 1e2 to 1e308 gave no NaN or zero sd, at most 6 ms per call, and skewness moving toward the Gumbel limit.
- Shapes up to 100: the fixture's Weibull cases and 20 more (k from 0.3 to 100, scales 1 and 2.5) give the same bits as before.

## Fix

- `src/distributions/summary.ts`: `LARGE_SHAPE = 100` and `expShape()`, plus the route for k > 100 in `case "weibull"`.

## Tests

- `test/issue240.test.ts`: the issue's call, eight shapes from 101 to 1e308 against Rmpfr (sd 5e-15, skewness and kurtosis 5e-14), the scale, and unchanged bits for k = 100, 50 and 3.7. With `src/` stashed, three of the four fail.
- `npx vitest run`: 343 files passed, 1 failed (signrank in distributionProperties, the known timing failure; it passed alone in the previous commit's run). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #240, see git log --grep='#240'>: for shapes above 100, `distSummary("weibull")` now integrates the moments in T = k expm1(log(e) / k) = k (X / scale - 1) over e ~ Exp(1). T has a spread of order 1 whatever the shape, so the quadrature resolves it. `distSummary("weibull", { shape: 1e308 })` now gives sd 1.2825498301618625e-308, skewness -1.1395470994046533 and kurtosis 2.400000000000021 (Rmpfr: 1.282549830161865e-308, -1.1395470994046486, 2.4), with variance 0 (true 1.6e-616). The values were already wrong from about k = 1e4 (skewness -3.03 for -1.139; k = 1e5 kurtosis -16416). From k = 101 to 1e308 the sd is now within 2e-15 of Rmpfr, and the skewness and kurtosis within 2.1e-14. Shapes up to 100 keep their bits.

Test: test/issue240.test.ts. (Not pushed yet.)
