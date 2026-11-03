# Issue #179 log: glmConfint at a very small confidence level

GitHub Issue #179. Session 11, group B (user decision 2, B4: the series cutoff and the interpolated inverse profile, only where the cutoff is below 2^-9).

## Plan

- Intent: `glmConfint(fit, { level: 1e-20 })` gives [0, 0] (as R) and level 1e-10 a wrong, asymmetric interval. Two causes: (1) the cutoff qnorm((1 + level) / 2) is formed after 1 + level, which rounds to 1 below 1.1e-16 (the issue's point); (2), the main one, the profile z(b) = sign(b - b_j) sqrt((D(b) - D) / phi) comes from a difference of deviances of order 1, so its relative error is about epsilon D / z^2 and for z near 1e-10 the root search solves noise. Fixing only the cutoff would turn [0, 0] at 1e-20 into noise.
- Method (the user's decision): where the cutoff c is below C0 = 2^-9 (level below about 1.558e-3), c = sqrt(pi / 2) L (1 + pi L^2 / 12 + 7 pi^2 L^4 / 480) (the series of sqrt(2) erfinv(L); the next term is below 2e-18 relative there), and the limits come from the inverse profile b(z): the degree-4 polynomial through (0, b_j) and the limits at z = -2 C0, -C0, C0, 2 C0, which the existing root search finds accurately, evaluated at -c and c. The root search was moved into a helper `limitAt` used by both paths; where c >= 2^-9 the computation is the old one (the same bits).
- Why: correct limits (about 1e-10 relative) at every small level, while the ordinary levels keep their bits. The rejected options (an error for small levels, the cutoff only, record only) are in bprep_1.md B4.

## Check (main `39934f7`)

References: Rmpfr (300 bits) from the closed forms of the profiles of intercept-only fits: binomial y = 0, 1, 0, 1 (estimate 0, se 1; limits ±2 acosh(exp(c^2 / 8))) and Poisson y = 1, 2, 3, 4 (estimate log 2.5; limits solve 20 (e^t - 1 - t) = c^2).

| fit, level | before | after | exact | R 4.5.2 `confint` |
|---|---|---|---|---|
| binomial, 1e-20 | [0, 0] | ±1.253314137344808e-20 | ±1.2533141373155002e-20 | [0, 0] |
| binomial, 1e-10 | [-7.171538713092311e-10, 1.4901156845969152e-8] | ±1.253314137344808e-10 | ±1.2533141373155003e-10 | ±1.2535e-10 (`0x1.13a336p-33`, 1.6e-4 relative) |
| binomial, 1e-7 | [-1.24714e-7, 1.24672e-7] | ±1.2533141373448116e-7 | ±1.2533141373155039e-7 | |
| binomial, 1e-5 | [-1.2533153e-5, 1.2533124e-5] | ±1.2533141373817e-5 | ±1.2533141373524135e-5 | ±1.25345e-5 |
| binomial, 1.5e-3 | upper 0.0018799724517282075 | 0.0018799724518225808 | 0.0018799724517936234 | |
| Poisson, 1e-10 | [0.9162907318068814, 0.9162907318918782] | [0.9162907318345218, 0.9162907319137884] | [0.91629073183452179, 0.91629073191378834] | [0.91628353079258176, 0.91628353087160104] |
| Poisson, 1e-20 | [0.9162907318741551, 0.9162907318741551] | the same (log 2.5) | log 2.5 ± 1e-20 | |

The relative error after the fix is at most 2.3e-11 for the binomial fit from 1e-300 to 1.5e-3 (the interpolation error, not double precision). The score test (`test: "Rao"`) gives ±1.2533141374171114e-20 at 1e-20 (8e-11 relative; its profile agrees with the likelihood ratio's to order b^2).

Unchanged bits: 160 calls (binomial, Poisson, a two-coefficient Poisson, the doc example, a gaussian fit; LRT and Rao; 16 levels from 1e-300 to 0.999999) before and after: every level from 1.56e-3 up gives the same bits; 1.55e-3 and below differ (scratchpad fix21_cmp.mts).

R: 1 + level rounds to 1 at 1e-20 (limits 0), and its spline through the profile grid is 1.6e-4 relative off at 1e-10 and 1.1e-4 at 1e-5. Documented in docs/differences-from-r.md and docs/ja/differences-from-r.md (the `glmConfint` entry).

## Fix

- `src/models/glmConfint.ts`: the series cutoff and the interpolated inverse profile where the cutoff is below 2^-9; the root search in `limitAt`.

Behavior note: in the small-level path a limit at ±C0 or ±2 C0 that is NaN (an unconverged restricted fit, or a profile that does not reach 2^-8) makes both limits NaN, as all five points enter the polynomial. Before, each side was NaN only for its own failure; a fit whose profile does not reach z = 2^-8 within 2^30 standard errors on one side is not expected.

## Tests

- `test/issue179.test.ts`: binomial and Poisson at 1e-20, 1e-10, 1e-5 and 1.5e-3 against the Rmpfr values (1e-10 relative; Poisson 1e-15 absolute at 1e-10); the score test at 1e-20; levels 0.0016, 0.01 and 0.95 equal to the old bits. With `src/` stashed, the first three fail.
- `npx vitest run`: 356 files passed (2826 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None found.

## close comment

Fixed in <commit of #179, see git log --grep='#179'>: at a very small confidence level (the cutoff below 2^-9, level below about 1.6e-3) `glmConfint` now forms the cutoff from the series of sqrt(2) erfinv(level) instead of qnorm((1 + level) / 2), and the limits from the inverse profile interpolated through the limits at z = 0, ±2^-9 and ±2^-8. Fixing the cutoff alone was not enough: the profile z comes from a difference of deviances, which cannot resolve z much below 1e-3, so at level 1e-10 the old result was [-7.2e-10, 1.5e-8] for ±1.2533e-10. For the issue's fit, level 1e-20 now gives ±1.253314137344808e-20 (exact 1.2533141373155002e-20, 2.3e-11 relative), and 1e-10 ±1.253314137344808e-10; R gives [0, 0] at 1e-20 and ±1.2535e-10 at 1e-10. Levels from about 1.6e-3 up give the same bits as before. Documented in docs/differences-from-r.md.

Test: test/issue179.test.ts. (Not pushed yet.)
