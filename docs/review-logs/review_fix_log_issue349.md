# Issue #349 log: a given dispersion lost in the scaled units of the glm

GitHub Issue #349. Session 12, group A7 (glm deviance fallbacks: #371, #372, #373, #375; #349).

## Plan

- Intent: gaussian (identity) fits are computed on the response divided by 2^k (`scaledView`). A dispersion given by the user was converted to those units as ldexp(d, -2k) in one step. For y = 1e308 (k = 1023) that is 0 not only for the issue's `Number.MIN_VALUE` but for dispersion 1 (worse than the issue says): glmSummary gave dispersion 0 and standard errors 0, glmPredict 0, glmRstandard and glmCooksDistance NaN, glmAnova Cp 0. For y of 1e-300 it overflowed (standard errors Infinity). Even y = (1, 3, 2, 5) has k = 2, so dispersion `Number.MIN_VALUE` underflowed there too, and dispersion 1e300 with y = 1e308 came back as 1.000000019953926e300 (rounded through the subnormals).
- Method (the common rule: normalize only where needed, the same bits elsewhere): `scaledDispersion(d, k)` returns m 4^s. Where d 2^-2k is 0 for d = 0 or in the normal range, m = d 2^-2k and s = 0 (the old value). Otherwise m is d brought to [1, 4) by an even power of 2, 4^h, and s = h - k. The five consumers apply the powers of 2 to their results: glmSummary (standard errors sqrt(inv m) 2^(s + k - e), statistics, covScaled, and the dispersion reported as given), glmRstandard (2^-s), glmCooksDistance (4^-s), glmPredict (standard errors brought back by 2^(k + s)), glmAnova (chi-squared and F statistics 4^-s; Cp formed in the original units as R's residual deviance + 2 (n - residual df) d). `ldexpWide` where the exponent can pass 2046. With s = 0 every expression is the old one.
- Why not always carry the pair: in range the old expressions are kept bit for bit without having to argue that a reordered product rounds the same.

## Reproduction (main after #375, R 4.5.2)

x = 0:3, gaussian. R cannot fit y = 1e308 ("non-finite coefficients"); R's values below are from y = 2^996, and the standard errors with a given dispersion depend only on X.

| call | R | before | after |
|---|---|---|---|
| y = 1e308, `glmSummary(dispersion: 1)` | dispersion 1, se 0.8366600265340756, 0.4472135954999579 | dispersion 0, se 0, 0, statistic Inf, NaN | R's values; statistic 1.1952286093343936e308, 0 |
| same, `glmPredict` se | 0.83666, 0.54772, 0.54772, 0.83666 | 0, 0, 0, 0 | R's bits |
| same, `glmRstandard`, `glmCooksDistance` | NaN (rstandard ignores the dispersion), 0 | NaN, NaN | 0, 0 |
| same, `glmAnova(test: "Cp")` | 2, 4 | 0, 0 | 2, 4 |
| y = (1, 2, 1.5, 3) 1e-300, dispersion 1 | se as above, Cp 2, 4 | se Inf, Cp Inf | R's values |
| y = 1e308, dispersion `Number.MIN_VALUE` (the issue) | se 2^-537, 0 (sqrt of the rounded subnormal products) | dispersion 0, se 0 | dispersion 5e-324, se sqrt(0.7) 2^-537, sqrt(0.2) 2^-537 |
| y = (1, 3, 2, 5), dispersion `Number.MIN_VALUE` | se 2^-537, 0; predict se 0 | se 0; rstandard NaN | se as above; predict sqrt(0.7) 2^-537 ... |
| y = 1e308, dispersion 1e300 | | dispersion 1.000000019953926e300, se 8.366600229539744e149 | 1e300, 8.366600265340756e149 |

Where the scaled dispersion was in range (y = (1, 3, 2, 5) with dispersions 1, 1e300, 1e-300; y = 1e-300 with 1e-300 and `MIN_VALUE`) every value has the old bits.

## Cause

`ldexp(checkDispersion(options.dispersion), -2 * k)` in glmSummary, glmRstandard, glmCooksDistance, glmPredict and glmAnova.

## Fix

- `src/models/glm.ts`: `scaledDispersion`; its use in the four functions.
- `src/models/glmAnova.ts`: the shift passed to `glmAnovaScaled`; Cp in the original units where the shift is not 0.

## Tests

- `test/issue349.test.ts`: dispersion 1 with y = 1e308 and y of 1e-300 (all five functions), the issue's `Number.MIN_VALUE`, unchanged bits in range. With `src/` stashed, the first two blocks fail.
- glm, glmAnova and the related issue and review tests (`issue159`, `169`, `175`, `176`, `188`, `review32`, `63`, `64`, `scaleInvarianceModels`): pass, fixtures unchanged. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- Cook's distance with y = (1, 3, 2, 5) and dispersion `Number.MIN_VALUE` is NaN: the true distances (about 2^1069) overflow, and overflowing distances are NaN by the existing rule (R NaN too).

## close comment

Fixed in <commit of #349, see git log --grep='#349'>. A given dispersion is now held as m 4^s wherever its value in the scaled fit's units (d 2^-2k) is out of range, and glmSummary, glmPredict, glmRstandard, glmCooksDistance and glmAnova apply the powers of 2 to their results. This was wider than reported: with y = 1e308 even dispersion 1 gave dispersion 0 and standard errors 0; now dispersion 1, standard errors 0.8366600265340756 and 0.4472135954999579 (R's values on the same X), and the issue's `Number.MIN_VALUE` gives sqrt(0.7) 2^-537 and sqrt(0.2) 2^-537 (R 2^-537 and 0). Where the scaled dispersion is in range the values are unchanged. Test: `test/issue349.test.ts`. (Not pushed yet.)
