# Issue #168 log: glm working weights that overflow or underflow on the way (with #159, #165, #166, #167)

GitHub Issues #168, #159, #165, #166 and #167 share one cause and one fix; this is the main log (the logs of the other four refer to it). Checked overnight (scratchpad notes, group A); on the morning of 2026-11-03 the user chose option A1. The plan was approved.

## Plan

- Intent: `irls` formed the working weight as `sqrt(w * muEta^2 / V(mu))`, with muEta^2 and V made separately. They overflow or underflow although the weight itself is in range:
  - muEta^2 overflows: the log link beyond mu = 1.34e154 (Poisson, #168); the inverse link's muEta = -1/eta^2 itself overflows for eta near 1e-308 (Gamma, #159)
  - V = mu^3 overflows or underflows (inverse.gaussian, #165: Inf/Inf = NaN; #166: V = 0 and the error "0s in V(mu)")
  - muEta^2 falls to 0 (#167: a weight of 1e-320 became 0)
  - The weighted sum of the response in the null model's mean overflowed (y = (1e308, 1e308); the weights alone were divided by a power of 2, review 64)
- Method (A1): the links whose muEta is c mu^a (identity c 1 a 0, log 1 1, inverse -1 2, sqrt 2 0.5, 1/mu^2 -0.5 3, power(lambda) 1/lambda 1 - lambda) carry `muPower`, the variance functions mu^p (gaussian 0, poisson 1, Gamma 2, inverse.gaussian 3 and the quasi ones) carry `varPower` (`src/models/glmFamily.ts`). Only where a part of the direct form (muEta^2, V, w muEta^2) or the result is outside the normal range:
  - the weight is sqrt(w) abs(c) mu^((2a - p)/2) (`sqrtWeight`)
  - the working residual (y - mu)/muEta, where muEta is not finite or below the normal range, is ((y - mu)/c)/h/h with h = mu^(a/2) (`workingResidual`)
  - the Pearson residual, where V is out of range or the result is not finite, is ((y - mu)/h) sqrt(w)/h with h = mu^(p/4) (`pearsonResidual`)
  - "0s in V(mu)" is not raised where V = mu^p underflowed for a positive mean
  - the null model's weighted mean divides the response by a power of 2 too where the weighted sum overflows
  - Elsewhere the same expressions as before, so the same bits.
- Why: user decision (A1). It follows the common rule "normalise only when needed". A2 (carrying sqrt(W) through the summary so that a W beyond the doubles still gives standard errors) was judged too large for the narrow cases it serves.
- Change from the overnight prototype: the prototype also reordered the binomial links (logit, probit, ...) to sqrt(w) (abs(muEta)/sqrt(V)). That broke `test/issue169.test.ts` (added after the prototype): with prior weights 1e300 and up, the binomial fit starts at mu = 1 (eta = Inf), where the mean is clamped to 1 - 2^-53 so V is far above mu (1 - mu) while muEta keeps falling. R's form gives those rows the weight 0 (muEta^2 underflows); the reordered form gave them a weight and the working response Infinity, and the fit stopped with "non-finite coefficients at iteration 1". The binomial links and the binomial variance therefore keep R's form (no `varPower` for mu(1 - mu)). None of the five issues uses them.

## Check (main `86b6c76`; R 4.5.2; true values from the overnight notes, Rmpfr)

| Case | R 4.5.2 | Before | After | True |
|---|---|---|---|---|
| #168 poisson, y = (1e308, 1e308) ~ 1 | "NA/NaN/Inf in 'x'" | "the matrix contains NaN or infinite values" (from 1e160 on) | coefficient 709.196208642166, null deviance 0, converged | log(1e308) = 709.1962086421661, null 0 |
| poisson, y = (1.5e308, 1e308) ~ 1 (the weighted sum 2.5e308 overflows) | | error | null deviance = deviance at the mean 1.25e308 | |
| #159 Gamma (inverse), y = (1e308, 1e308) ~ 1 | "NA/NaN/Inf in 'x'" | "the matrix contains NaN or infinite values" (from 1e160 on) | coefficient 9.999999999999994e-309, converged; W = mu^2 = Inf, dispersion and se NaN | 1e-308 (subnormal) |
| Gamma (inverse), y = s (1, 2, 3) ~ x, s = 1e160, 1e200 | "NA/NaN/Inf in 'x'" | error | the fit of y/s with the coefficients divided by s (relative 1e-12) | |
| #165 inverse.gaussian (log), 1 row, offset log(1e200) | weights, deviance, null NaN | NaN | W = 9.99999999999978e-201 (= 1/mu), deviance 4.88e-228 | W = 1/mu |
| inverse.gaussian (log), y = (1e200, 2e200) ~ x | "NA/NaN/Inf in 'x'" | error | (460.51701859880916, 0.6931471805599251), converged | (log 1e200, log 2) |
| #166 inverse.gaussian (log), y = (1e-200, 1e-200) ~ x | converged with fitted 2.2e-16 (eps clamp), deviance 2e200: wrong | "0s in V(mu)" | fitted 9.99999999999978e-201, converged (warning "step size truncated due to increasing deviance") | fitted 1e-200 |
| #167 poisson, y = 0, offset log(1e-320) | fitted and weight 2.2e-16 (clamp): wrong | weight 0 | weight 1e-320 | 1e-320 |

- The fitted 9.99999999999978e-201 (#165, #166) is exp(eta) with eta = ±460.5, good to an ulp of eta (5.7e-14 relative).
- The glm fixture (154 cases): coefficients, fitted values, deviance, null deviance, AIC, working weights, working, deviance and Pearson residuals, iterations, convergence, standard errors and warnings are bit for bit the same as before (dump of every case before and after, 0 values changed).
- R fails or is wrong in every case, so a row was added to the "R fails" table of docs/differences-from-r.md (and docs/ja).

## Fix

- `src/models/glmFamily.ts`: `muPower` on `LinkFunctions` (identity, log, inverse, sqrt, 1/mu^2, power where 1/lambda is finite), `varPower` on `Family` (gaussian, poisson, quasipoisson, Gamma, inverse.gaussian, quasi "constant", "mu", "mu^2", "mu^3")
- `src/models/glm.ts`: `sqrtWeight`, `workingResidual`, `pearsonResidual`; irls (the empty model, every iteration, the final working residuals), the check "0s in V(mu)", the null model's mean, `residualsOf(..., "pearson")`
- docs (en, ja): one row in the "R fails" table

## Tests

- `test/issue168.test.ts` (y = 1e308 and the overflowing weighted sum; the bits of an ordinary Poisson fit's weights, residuals and null deviance from before), `test/issue159.test.ts`, `test/issue165.test.ts`, `test/issue166.test.ts`, `test/issue167.test.ts`. With src stashed, 8 of the 9 tests fail (the bits test passes).
- Whole suite `npx vitest run`: 283 files, 2612 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## Recorded as out of scope

- #159: where the working weight itself is beyond the doubles (Gamma on the inverse link with mu > 1.34e154: W = mu^2; the 1/mu^2 link), the fit goes through but W is Inf, and the quantities made from W (the dispersion sum W r^2, the standard errors, rstandard, Cook's distance, Rao's score) are NaN. Option A2 (carry sqrt(W)) was not chosen.
- #130's log noted that the poisson and Gamma glm with x near 1e308 (x = (1e308, 5e307, 3e307, 8e307), y = (1, 3, 2, 4)) fail before the QR. This fix does not change that: the weights are moderate (about 2.75), but sqrt(W) x overflows the model matrix. Poisson still stops with "non-finite coefficients at iteration 1" at (0, 0), Gamma with "the matrix contains NaN or infinite values". The fit of x / 2^1000 gives poisson (1.0930885747615884, -2.96e-8 x 2^-1000) and Gamma (0.3302811020615591, 1.186e-8 x 2^-1000). Handling it needs a common 2^-k on sqrt(W) x with the covariance scaled back (part of A2).
- Perfect fits of very large or small responses can end unconverged with "inner loop 3; cannot correct step size": #168 with 1e160 (y = (1e160, 1e160) ~ 1), poisson y = (1e150, 2e150) ~ x (also before the fix; R converges), inverse.gaussian y = (1e-110, 2e-110) ~ x. The 61st review's halving rule reacts to the rounding noise of a deviance near 0 (point E of the overnight notes; deviance cancellation is #161-#163, the rest is recorded in review_fix_log_issue161.md).
- The deviance of #159's fit is -1.7e-16 and of #168's -1.96e292 (the cancellation of #161-#163, fixed separately).

## close comment

Fixed in <commit of #168, see git log --grep='#168'>: the working weight sqrt(w muEta^2 / V(mu)) was formed from muEta^2 and V separately, which overflowed for a Poisson mean beyond 1.34e154 on the log link, so glm(y ~ 1, poisson) with y = (1e308, 1e308) stopped in the least squares step (R: "NA/NaN/Inf in 'x'"), and the null model's weighted sum of the response overflowed as well. Where muEta^2, V or w muEta^2 is outside the normal range, the weight is now sqrt(w) |c| mu^((2a - p)/2) from muEta = c mu^a and V = mu^p (identity, log, inverse, sqrt, 1/mu^2 and power links; variances 1, mu, mu^2, mu^3), and the working and Pearson residuals likewise; the null model's mean divides the response by a power of 2 where its weighted sum overflows. The example now gives the coefficient 709.196208642166 (log 1e308) with null deviance 0. Elsewhere the bits are unchanged (all 154 glm fixture cases). The same change fixes #159, #165, #166 and #167. Recorded in docs/differences-from-r.md. Tests: test/issue168.test.ts and the tests of those issues. (Not pushed yet.)
