# Issue #161 log: cancellation in the binomial, poisson and Gamma deviances near y = mu (with #162, #163)

GitHub Issues #161 (binomial), #162 (poisson) and #163 (Gamma) share one cause and one fix; this is the main log. Checked overnight (scratchpad notes, group B); on the morning of 2026-11-03 the user chose option B2 (bd0 forms where abs(t) < 0.1), and for point E (below) to record it only. The plan was approved.

## Plan

- Intent: near y = mu the first-order terms of the deviance contributions cancel: poisson y log(y/mu) - (y - mu), binomial the sum of the two logarithms, Gamma -log(y/mu) + (y - mu)/mu. The direct forms lose about 2 eps / abs(t) relative (t = (y - mu)/mu): at t = 2^-52 the sign or a factor of 2 to 4 (the issues' examples), at t = 1e-3 about 1e-10 (R the same).
- Method (B2): where abs(y - mu) < 0.1 mu,
  - poisson, quasipoisson, quasi "mu": 2 w bd0(y, mu) (`src/special/loader.ts`, double-double)
  - Gamma, quasi "mu^2": -2 w log1pmx(t)
  - binomial, quasibinomial, quasi "mu(1-mu)" (where abs(y - mu) < 0.1 min(mu, 1 - mu)): 2 w (bd0(y, mu) + bd0(1 - y, 1 - mu)), the second term as (1 - mu)(s log1p(s) + log1pmx(s)) with s = (mu - y)/(1 - mu) (`bd0Shift`)
  - Beyond 10% the direct forms, with R's bits.
- Why: user decision (B2). The threshold 0.1 is the form of R's own switch to bd0 in dpois_raw and dbinom_raw (abs(x - np) < 0.1 (x + np)). B3 (2^-10) left 1e-13 errors just outside; B1 (clamp at 0) left #163 wrong; B4 (always) changes far more bits.
- Change from the overnight prototype: the binomial's second term. bd0(1 - y, 1 - mu) takes 1 - y rounded for y < 1/2 (1 - 0.3 is 5.6e-17 off), which is 1.1e-13 relative of the deviance at y = 0.3, mu = 0.3003 (the prototype gave 4.284083249570526e-7, true 4.2840832495710015e-7). mu - y is exact there (Sterbenz), so the term is formed from it. The quasi families "mu" and "mu^2" (the same formulas, not in the prototype) are included as the plan says.

## Check (main `e2d2de4`; R 4.5.2; true values Rmpfr 300 bits on the doubles)

| Contribution (w = 1) | R 4.5.2 | Before | After | True |
|---|---|---|---|---|
| #161 binomial (0.5, 0.5 + 2^-52) | -9.8607613152626481e-32 | -1.9721522630525295e-31 | 1.9721522630525295e-31 | 1.9721522630525295e-31 |
| #162 poisson (1, 1 + 2^-52) | 0 | -9.860761315262648e-32 | 4.930380657631323e-32 | 4.9303806576313231e-32 |
| #163 Gamma (1, 1 + 2^-52) | 9.8607613152626481e-32 | 1.9721522630525295e-31 | 4.930380657631322e-32 | 4.9303806576313223e-32 |
| poisson (1000, 1001) | 0.0009993338330014367 | the same | 0.0009993338329336663 | 0.00099933383293366638 |
| Gamma (1000, 1001) | 9.986681650006428e-7 | the same | 9.986681650683315e-7 | 9.9866816506833162e-7 |
| binomial (0.3, 0.3003) | 4.2840832491838204e-7 | the same | 4.2840832495710013e-7 | 4.2840832495710014632e-7 |

- Sweep against Rmpfr (1199 random points with abs(t) between 1e-13 and 0.1, mu from 1e-3 to 1e6, binomial mu in (0.001, 0.999)): the new forms are within 2.7 ulp (binomial), 0.8 (poisson), 1.8 (Gamma).
- The same values for quasibinomial, quasipoisson and quasi "mu(1-mu)", "mu", "mu^2".
- The glm fixture (154 cases): 69 cases change in the deviance residuals, 21 in the deviance, 8 in the null deviance and 1 in the AIC (512 values; median 1.6e-14 relative, 98% below 8.8e-11; the 8 above 1e-8 are the rounding residue of the perfect fit of cases 108 and 109, poisson and quasipoisson, whose deviance -2.19e-21 is now 2.19e-21 and residual -2.1e-8 now -1.5e-15). These are the 59 cases of the overnight prototype plus the 10 quasi "mu" and "mu^2" cases. Coefficients, fitted values, weights, iterations, convergence, standard errors and warnings are unchanged. The fixture test (R, relative 1e-12) passes without new known differences.
- `test/issue160.test.ts` (the previous commit) recorded the bits of the coefficients of the binomial fit of the totals (1e300, 1e300), (1e300, 2e300); its deviance was -1.48e269 and is now 0 (R 0), and the last bits of the coefficients moved (now (8.4e-17, -0.6931471805599454)). The test now checks the logits 0 and -log 2 to 1e-15.
- R is off as much as the direct forms, so a row was added to "Where R is inaccurate" in docs/differences-from-r.md (and docs/ja).

## Fix

- `src/models/glmFamily.ts`: `nearMean`, `gammaNear`, `poissonDev`, `bd0Shift`; `binomialDev`, the poisson and Gamma families' contributions and quasi "mu", "mu^2"
- docs (en, ja): one row in "Where R is inaccurate"

## Tests

- `test/issue161.test.ts`, `test/issue162.test.ts`, `test/issue163.test.ts`: the contributions above for every family that uses each form, against Rmpfr (relative 4e-16), and contributions beyond 10% with their bits from before. With src stashed, the three near-the-mean tests fail and the bits tests pass.
- Whole suite `npx vitest run`: 287 files, 2620 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## Recorded as out of scope

- **Point E (user decision: record only).** The 61st review's halving rule ((dev - devold)/(0.1 + abs(dev)) >= max(epsilon, 1e-10)) reacts to the rounding noise of a deviance near 0 in perfect fits of large values: the true deviance itself moves from iteration to iteration with the rounding of mu = exp(eta), and the rule takes a noise increase for an increase, halves, and ends with "inner loop 3; cannot correct step size". It is not fixed by the deviance forms. Poisson y = (10^k, 2 10^k) ~ x after this fix: k = 6 and 12 converge, k = 20 and 40 do not (k = 40 converged before, with a negative deviance -4.8e24), k = 80 and 150 converge with "step size truncated due to increasing deviance", k = 160 does not. Also #168's y = (1e160, 1e160) ~ 1 and inverse.gaussian y = (1e-110, 2e-110) ~ x (review_fix_log_issue168.md). R's rule on the relative change fails on the same noise (k = 12 and 80 unconverged in R 4.5.2). A remedy would be a floor for the rise, such as 16 eps times the sum of the absolute values of the terms of the contributions; that changes glm2's rule and was not prototyped.
- Beyond 10% the direct forms are not within 20 ulp everywhere, as the overnight notes said. A sweep against Rmpfr with abs(t) from 0.1 to 0.4 gives up to 87 ulp (poisson) and 85 ulp (Gamma) just above 0.1. For the binomial, where mu is near 0 or 1 and y is within 10% of one of mu and 1 - mu but not of the other, the direct form is off by up to about 2000 ulp (y = 0.008065, mu = 0.006400: t = 0.26, (y - mu)/(1 - mu) = 0.0017), from the rounding of the logarithm of the near ratio and of 1 - y. R the same. Options: the bd0 form wherever either side is within 10%, or always (B4, more bits change).
- The binomial contribution of y = 0 with a tiny mu is 0 (1 - mu rounds to 1; true 2 mu, 2e-20 for mu = 1e-20; R 0). log1p(-mu) would fix it, but it changes the bits of every y = 0 and y = 1 row, so it is left for a decision.

## close comment

Fixed in <commit of #161, see git log --grep='#161'>: near y = mu the first-order terms of the binomial deviance cancel, so binomial()$dev.resids(0.5, 0.5 + 2^-52, 1) was -1.97e-31 (R -9.86e-32) and the contributions at t = (y - mu)/mu = 1e-3 were about 1e-10 off (R the same). Where abs(y - mu) < 0.1 min(mu, 1 - mu), the contribution is now 2 w (bd0(y, mu) + bd0(1 - y, 1 - mu)), the second term formed from the exact difference mu - y, as R's dbinom_raw switches to bd0 on the same kind of test; the example gives 1.9721522630525295e-31 (the Rmpfr value) and (0.3, 0.3003) gives 4.2840832495710013e-7 (true 4.2840832495710015e-7; was 9e-11 off). The same for quasibinomial and quasi with variance "mu(1-mu)"; poisson (#162) and Gamma (#163) are fixed in the same commit. Beyond 10% R's form and bits are kept. In the glm fixture the deviances and deviance residuals of 69 cases change in their last digits (all within the tolerance against R). Recorded in docs/differences-from-r.md. Test: test/issue161.test.ts. Recorded for later: the step-halving rule's reaction to rounding noise in perfect fits of large values, and the accuracy of the direct forms just beyond 10%. (Not pushed yet.)
