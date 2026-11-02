# Differences from R

English | [日本語](ja/differences-from-r.md)

rStats.js aims to return the same results as R. This page lists the cases where it does not,
either because R itself is inaccurate or fails there, or because rStats.js deliberately behaves
differently. In the tests these cases are marked `knownDifference` with a reason (see
`test/helpers/suite.ts` and the individual test files). How cases are compared is described in
[accuracy.md](accuracy.md).

## Where R is inaccurate and rStats.js is closer to the truth

When a test case does not match R, it is compared with a high-precision reference value
computed with Rmpfr (256 to 1300 bits) or gmp (exact rationals). If rStats.js matches the
reference, the case passes as "more accurate than R".

### Distributions

- **Far tails** (probabilities around 1e-200 to 1e-300): R is often off by about 1e-13 in
  relative terms; rStats.js computes the exponent in double-double arithmetic and stays near
  1e-15.
- **Large parameters** (shape around 1e5): R's `pbeta`, `dbeta` and `pgamma` can be off by
  1e-13 to 1e-11. `plnorm`/`dlnorm` with, for example, meanlog = 700 and sdlog = 20 are off by
  about 1e-13.
- **Non-central distributions:** R computes only the lower tail and returns 1 − (lower tail)
  for the upper one, so upper tails are lost below an absolute error of about 1e-10. R's
  non-central t switches to an approximation for |ncp| > 37.62, `pf` switches to a chi-squared
  approximation for df2 > 1e8 (relative error about 1e-9), and the non-central `qt` and
  `qchisq` invert with low accuracy and are cut off in the tails. With `ncp = 0`, R's F
  distribution uses the non-central algorithm and loses accuracy (e.g.
  `pf(1e5, 4, 5, ncp = 0, lower.tail = FALSE)` is off by 4e-5); rStats.js returns values as
  accurate as the central distribution for `ncp: 0` (edge cases follow R's non-central
  behaviour).
- **Signed rank and rank sum:** R's `dsignrank`/`psignrank` are off by about 1e-14 for n = 500
  and 1000; for n = 1100 the central `dsignrank` is Inf and `psignrank(1000, 1100)` is 0 (truth
  2.27e-308). `dwilcox(·, 200, 200)` is off by 1.4e-14 throughout.
- **Studentized range:** R's `ptukey` is accurate to about 8 digits and `qtukey` to about 4;
  upper tails below 1e-15 become 0. For large df (such as 1e5) R returns the df = ∞ value;
  rStats.js computes the value for the given df.

| Call | R | Truth (Rmpfr) | rStats.js |
|---|---|---|---|
| `dgamma(110000.00000000001, 1e5)` | 2.4166502895221053e-207 | 2.4166502895188551e-207 | 2.416650289518855e-207 |
| `pgamma(1e-100, 3, lower.tail = FALSE, log.p = TRUE)` | -1.6666666666665175e-301 | -1.6666666666666667e-301 | -1.666666666666667e-301 |
| `pbeta(0.99, 1e5, 100)` | 4.127552829240118e-296 | 4.1275528292396704e-296 | 4.1275528292396705e-296 |
| `pnbinom(1e5, 1e-10, 0.001, lower.tail = FALSE)` | 3.5003255336351424e-56 | 3.5003255336350864e-56 | 3.500325533635079e-56 |
| `pnbinom(1e8, 10, mu = 1e6, lower.tail = FALSE, log.p = TRUE)` | -879.62 | -950.61809786317 | -950.6180978631712 |
| `phyper(0, 3, 1e6, 2, log.p = TRUE)` | -5.999993999861e-6 | -5.999994000011999976e-6 | same as truth |
| `ptukey(30, 3, 10, lower.tail = FALSE)` | 2.880e-9 | 3.3124453334e-9 | same as truth |
| `ptukey(3, 1000, 10)` | 0 | 1.3584e-5 | same as truth |
| `ptukey(0.5, 20, 2)` | 0 | 3.427e-8 | same as truth |
| `qtukey(0.999, 3, 2)` | 42.41 (`ptukey` of it gives 0.99797) | | 60.418 |
| `qtukey(-20, 10, 10, log.p = TRUE)` | 4.05e-5 | | 0.2084 |
| `pchisq(1000, 5, ncp = 10, lower.tail = FALSE)` | 1.64e-180 | 1.7925e-176 | same as truth |
| `pbeta(1 - 1e-10, 2, 3, ncp = 1, lower.tail = FALSE)` | 1.7e-10 | 7.52e-30 | same as truth |
| `pt(-1, 5, ncp = 10)` | 0 | 1.3248e-26 | same as truth |
| `pt(1, 5, ncp = 40)` | 1.009e-303 | 1.0887e-287 | same as truth |
| `pt(1, 1e-300, ncp = 1e4)` | 0 | 3.3623538933995988e-298 (mpmath) | 3.362353893399793e-298 |
| `pt(1, 10, ncp = 1e9, log.p = TRUE)` | -4.7619047526190466e17 | -4.5454545454545440e17 (Rmpfr) | same as truth |
| `dt(1, 10, ncp = 1e9, log = TRUE)` | -Inf | -4.5454545454545436e17 (Rmpfr) | same as truth |
| `qt(1e-300, 1e-300, ncp = 1e4)` | 18961.503816218225 | 2.4637413705646497e-146 (mpmath) | 2.463741370564455e-146 |
| `qt(1e-300, 1e-100, ncp = 1e4)` | 1.8961503816217974e104 | 3.3196830107614348e-48 (mpmath) | 3.3196830107614347e-48 |
| `dchisq(1e4, 5, ncp = 10, log = TRUE)` | -2975.1 | -4688.08 | same as truth |
| `dchisq(1e-300, 0, ncp = 1)` | 0 | 0.1516 | same as truth |
| `df(1e10, 5, Inf, ncp = 0, log = TRUE)` | -1.25e11 | -2.5e10 | same as truth |
| `qchisq(-1e10, 5, ncp = 1, lower.tail = FALSE, log.p = TRUE)` | 2.29e10 | 2.00e10 (checked with the distribution function) | same as truth |
| `dbeta(1.05e-231, 0.194, 141.1, ncp = 1.39e-303)` (a noncentral density at a tiny ncp) | 9.3999238814454927e185 | 9.399923881445698e185 (mpmath) | same as truth (the central density) |
| `df(2.86e-257, 0.0275, 3, ncp = 5e-324)` | 1.3617011778446392e251 | 1.3617011778446561e251 (mpmath) | 1.3617011778446567e251 (the central density) |
| `qf(1.89e-13, 0.0885, 6.01e302)` | 4.6113445353195029e-287 | 4.6113445353197333e-287 (mpmath, the χ² limit) | 4.611344535319733e-287 |
| `pbeta(0.973, 0.130, 8.15e-322, log.p = TRUE)` | -736.93128475074695 | -736.93155014878607 (mpmath) | same as truth |
| `dchisq(1.005e-308, 294.4, ncp = 2.91e304, log = TRUE)` | -1.0243631212370614e307 | -1.4537765239560228e304 (−λ/2; the rest is of order 1e5) | same as truth |
| `dnorm(-1.59e-321, sd = 3e-323)` | 0 | 5.2576630112522621e-304 (mpmath) | 5.257663011252932e-304 (as truth for x / sd rounded, as in the log density) |
| `dcauchy(-2.16543841389836e-309, scale = 1.57817263326e-312)` | 1.0713040120126725e305 | 1.0713040120123239e305 (mpmath) | same as truth |
| `dcauchy(1e-10, scale = 5e-324)` | 0 | 1.5726597949504821e-304 (mpmath) | same as truth |
| `log(dlogis(-3.5667197e-316, scale = 4.81926e-319))` | -7.1442431635500565 | -7.1442419008923714 (mpmath) | same as truth |
| `dnbinom(57, 3.941094207e-315, 0.1246, log = TRUE)` | -735.57086040999684 | -735.57086038617797 (mpmath) | same as truth |
| `qexp(-720.6156070081367, 7.378938265185878e-258, log.p = TRUE)` | 1.4880736486358194e-56 | 1.4880736486357560e-56 (mpmath) | 1.4880736486357558e-56 |
| `qweibull(-720.6156070081367, 1, 1.3552e257, log.p = TRUE)` | 1.4880642941554512e-56 | 1.4880642941553880e-56 (mpmath) | same as truth |

### Special functions

The comparison values for these come from mpmath (100 to 800 digits) rather than Rmpfr.

- **`choose` and `lchoose`** with a non-integer n and large k: R is off by up to 2.6e-10
  (`choose(10.3, 1e5)`).
- **`choose`** with small k near overflow: R multiplies n by (n - 1)/2 and so on, two roundings per step, and
  `choose(1.5e154, 2)` is 1.125e308, 0.91 ulp from the exact value; rStats.js gives 1.1250000000000002e308 (0.09
  ulp), from the product in double-double (taken in the coordinates n / 2^s where it overflows on the way).
- **`factorial`** near overflow: `factorial(170)` is off by 1.2e-13 in R.
- **`dmultinom`** with large counts: R sums `lgamma` values and loses digits (2.8e-6 relative for
  a count of 1e9; rStats.js multiplies binomial probabilities).
- **`digamma`, `trigamma`, `psigamma`** for large negative x (`trigamma(-100000.25)` is off by
  1.2e-11), near the positive zero of digamma and for very large x (`trigamma(1e300)` by 2.4e-14).
- **Bessel functions** for large x or order: R is off by 1e-13 to 1e-11 at many points and far off
  at some (see the next section).

### Discrete quantiles with p extremely close to 1

For calls such as `qpois(0.999999999999999, 1e5)`, where 1 − p is below 1e-12, R compares
distribution-function values close to 1, and the rounding of 1 − (small value) shifts the answer
by a few units. rStats.js compares the small probabilities of the opposite tail and is not
affected.

### Hypothesis tests

| Case | R | rStats.js |
|---|---|---|
| Variance and correlation of data with a large mean and small spread (1e8 + noise of 1e-3) | variance off by 1.4e-11, `cor` by 2e-10 | sums in double-double |
| Variance of values around 1e200 | squares overflow: variance Inf, t = 0, p = 1 | deviations rescaled by powers of two; finite result |
| Correlation of values around 1e-200 | underflow, NA | finite result (as above) |
| `fisher.test` (2 x 2) and `mantelhaen.test(exact = TRUE)`: the conditional MLE and the confidence limits | uniroot on psi in [0, 1] or 1/psi in [eps, 1] with the absolute tolerance eps^0.25: for [[3, 1], [1, 3]] the estimate is 1.7e-6 off, the 95% limits 1.3e-5 and 0.7% (621.93 for 626.24), the 99% upper limit 6%, and the 99.99% limit the end 1/eps (4.5e15 for 3.2e5) | the roots on the log scale of psi to the precision of the doubles (the tail equals alpha at the limits, the mean equals the count at the estimate) |
| clinfun's `jonckheere.test` and DescTools' `JonckheereTerpstraTest` with ties (normal approximation) | the null variance without ties (sum n_i m_i (n_i + m_i + 1) / 12), too large: p = 0.0086 for c(1, 1, 2, 2, 3, 3) in three groups | the permutation variance with the ties (Hollander & Wolfe): p = 0.0061; without ties as the packages |
| dunn.test's step-wise adjustments (`holm`, `hs`, `hochberg`, `bh`, `by`) with tied p-values | ties ranked in the order of the comparisons: the same p-value gets different adjusted values (1, 0.828, 0.414 with `holm`), which change when the groups are relabelled | a run of ties takes the rank of its first, the one the stopping rule decides on: the same value whatever the order, the same decisions; without ties as dunn.test |
| `glm` where an IRLS step increases the deviance (binomial `y ~ x` with all weights 1000) | `glm.fit` accepts the step: the deviance went 7564, 89255, 144175 and stopped there, "converged", with coefficients of 1e15 (the maximum is 4956) | the step is halved while the deviance rises by epsilon (1e-8 by default) relative or more (glm2's rule): the maximum, the same as with weights 1; "step size truncated due to increasing deviance" |
| `glm` with the logit link where \|eta\| exceeds 30 | the C code clamps the inverse link and its derivative to the values at eps (a jump from 1 − 9.4e-14 at 30 to 1 − 2.2e-16 just beyond): the binomial fit of the counts (1e15, 1) and (1, 2) on x = 1, 2 stops at deviance 2139, not converged (the solution has eta = log 1e15) | the exact values beyond 30, up to the largest double below 1 and down to the least double: deviance 0.013 (1 − y = 1/(1e15 + 1) limits it); within 30 as R |
| `pexp(q, rate, log.p = TRUE)` where rate × q is subnormal (`pexp(1e-20, 1e-300, log.p = TRUE)`) | the log of the rounded subnormal product: -736.8272408909739 (1.1e-5 off) | log rate + log q: -736.8272297580946 |
| `glm` with the probit, cauchit, cloglog and power links at the ends | `make.link` clamps eta (or mu) to the values at eps and the derivatives to eps: Phi(−10) = 7.6e-24, 1 − exp(−e^-40) = 4.2e-18 and a mean of 1e-16 (power 0.5) become 2.2e-16, the cauchit derivative 3.2e-19 at −1e9 becomes 2.2e-16 | the exact values, kept within (0, 1) by the least double and the largest double below 1; within R's range as R |
| The cloglog link `log(-log(1 - mu))` of a small mean | 1 − mu rounds to 1: −Inf for mu = 1e-20 (`glm` stops: "NA/NaN/Inf in 'y'") | `log(-log1p(-mu))`: finite |
| `AIC` of a gaussian `glm` with rows of weight 0 | Inf: the family's `aic` takes log(0) of their weights and counts them in n | the rows left out of the likelihood (every family): the AIC of the fit without them (5.84 for weights 1, 1, 1, 0) |
| `residuals(glm, "deviance")` without residual degrees of freedom | 0 for every row, also for a fit that has not converged (deviance 0.34 with residuals 0) | each row's contribution: their squares sum to the deviance (rounding residue for a converged saturated fit) |
| `glm` with the log link where eta < −36 | `pmax(exp(eta), eps)`: a mean of e^-100 is 2.2e-16 | exp(eta) down to the least double |
| `glm` on separated data (binomial y = 0, 0, 0, 1, 1, 1 on x = 1..6; a saturated Poisson fit with a count of 0) | converged, with coefficients (−165, 47) that are only where the iterations stopped; at most "fitted probabilities numerically 0 or 1 occurred" | the same `converged`, with the warning "the linear predictor was still changing at convergence: the data may be separated (no finite maximum likelihood estimates)" (the last step moved eta by more than 0.1); the coefficients go on further with the exact logit link |
| `coxph` with a nearly aliased column (x2 = x1 + 1e-6 e) dropped by the Cholesky factorisation | survival's cholesky2 leaves the column's residual cross-products, which chsolve2 and chinv2 still use: coefficients and variances 4e-12 off the fit without the column | the dropped column zeroed: the fit without it, bit for bit |
| `optim(method = "CG")` | cgmin overwrites the start's value with the accepted one before fitting the parabola, so its trial point is always the midpoint of the accepted step (quadratic of 3 variables: 46 function evaluations, value 5.6e-14; Rosenbrock from (-1.2, 1): value 3.1 at maxit 100) | the minimum of the parabola through the start and the accepted point (8 evaluations, value 1.8e-25; Rosenbrock 5.3e-8); the path differs from R's |
| Perfect correlation (e.g. `1:5` with itself) | r = 1 − 2 ulp; 1 − r² cancels, so t and p are far off (p = 4e-24 instead of 0; with noise of 1e-4 the p-value is off by 14%) | r and 1 − r² in double-double |
| Kendall's exact upper tail | computed as 1 − (lower tail): 5.6e-16 instead of 3.8e-33 for perfect correlation with n = 30 | upper tail summed directly |
| Spearman, perfect correlation with n = 2 | S = 2.2e-16 (should be 0) | 0 |
| Spearman's t approximation with rho ≈ ±1 | p = 1e-62 for perfect correlation with n = 10 (should be 0) | 0 |
| Fisher's exact test for r × c tables | FEXACT rounding errors around 1e-11 relative (changing `workspace` changes the value by 2e-13) | matches exact enumeration |
| `var.test`, `ansari.test`, `mood.test` and lawstat's `brunner.munzel.test`: upper tails | formed as 1 − P, so small p-values lose their relative accuracy (`var.test` returns 0 for p = 4e-58) | tails computed directly |
| Exact `ansari.test` p-values | R's sums of probabilities carry rounding of up to 1e-8 relative in small p-values (8.8e-9 for m = 60, n = 70) | agree with exact subset counts |
| `mood.test` with ties | R 4.5.2's tie correction of the variance has (N − t)² where Mielke's formula has (N − 2 cumsum(t) + t)² (corrected in R-devel); the statistic is off by up to 6% | the exact permutation variance of the averaged scores |
| `ks.test`, asymptotic two-sided p-value | Kolmogorov's limiting series summed to a tolerance of 1e-6 (off by up to 1e-5) | agrees with `scipy.special.kolmogorov` |
| `pchisq` and `pf` with a huge noncentrality (1e13 and more) far from the quantile | 0 and 1, correct (but R does not converge near the centre of such a distribution) | 0 and 1 (a Chernoff bound decides); near the centre not supported |
| `ks.test` two-sample statistic that is 0 | rounding residue of cumulative sums of 1/m and −1/n (±1e-16, sometimes negative) | 0 |
| `fligner.test` and `prop.test` statistics that are 0 | rounding residue (1e-31) | 0 |
| `skewness`, `kurtosis` and `cv` of data with a large mean and small spread | e1071 subtracts a mean rounded to double: skewness off by 8e-5, kurtosis by 2e-6 relative (1e8 + noise of 1e-3) | deviations from the double-double mean; agree with 60-digit values |
| `aov` (one way) with a large mean and small spread, or all values equal | R fits through a QR decomposition: sums of squares off by 6e-8 (1e6 + noise of 1e-3); F = 1 from rounding residue when all values are equal, 5.9e30 when the groups are constant | sums of squares in double-double (F = NaN, Inf) |
| `TukeyHSD` | R's `ptukey` and `qtukey` (see above); the p-value is off by 3e-6 with df = 5 (two groups, where it follows from the t distribution) | agrees with high-precision values |
| `lm` with nearly collinear columns (1e6 + noise, with an intercept) | coefficients off by 1.7e-9 from 60-digit values | 3.6e-11 (both within eps times the condition number) |
| `lm` and `anova` from a formula with a large mean (1e6 + noise) | coefficients off by up to 1.5e-11 and R² by 2.8e-12 from exact rational values; sums of squares near 0 off by 1.6e-10 relative | fit in double-double; within 7e-15 of the exact values |
| `mauchly.test` on contrasts given by `M` and `X` | W off by up to 4e-12 from the exact value, and the p-value near W = 1 by 1.3e-12 | W in double-double; within 1e-15 of the exact value |
| Power calculations with noncentral distributions (`power.t.test`, `power.anova.test`, `pwr.*`) | R's noncentral t is accurate to about 1e-12 and its noncentral F to about 1e-9 (and t with more than 4e5 degrees of freedom uses an approximation), so computed powers and the sample sizes solved from them are off by up to 3e-8 | accurate noncentral distributions; the solved quantities follow R's `uniroot` calls (same interval and tolerance), so they keep R's tolerance |
| effectsize's confidence intervals (`cohens_d`, `hedges_g`, `eta_squared`, ...) | the noncentrality parameters are found with Nelder-Mead (`optim`): limits off by about 1e-9, up to 3e-3 relative (a partial eta² upper limit of 0.25181 instead of 0.25111) | the exact limits |
| Dunnett-type p-values (multcomp's Dunnett, PMCMRplus's `dunnettTest` and single-step `kwManyOneDunnTest` and `manyOneUTest`) | mvtnorm's randomised integration: about 1e-3 absolute, different from run to run (seeded) | exact one-dimensional integral |
| Studentized-range p-values of post-hoc tests (Steel-Dwass, Games-Howell, Tukey) | R's `ptukey`, about 8 digits (off by up to 3.4e-8 in the tests) | full precision |
| irr's kappa p-values | formed as 2 (1 − Φ(|z|)), losing small ones (2.2e-16 instead of 1.7e-16) | 2 Φ(−|z|) |
| polycor's maximum-likelihood estimates and standard errors (`ML = TRUE`, `std.err = TRUE`) | Nelder-Mead or BFGS stops early and the Hessian is taken by finite differences: off by up to 1e-3 relative; on strongly associated tables the two-step BFGS runs past 1 and reports 0.9999 with an infinite variance | the exact maximum (within 4e-15 of 160-bit values) and the analytic Hessian |
| nortest's `pearson.test` with a value whose `pnorm` rounds to 1 (an outlier about 8.3 sd or more above the mean) | the value falls in class k + 1, which `tabulate` drops: the counts sum to less than n (1176.13 for 99 zeros and 1e6) | counted in the last class: 1174.26 |

### Distributions outside base R

The R references are extraDistr (invgamma, kumar, pareto, triang, laplace), R's beta functions (arcsine) and
closed forms written in R (`distSummary`). The values here agree with 50-digit mpmath values
(`scripts/mpmath/extradist.py`, `scripts/mpmath/distsummary.py`).

| Case | R | rStats.js |
|---|---|---|
| Tails of `pinvgamma`, `pkumar`, `ppareto`, `plaplace`, `ptriang` | extraDistr evaluates the textbook formulas: 1 − x^a and 1 − p cancel and log probabilities are taken after the probability underflowed (`pkumar(1e-10, 1, 1)` is off by 8e-8, `pinvgamma(1e-300, 1, 1, log.p = TRUE)` is −Inf instead of −1e300) | tails computed directly |
| Log tails of the order of a subnormal shape (`pkumar(0.2015, 0.4224, 1.85e-317, log.p = TRUE)`, `ppareto(318.7, 1.04e-317, 1, log.p = TRUE)`) | −Inf | −729.6448082452898, −728.127870954796 (mpmath: −729.64480824528978, −728.12787095479600) |
| `dkumar(0.2015, 0.4224, 1.85e-317, log = TRUE)` | −728.528830589584 (off by 1.2e-10) | −728.5288305013036 (mpmath: −728.52883050130359) |
| `qkumar(-744.2443613428673, 1.1349, 0.1241, log.p = TRUE)` (a log p below the normal range) | 0 | 1.0076418889538287e-284 (mpmath: 1.0076418889538287057e-284) |
| `ptriang(3.0662e-190, 0, 1.2412e133, 5.581e132, log.p = TRUE)` (a subnormal ratio of lengths) | −Inf | −1484.8619589788332 (mpmath: −1484.8619589788330) |
| Quantiles in the far tails (`qlaplace`, `qkumar`, `qtriang`, ...) | 1 − p rounds: `qlaplace(1e-300, lower.tail = FALSE)` is Inf | correctly rounded (maps back to p) |
| Densities steep in a parameter (`dinvgamma` with alpha = 100, `dtriang` near the ends) | the rounding of beta / x or b − x is magnified (to 9e-14) | the division in double-double |
| `distSummary` skewness and kurtosis of `weibull` and `kumar` | the raw-moment formulas cancel: 9 digits of the kurtosis lost for shape 20 | central moments integrated directly (3e-14) |
| `erfinv` of a small argument (pracma's definition through `qnorm((1 - |y|) / 2)`) | the relative accuracy of y is lost: `erfinv(1e-10)` off by 8e-8, `erfinv(1e-300)` is −0 | Newton steps on `erf` |
| `gammainc` (R's `pgamma(x, a) * gamma(a)`) | two roundings, and exp of a large log where the product overflows (1e-13 for a = 200) | the series for x < a with `pow` |

## Where R fails and rStats.js returns a value

| Case | R | rStats.js |
|---|---|---|
| `pbinom(36, 1e5, 0.01, log.p = TRUE)` | -Inf (internal underflow, with a warning) | -851.68… |
| `pbinom(1e16, 2e16, 0.5)` (beyond 2^53, x + 1 rounds to x) | 0.5 (the symmetric I_p(x, x)) | 0.5000000028209479 = 1/2 + dbinom/2 (I_p(x + 1, n - x) = I_p(x, n - x) - (n - x)/n dbinom(x); NaN where n - x rounds as well). `ppois` takes the same identity there, as R's values do |
| `pnbinom(1e16, 1e16, 0.5)` (beyond 2^53, x + 1 rounds) | 0.5 | 0.5000000028209479 = 1/2 + dnbinom (I_p(size, x + 1) = I_p(size, x) + dnbinom(x)); `qnbinom(0.5, 1e16, 0.5)` is 1e16 as in R. Where the term is not resolved against a deep upper tail, the rounded x + 1 is used (one unit of x is below the resolution there) |
| `binom.test(0, 1e20)`, `poisson.test(0, r = 1e20)` (counts beyond 2^53) | error "result would be too long a vector" | a p-value (the bisections stop where their midpoint rounds to an end; they did not return before) |
| `poisson.test(c(5, 5), T = c(1e308, 1e308))`, `T = c(1e-308, 1e-308)` | p-value 0 (p0 = r T1 / (r T1 + T2) = 0), expected count NaN; rate ratio NaN | p-value 1, expected count 5, rate ratio 1 (the ratio T2 / T1 where the sums overflow or fall below the normal range) |
| `binom.test(5, 10, conf.level = 1 - 1e-16)` and `poisson.test` (alpha below 1e-8) | the upper limit from 1 - alpha, which loses its digits (1 and Inf at 1 - 1e-16) | the upper limit from the upper probability alpha itself (0.99981, 52.549); levels with alpha >= 1e-8 as R |
| The same for the intervals of `var.test`, `prop.test`, `mantelhaen.test`, `t.test`, the ICC, `cor.test`, the one-way contrasts, `confint` and `predict` of lm, glm's profile intervals, `coxph` and `survfit` (alpha below 1e-8) | 1 - alpha or (1 + level) / 2 rounds to 1: limits 0, NaN or Inf | the upper probability alpha passed to the quantile function |
| `mantelhaen.test` with counts near 1e150 (products of counts overflow) | statistic and p-value NaN (Inf / Inf in the variance) | the ratios formed first there: statistic 0 and p-value 1 for balanced tables |
| `ks.test(x, "punif", exact = TRUE)` with D >= 1/2 and a tiny p-value (D = 0.9, n = 20, 50, 99) | 0, 8.9e-16, 2.0e-15 (1 - P(D < d) loses the digits) | 2.0e-20, 2.0e-50, 2.05e-99: P(D >= d) = 2 P(D+ >= d) for d >= 1/2, a sum of positive terms |
| `quade.test`, `fligner.test` with ranges or deviations of finite data that overflow (rows -1e308 to 1e308 and -9e307 to 9e307) | tied as Inf: the result changes when the data are rescaled | the data divided by a common power of 2 there: the same result at any scale |
| `mcnemar.test` on an r x r table where a pair of cells has no discordant counts | statistic and p-value NaN | that pair adds 0 (df unchanged) |
| `predict(glm, newdata, se.fit = TRUE)` where the squares overflow (newdata 1e155) | se.fit Inf | the norm formed from the values divided by the largest: 1.07e154 |
| `summary(lm)`, `summary(glm)` and `confint(glm)` with a column of x far from 1 (x times 1e-200 or 1e200) | the standard error Inf or 0 ((R'R)^-1 overflows or underflows), t 0 or Inf, p 1 or 0; the profile interval fails | the columns of R divided by powers of 2 before the inverse: t, p and the interval as for x itself (the unscaled covariance is still Inf or 0 where it is out of range) |
| `glm` (gaussian, with intercept) with weights of 1e308, or with an infinite response of weight 0 | null deviance NaN (the sum of the weights overflows; 0 times Inf) | 5e306 and 4.67: the weights divided by a power of 2, rows of weight 0 left out |
| `lmer` with a response of 1e200 (or 1e-200) times ordinary data | lme4: the fixed effects as expected but sigma Inf (the penalised sum of squares overflows) | the response divided by a power of 2 for the fit: theta as for the data itself, fixed effects, sigma, variance components, random effects and residuals scaled back, the log-likelihood shifted by −(n or n − p) log c |
| `lmer(y ~ x + (x \| g))` with x in other units (x times 3e5, 1e6 or 1e-5) | lme4 stops at another point with a convergence warning (REML criterion 101 for 65.9 on the data of issue #11; it suggests `autoscale = TRUE`) | the minimisation over theta on Z with its columns divided by powers of 2, theta scaled back: the same fit in the units of x |
| lmerTest's Satterthwaite df with the response in other units (times 1e6 or 1e-6) | the df of x 7.4e8 for 31 at 1e6 (0.19 at 1e-6), with an eigenvalue warning: the Hessian in (theta, sigma) is cut at an absolute 1e-8 | the Hessian cut in coordinates of comparable scale (theta by the columns of Z, sigma by a power of 2 near its estimate): df, t, F and p as for the data itself |
| pracma's `barylag` with nodes of 1e200 (or 1e-200) | the products of node differences overflow (underflow): every weight 0, the result NaN | the products kept with their exponents and the weights scaled by a common power of 2: 0.25 for (x / 1e200)^2 at 0.5e200 |
| `varimax` and `factanal` (varimax or promax) with a row of zero loadings (a variable uncorrelated with the others) | "infinite or missing values in 'x'": the Kaiser normalisation divides the row by 0 | the rotation of the other rows (as R's varimax of them), the zero row kept 0 |
| `dcauchy` with a scale above 5.7e307 (`dcauchy(1.1e308, scale = 1e308)`) | 0: π × scale overflows | the subnormal density, 1.44e-309, with 1/π taken first there |
| `lm` with all weights below 1e-308 | standard errors Inf (NaN at 5e-324), t 0, p 1 | the values of the weights 1 ((R'R)^-1 formed for the weights divided by a power of 2) |
| `anova(fit1, fit2)` where the larger model fits essentially perfectly (y = 1 + x + z exactly) | F 2.6e30 and p 4e-16 without a warning (the table of one fit warns) | the same values with the warning "ANOVA F-tests on an essentially perfect fit are unreliable" |
| `p.adjust(p, "BY", n = Inf)`; `"holm"` with `n = Inf` | "result would be too long a vector"; every p-value 1 | an error (n must be finite); BY with a large finite n uses the expansion of the harmonic number beyond 1e6 |
| `qbinom(-1e10, 1e5, 0.01, log.p = TRUE)` | 37 (search stops early) | 0 (F(0) ≈ e^-1005 exceeds e^-1e10) |
| `qt(1e-320, 2)` (subnormal p) | -Inf | -7.0711e159 (matches the closed form −sqrt(1/(2p))) |
| `qbeta(-1e5, 1e-10, 100, lower.tail = FALSE, log.p = TRUE)` | NaN | 1 (the true answer rounds to 1) |
| `qbeta(2.25e-265, 5.68e-37, 5643.4, lower.tail = FALSE)` (a tiny shape) | 1, with a warning | 0.08797712670529832 |
| `df(1.33e-322, 1.04, 206159)` and other subnormal x | NaN | 3.77e153 (from the log of m x / n) |
| `pf(5.43e-319, 1.04, 206159)` (subnormal x) | 1.0014e-166 | 7.3742e-167 |
| `dcauchy(1e300, log = TRUE)`, `pcauchy(-1e300, scale = 1e-300, log.p = TRUE)` | -Inf | -1382.69… |
| `dweibull(1e-300, 3, log = TRUE)` | -Inf | -1380.45… |
| `dweibull(1e100, 5, log = TRUE)` | NaN (∞ − ∞) | -Inf |
| `pnbinom(30, 1e7, 0.7, log.p = TRUE)` | -Inf | -3566376.67… |
| `qcauchy(-1000, 0, 1e-300, log.p = TRUE)` | -Inf | -6.27e133 |
| `qcauchy(1e-320, 0, 1e-300)` | inaccurate (πp is subnormal) | correct value, computed as scale/p/π |
| `qlogis(1e-320, lower.tail = FALSE)` | Inf | 736.83 |
| `plogis(-745)` and other subnormal answers | 0 | 5e-324 |
| `pwilcox(q, 500, 500)` | uses several GB and runs out of memory | computed (memory grows with mn/2). Beyond about m = n = 510 the entries near the center lose their accuracy (the passes of the table amplify errors above their centers): a RangeError there, from 1.7 sd below the center at 520 to 18 sd at 1050 (the tails stay available; unequal sizes with a small m, such as 100 and 20000, reach the center) |
| `dwilcox(3, Inf, 5)`, `dsignrank(3, Inf)` | allocation error or crash | NaN |
| `qsignrank(p, 1100)`, `qhyper(0.5, 1e15, 1e15, 1e15)` | does not finish | computed (`qhyper` takes about ten seconds at this size) |
| `qtukey(1e-10, 20, 10)` | NaN | finite answer |
| `qtukey(1.52e-287, 3, 4.67e10, nranges = 2, lower.tail = FALSE)` | NaN ("convergence failed") | 51.31849500218445 |
| `ptukey(54.5, 3, Inf, nranges = 2, lower.tail = FALSE, log.p = TRUE)` (1 − W below the double range) | -Inf | -744.6488312090673 (log 2 + log(1 − W)) |
| `qbeta(8.7e-285, 1.33e304, 5.89)` (a huge shape; the answer rounds to 1) | NaN, with warnings from `bgrat` | 1 |
| `pf(2e-323, 0.0121, Inf)` (q df1 below the normal range) | 0 | 0.01091389160021212 |
| `qf(-385.76, 1.05, 1.14e264, ncp = 1.65e262, log.p = TRUE)` | Inf, with a warning | 1.5704712908151466e262 (the noncentral χ² limit) |
| `pf(2.5e300, 1827.5, 0.165, ncp = 3.66e307)` | NaN, with warnings | 7.4814091599854485e-292 |
| `beta(1e-310, 1e-310)` (B(a, a) > 2/a overflows) | NaN, with warnings | Inf |
| `qhyper(1 - 1e-15, 1e4, 1e5, 5000)` | 5000 | 617 (by definition) |
| `fisher.test` on a 3 × 5 table with n = 179 | FEXACT error 7 with the default workspace | 0.2023726720757 (0.65 s) |
| `wilcox.test(exact = TRUE)` with very large n (e.g. 3000) | `psignrank` gives NaN | computed |
| `wilcox.test(x, y)` (normal approximation) with every value tied, e.g. `wilcox.test(1, 1)` | p = NaN two-sided (0 / 0; R 4.6 returns 1) | 1 (W always equals its expectation), for every alternative |
| `kappa(exact = TRUE)` and MASS's `ginv` of a matrix whose singular values exceed the largest double (`a * matrix(c(1, 1, 1, -1), 2)` with a = 1.7e308) | NaN (Inf / Inf) and the zero matrix (the cut-off tol × Inf drops every component) | 1 and the inverse (±2.9e-309): ratios and the cut-off on the scaled singular values |
| lmerTest's `contest` with a contrast of extreme magnitude (`c(0, 1e160)`, `c(0, 1e-200)`, `diag(2) * 1e160`) | standard error Inf or 0, t 0 or Inf, df and p NaN; "infinite or missing values in 'x'" or no rows for the joint test | the test of the contrast itself (L and rhs divided by a power of 2), the estimate and the standard error in the contrast's units |
| `psigamma(x, deriv)` for x < 0 and deriv ≥ 6 | NaN (not implemented in R) | computed (`psigamma(-1.5, 10)` = -156.229596593233) |
| `trigamma(1e-300)`, `psigamma(1e-100, 3)` and other results that overflow | NaN | ±Inf |
| `besselI(1000, 1000)` | Inf | 2.7234536469108428e229 |
| `besselK(1000, 1000)`, `lfactorial(1e-300)`, `besselI(1e-300, 1)` | 0 | 1.2981802514667e-233, -5.77e-301, 5e-301 |
| `besselJ(1e6, 0)` | 0 | 3.3104301373987376e-4 |
| `besselY(1e6, -2.75)` | -4.1e-4 | -2.8030753997749413e-5 |
| `besselJ(1e308, 0)`, `besselY(1e308, 0)`, `besselI(1e308, 0, expon.scaled = TRUE)` (pi x or 2 pi x overflows) | 0, with the warning "value out of range" for J | -2.4706564120790082e-155, 7.5866879552418034e-155, 3.989422804014327e-155 (the square roots taken apart) |
| `gamma(171.6243769563027)` (the largest double whose Γ is finite) | Inf | 1.79769313486223e308 |
| `gamma(-171.5)`, `gamma(-172.5)`, … down to `gamma(-177.5)` (subnormal results) | 0 | 1.9316265431712e-310, -1.1197835032888e-312, …, 5e-324 |
| `lbeta(1e308, 1e308)` (a + b overflows) | -Inf | -1.3862943611198915e308 |
| `besselY(1e-310, 0)`, `besselY(5e-324, 0)` | -Inf | -454.49387560035387, -473.99907342300429 |
| `besselK(1, 1e12)`, `besselY(1, 1e12)`, `besselY(10, 1e8)` (results far out of range at large orders) | error "cannot allocate vector of size 7450.6 Gb"; NaN with a warning | Inf, -Inf, -Inf at once (bounds on the log of the result decide before the recurrences of about nu steps) |
| `besselK(1e8, 2e8)` | 0 | Inf |
| `ansari.test(conf.int = TRUE)` with ties and `exact` unset (or `TRUE`) | error "object 'cint' not found" (with both samples below 50 values R takes the exact branch, which skips the interval with ties) | the normal-approximation interval and estimate, the same as with `exact: false` |
| `weighted.mean(c(1e308, 1e308), c(1, 1))` and other sums that overflow | Inf | 1e308 (the values and weights rescaled) |
| `fivenum(c(1e308, 1e308))`, `hist(...)$mids`, the Kaplan-Meier median, the Hodges-Lehmann estimate and the midrange of `wilcox.test`, the default mode of the triangular distribution, the `monoH.FC` slopes of `splinefun` (all `(a + b) / 2`) | Inf when a + b overflows | the midpoint, as a / 2 + b / 2 when a + b overflows |
| e1071's `skewness`, `kurtosis` on data around 1e150 | NaN (the powers overflow) | the value at any scale (the deviations rescaled by a power of 2) |
| `scale(c(1e200, 2e200, 3e200))`, `scale(c(1e-200, 2e-200, 3e-200))` | scale Inf or 0, scaled values 0 or ±Inf | -1, 0, 1 (the sum of squares rescaled) |
| `runif(n, -1e308, 1e308)` | Inf (max - min overflows) | values in the range |
| `seq(1, 2, by = Inf)` | NaN | 1 |
| `seq(-1e308, 1e308, by = 5e307)` | the middle value -1.9958e292 | 0 (the ends' difference overflows: the values are those of the halved ends, doubled) |
| `eigen()` of a small nonsymmetric matrix such as `matrix(c(1, 3, 2, 4), 2) * 1e-60` | treated as symmetric (`isSymmetric` compares absolutely when mean \|a\| <= 100 eps): wrong eigenvalues | the symmetry test made relative at every scale (`isSymmetric()` itself is R's) |
| `merge()` on several keys whose values contain "\r", or `NA` against the text "NA" | rows with different keys matched (the keys are pasted with "\r") | matched only on equal keys |
| `fisher.test`/`chisq.test(simulate.p.value = TRUE)` with a fractional `B` | divides by B + 1 though only the integer part of B is simulated | divides by the number simulated plus 1 |
| `JonckheereTerpstraTest` (DescTools) two-sided | can exceed 1 | at most 1 |
| distSummary's mean of `unif(-1e308, 1e308)`, variance of `beta(1e150, 1e150)` | Inf, 0 | 0, 1.25e-151 |
| `aov(y ~ x + w + Error(id/w))` with a covariate x in small units (x * 1e-4) | the x row disappears (a column is kept in a stratum when its projection's squared length exceeds 1e-5) | the same table at any scale of x (the threshold is 1e-14 times the column's own squared length; 1e-5 times its mean square, used before, also dropped the small within-subject part of a covariate that varies mostly between subjects) |
| `t.test`, `oneway.test`, `var.test`, `bartlett.test`, PMCMRplus's `tukeyTest`/`gamesHowellTest`, `pairwise.t.test` on data around 1e-200 or 1e155 | "data are essentially constant", or NaN (the variances underflow to 0 or their squares overflow) | the result at any scale (the data rescaled by a power of 2, which is exact) |
| The Welch degrees of freedom of `t.test`, `gamesHowellTest`, `cohensD` and ICC's two-way bounds, data around 1e±150 | NaN (fourth powers of the standard errors) | the same df at any scale |
| `chisq.test(c(1e200, 1e200), p = c(0.1, 0.9))`, `chisq.test(matrix(1e200, 2, 2))`, and the Pearson terms of `mcnemar.test`, `prop.test`, `mantelhaen.test` | Inf or NaN (the squared deviation or the product of the margins overflows) | 3.56e200, 0 (formed as (d / sqrt(e))^2 or (a / n) b when needed) |
| afex's `aov_ez` and `mauchly.test` with the response in other units (1e-4 times, or around 1e±100) | the sphericity corrections and Mauchly's test disappear (car's absolute eigenvalue threshold), or W is NaN | the same epsilons and W at any scale (the rank judged relative to the largest eigenvalue and to the sum of squares of the data; W as det(U / (trace(U)/p))) |
| `coxph(Surv(time, status) ~ x1 + x2)` with covariates in very different units (x1 * 1e7 or x1 * 1e-6, x2 as is) | the Wald test drops a covariate (3.36 becomes 0.31 or 3.08: the Cholesky pivots of the variance in the original units fall below the relative tolerance); at x1 * 1e200 the standard error underflows to 0 (z Inf, p 0), at x1 * 1e-160 "infinite argument in coxph.wtest" | the same z, p and Wald test at any scale (the variance, z, the Wald test and the check for infinite coefficients formed in units of a power of 2 of each covariate's scale; the coefficients, the variance and the standard errors scaled back for output) |
| `zTest` (BSDA's `z.test`), effectsize's `cohens_d`/`hedges_g`, irr's `icc`, psych's `alpha`, nortest's `ad.test`/`cvm.test`/`lillie.test`/`sf.test`/`pearson.test`, `aov`, `TukeyHSD`, car's `leveneTest`, `lm`, `anova`, `aov(... + Error())`, afex's `ges` on data around 1e±200 | NaN, 0, ±Inf or a different test result (squares of the data overflow or underflow) | the result at any scale (the data scaled by a power of 2 before the mean is subtracted; sums of squares, MSE, standard errors and intervals scaled back for output) |
| `cov(c(MAX, MAX, -MAX), c(-1e-308, -1e-308, 1e-308))` (`MAX` the largest double), and a paired `t.test` of values of opposite sign near the largest double | -Inf or NaN (the deviation, or the difference, overflows before any rescaling) | about -2.3969 and a correlation of -1; the paired test as at any other scale |
| `t.test(x, mu = 1e100)` | interval [0, 0] (formed as mu + (t ± q) stdErr) | the interval about the mean of x, which does not depend on mu (NaN in R for an infinite mu) |
| car's `Anova` (types II and III), `predict(lm)` standard errors and intervals, gaussian `glm` and `summary`, `residuals`, `rstandard`, `cooks.distance`, `predict`, `anova`, `confint` of it, DescTools' `CoefVar` and `MeanAD`, with the response around 1e±200 | Inf, 0 or NaN, "residual sum of squares is 0", or "no valid set of coefficients has been found" | the result at any scale (the response scaled by a power of 2; for glm on the gaussian family, or quasi with constant variance, on the identity link) |
| `pnorm(1e308, -1e308, 1.7e308)`, `qnorm(0.9, -1e308, 1.7e308)`, and the same for `plogis`/`qlogis`, `pcauchy`/`qcauchy`, extraDistr's `plaplace`/`qlaplace`/`dlaplace`: x - location or scale z overflows although the result is in range | 1, Inf, 0 or -Inf (pnorm 1, dnorm 0, qnorm Inf confirmed in R 4.5.2) | 0.8803, 1.1786e308 (x and location halved, or location and scale divided by a power of 2, before the subtraction or product) |
| `quade.test(y)` where a block (row) has a missing value, e.g. `y <- rbind(c(10,12,15), c(11,14,16), c(12,NA,17), c(13,15,18), c(14,16,20))` | F = 10, df (2, 8), p = 0.00666: the dropped block still counts in b (B = sum S_j^2 / b, (b - 1) B / (A - B), df (b - 1)(k - 1)), so the result differs from `quade.test(y[-3, ])` (F = 25, df (2, 6), p = 0.00123) for the same data; a bug in R (4.5.2, checked by running it) | the test on the complete blocks: F = 25, df (2, 6), p = 0.00123, as for the data without the block |
| `rt(n, Inf, ncp = 1)`, `rf(n, Inf, 10, ncp = 2)`, `rf(n, 10, Inf, ncp = 2)` (noncentral, an infinite df) | NaN ("NAs produced"; the central `rt(n, Inf)` and `rf(n, Inf, 10)` do give values) | the limits: N(ncp, 1) for t; for F the chi-squared over its infinite df is 1 (X / df1, df2 / Y, or 1). The same variates are drawn as in R, so the stream after the call is R's |
| `rf(n, 0, 10, ncp = 2)` (noncentral, df1 = 0), `rsignrank(n, Inf)` | Inf or NaN depending on the draw (division by df1 = 0; the central `rf` gives NaN); an undefined integer cast of Inf | NaN (F needs df1, df2 > 0; the same variates are drawn as in R, so the stream after the call is R's); NaN without drawing |
| expm's `expm(matrix(c(1e308, 0, 0, 0), 2), method = "Higham08")` | NaN in every entry (Inf * 0 in the squaring) | diag(Inf, 1): an overflowed entry stands for a finite value, so its product with an exact 0 is 0; a matrix whose 1-norm overflows no longer loops forever |
| expm's `expm(matrix(c(0, 0, 1, 0), 2), method = "Pade", order = 0)` (also "Taylor", "PadeO", "TaylorO") | the identity matrix (the answer is [[1, 1], [0, 1]]) | an error: order must be a positive integer for these methods (the Higham08 methods ignore it, as in R). A matrix of 2 x 2 or larger with NaN or infinite entries is an error for every method (the Padé and Taylor methods gave NaN) |
| `rcond(matrix(c(1e308, 0, 1e308, 1e308), 2))` and other matrices whose norm overflows (also `triangular = TRUE`, and `solve`'s condition check) | error -5 from `dgecon` (0 with `triangular = TRUE`); `solve` of that matrix stops as computationally singular (rcond = 0) | 0.3, as for the matrix divided by a power of 2 (the reciprocal condition number does not depend on the scale); `solve` gives (0, 1e-308) |
| `qr.solve(qr(matrix(c(1, 2, 2, 4), 2), LAPACK = TRUE), c(3, 6))` (a LAPACK decomposition of deficient rank) | (8, -2.5): the rank of a LAPACK decomposition is always min(n, p) | "singular matrix in qrSolve": abs(R_kk) <= tol abs(R_11) (tol 1e-7) counts as deficient rank |
| `kappa(matrix(c(1, 2, 2, 4), 2), exact = TRUE, norm = "1")` (exactly singular, a norm other than 2) | "system is exactly singular" | Inf, as with norm "2" (a computationally singular matrix still stops, as in R) |
| `anova(lm(y ~ x2), lm(y ~ x1 + x3))` and `anova()` of glm fits that are not nested (neither model is a special case of the other) | an F test (F 1110, p 4.6e-7 in the example), or a likelihood ratio test for glm | no test: F, the p-value and the test columns are NaN, as `lmerAnova` (nested: the columns of the model with fewer parameters lie in the column space of the other, judged by the QR rank on the rows of positive weight: rows of weight 0 are not in the likelihoods) |
| `anova()` of glm fits with different offsets (`glm(y ~ 1, poisson)` and `glm(y ~ x, poisson, offset = log(y) - x/2)`) | a likelihood ratio test (p = 0.000417) | no test (NaN): the fits are nested only when the difference of the offsets also lies in the column space of the larger model, as for the columns |
| `shapiro.test(c(-1e308, 0, 1e308))` (the range overflows) | NaN | W = 1, as `shapiro.test(c(-1, 0, 1))` (the data divided by a power of 2 first) |
| polycor's `polyserial(x * 1e200, y, std.err = TRUE)` (the sum of squares overflows) | rho 0, chisq NaN | the values for x (rho 0.589 in the review example) |
| `rexp(n, rate = 1e-310)` (positive rate, 1 / rate overflows) | NaN, with a warning, drawing nothing | the variates `exp_rand() / rate` (Inf unless the exponential variate is below about 0.018), one exponential variate each |
| `backsolve(diag(1e-308, 2), c(1, 2))`, `forwardsolve(..., transpose = TRUE)` (also `solve`) | NaN, Inf (0 * Inf from the overflowed component); `solve` stops with rcond = 0 | 1e308, Inf: coefficients of exactly 0 are skipped, as an overflowed component stands for a finite value |
| `prcomp(c(1e308, -1e308, 1e308, -1e308))$sdev` (the singular value overflows) | Inf | 1.1547005383792517e308 (the decomposition of the matrix divided by a power of 2) |
| `sd(c(-1e308, -1e308, -1e308, -1e308, 1.5e308))` (the variance overflows), `sd(c(1e-200, 2e-200, 4e-200))` (it underflows); e1071's `skewness`, `kurtosis` and the CV of such data | Inf, 0; NaN or 0 | 1.118e308, 1.53e-200 (sd from the deviations in the coordinates 2^-k); the moments and the CV as at any scale |
| `scale(x)` and `prcomp(x)` of the same data, where a deviation from the mean (2e308) overflows | `scale`: NaN, scale Inf; `prcomp`: an error from svd | `scale`: [-0.447, ..., 1.789], scale 1.118e308; `prcomp`: sdev 1.118e308, the score that is out of range Inf (computed in the coordinates 2^-k) |
| `determinant(diag(c(1e308, 1e308, 1e-308, 1e-308)), logarithm = FALSE)` | modulus Inf (the running product overflows) | 1 (the product keeps a binary exponent apart) |
| `matrix(c(1e308, 1e308), 1) %*% matrix(c(1e308, -1e308))` (the products overflow, the sum does not) | NaN | 0 (such entries are summed again from factors divided by powers of 2) |
| `optimize(function(x) (x / 1e308 - 1.05)^2, c(1e308, 1.1e308))` (lower + upper overflows) | does not return (the midpoint is Inf) | 1.05e308 (the search in x/2) |
| `approx(c(-1e308, 1e308), c(0, 1), n = 3)`, `approx(c(0, 1), c(-1e308, 1e308), xout = 0.5)`, `spline(c(-1e308, 1e308), c(0, 1), n = 3)` (differences of finite values overflow) | y 0, 0, 1; Inf; spline 0, 0, NaN | 0, 0.5, 1; 0; 0, 0.5, 1 (the differences in half coordinates; the spline in x / 2^k) |
| `rbeta(n, 1e308, 1e308, ncp = 0)` (2 shape overflows) | NaN | 0.5 (the chi-squared variates halved, with R's draws) |
| `rgeom(n, 1e-309)`, `rnbinom(n, 1, prob = 1e-309)`, `rnbinom(n, 0.5, mu = 1e308)` ((1 - p) / p or mu / size overflows) | NA or NaN, drawing nothing after it | the variates (e.g. 1.716e308 for `set.seed(4)`): the exponential or unit gamma variate times 1 - p, divided by p; Infinity only where the mean itself overflows. The draws of the Poisson step are made, so the stream departs from R's only there |
| `rmultinom(n, size, c(0.5, 0.5, 1e-16))` (the probabilities sum to 1 in doubles) | the second category takes all that is left (p = 1), and the third is never drawn | the second is a binomial draw with 0.5 / (0.5 + 1e-16), from the probabilities of the remaining categories summed from the end (the stream departs from R's only in such cases) |
| `summary(glm(...), dispersion = -1)` (also `glmAnova`, `glmPredict`, `glmRstandard`, `glmCooksDistance`) | NaN standard errors, with a warning | an error: the dispersion must be a non-negative finite number (0 gives standard errors of 0, as R) |
| `pwr.chisq.test(w = 1e200, N = 100, df = 3)`, `pwr.f2.test(f2 = 1e308)`, `pwr.anova.test(f = 1e200)` (the noncentrality overflows) | NaN | 1, the limit of the power; `powerAnovaTest` takes between.var / within.var first where only the product overflows |
| `ES.w1(c(0.5, 0.5, 0), c(0.5, 0.5, 0))` and `ES.w2` with an empty row or column (cells with both probabilities 0) | NaN (0 / 0) | such a cell adds 0 (0 here); p0 = 0 < p1 still gives Inf, as R |
| effectsize's `hedges_g` with very large df (Hedges' J from two lgammas near df log df) | J 0.99997 at df = 1e10 (relative error 3e-5), 1.28 at 1e14, 1e-14 at 1e16; 3e-10 off already at 1e6 | J from the difference of the lgammas formed directly (`lgammaDiff`): 1 - 3/(4 df - 1) to rounding at large df |
| effectsize's `eta_squared`, `omega_squared`, `epsilon_squared` of an aov fit of data around 1e154 (also with `Error()` and afex's `aov_ez`) | NaN (the sums of squares overflow) | the values of the same data in other units: the sums of squares as fitted (response divided by a power of 2), divided by one power of 2 before the ratios |
| `aov(y ~ x + W + Error(id))` with the covariate x around 1e-200 or 1e200, and `Error(z)` with a covariate z around 1e-200 | x dropped from every stratum (its squares underflow); z: correct | the tables of the same data in other units: each treatment and error-model column is divided by its own power of 2 (the strata depend only on the spaces the columns span) |
| `mauchly.test` with fewer residual degrees of freedom than dimensions (`mauchly.test(lm(cbind(c(1, 3), c(2, 7)) ~ 1))`) | NaN, or W = 0 with p = 1, or W 2e-17 with p 9e-4 (the covariance is singular whatever the data) | an error: too few residual degrees of freedom for the test |
| `coxph(Surv(time, status) ~ x)` with a time censored at `Inf` | "NA/NaN/Inf in foreign function call" | the fit, with the subject at risk at every event time (the same as for a censoring time beyond the last event) |
| `qr(x, tol = Inf)` | "NA/NaN/Inf in foreign function call" | rank 0 (every column is taken as dependent) |
| `rgeom(n, 5e-324)` (prob below about 5.6e-309), `rnbinom(n, Inf, prob = p)` with p < 1 | NA; about 9e307 (the draw for size = MAX / 2) or NA | Infinity: the draws are beyond the largest double (for rgeom but with a probability below 1e-15; for rnbinom all the probability is at infinity, as dnbinom and qnbinom say). The same variates are drawn, so the stream is R's |
| `rbeta(n, 1e308, 1e308)` and other shapes above about 1e154 (2ab overflows) | 0 (Algorithm BB's constants overflow) | the mean a / (a + b), to which the distribution is concentrated within 1e-77; the same uniforms are drawn, so the stream is R's |
| `rbeta(n, 0, 0, ncp = 0)` (and the Poisson-0 component for ncp > 0) | NaN (0 / 0) | 0 or 1 with probability 1/2 each (Beta(0, 0)), as the central `rbeta(n, 0, 0)`; one uniform is drawn there, where R draws none |
| `dhyper(1, 1e308, 1e308, 1)`, `phyper`, `qhyper`, `rhyper(n, 1e308, 1e308, 1)` (m + n overflows) | NaN; rhyper 0 throughout | 0.5, 0.5, ...: with k / (m + n) below 2^-60 the hypergeometric is the binomial Bin(k, m / (m + n)) to double precision, which is used there (m / (m + n) formed without the sum) |
| `dnbinom(0, size = 1e308, mu = 1e308)` | 1 | 0 (= 0.5^1e308; p and q from the ratio of size and mu when their sum overflows) |
| `qt(0.5, 10, ncp = Inf)` | NaN (or Inf, depending on p), although `pt(t, 10, ncp = Inf)` is 0 at every finite t | Inf: all the probability is at +∞ (-Inf for ncp = -Inf), as for df = Inf |
| `pbeta(-1, 0, 2)`, `pbeta(-1, 0, 0)` (and an infinite shape) | 1, 0.5: the point masses are checked before q <= 0, so the distribution function is positive left of its support | 0 |
| `dweibull(x, shape, scale = Inf)` at a finite x > 0 | NaN (Inf * 0) | 0 (log -Inf), the limit |
| `qnorm(0.5, 3, Inf)`, `qlnorm(0.5, 0, Inf)`, `qlogis(0.5, 3, Inf)` (the median with an infinite scale) | NaN (Inf * 0), although the other p give the limits (±Inf; 0 and Inf for `qlnorm`) and `pnorm(3, 3, Inf)` is 0.5 | the location (3; exp(meanlog) = 1 for `qlnorm`), the limit |
| `dbeta(0.5, 1e308, 1e308)` and other shapes whose sum overflows | NaN | 1.128e154 (log 354.72): the exponent from the halved shapes, doubled (the deviances are homogeneous) |
| `qbeta(0.5, 1e308, 1e308)` and other quantiles near the mean of shapes whose sum overflows; `pbeta(0.4999999999999999, 1e308, 1e308, log.p = TRUE)` | NaN ("NaNs produced"); -3.98e276 | 0.5 (the median of a symmetric beta); -4.93e276 = -a log(1 - 4 d^2) with d = 2^-53. The uniform expansion of the incomplete beta function in the halved shapes, with the deviance and m doubled (pbeta near the mean was NaN here) |
| `pwilcox(x, 1050, 1050, log.p = TRUE)` for small x, and other lower tails whose probability is below 1e-308 (also `pwilcox(1000, 600, 600, log.p = TRUE)`) | -Inf (the probability divided by C(m + n, m), which overflows) | -1451.558 (x = 0), -752.510 (600): the table of probabilities rescaled by powers of 2 where its largest entry falls below 2^760, as dwilcox in logs |
| `qcauchy(p, 3, Inf)` | NaN for every p, although `dcauchy` and `pcauchy` give the limits 0 and 0.5 | -Inf, 3 and Inf below, at and above the median, as `qnorm` and `qlogis` |
| `lm(y ~ x, weights = rep(1e308, n))` (weighted sums of squares beyond the doubles) | R² NaN, F NaN | the values for any common scale of the weights (R² 0.982 for the example in the tests); sigma grows as the square root of the scale. The sums of squares are formed with the weights divided by a power of 2 |
| `integrate(f, 0, -Inf)`, `integrate(f, Inf, 1)`, `integrate(f, Inf, -Inf)`, `integrate(f, Inf, Inf)` | the integral over (0, Inf), (-Inf, 1), (-Inf, Inf) and (-Inf, Inf): the sign of an infinite limit is not used | minus the integrals over (-Inf, 0), (1, Inf) and (-Inf, Inf), and 0 |
| `integrate`, `optimize` and `uniroot` where upper − lower overflows (`uniroot(function(x) x, c(-1e308, 1e308))`), and `integrate` where a midpoint overflows (`integrate(function(x) 1/x, 1e308, 1.1e308)`) | `integrate`: "roundoff error was detected" (0 with the error 0 for the midpoint: every node at Inf); `optimize` and `uniroot`: warnings ("Inf replaced by maximum positive value") | solved in x / 2 on the halved interval (`uniroot` 0, which was -Inf here before; `optimize` did not return) |
| `uniroot(f, c(1, 2), extendInt = "yes")` with f(1) and f(2) of the same sign whose product underflows (1e-300 (x − 5)) | "f() values at end points not of opposite sign" | extended as for other values of the same sign (5) |
| `glm` with an observation of weight 0 whose deviance contribution is 0 × Inf (poisson, y = 1e308) | deviance NaN | the observation adds 0 (and its deviance residual is 0) |
| `coxph(Surv(1, 1) ~ x)` with x = 0 and other fits whose log likelihood stays 0 | "Ran out of iterations and did not converge" (the test 1 − 0/0 is NaN) | converged (an unchanged log likelihood is converged) |
| `survdiff(Surv(c(1, 1), c(1, 1)) ~ c("A", "B"))` and other data whose variance matrix is singular | "system is exactly singular" | the generalized inverse on rank(V) degrees of freedom (`df` in the result); with no information on the groups (rank 0) chisq 0, df 0, p NaN |
| `survdiff` or `survfit` with a time censored at `Inf` | "NA/NaN/Inf in foreign function call" | the subject at risk throughout (an event at `Inf` is an error) |
| lmerTest's `anova(fit, type = 1)` (and type 2) with a predictor in small units, e.g. `lmer(y ~ x1 + I(x2 * 1e-6) + (1 \| g))` | the type I F of x1 becomes its type II F (14.45 instead of 13.96): the Doolittle factorisation compares pivots and entries with 1e-6 in the units of the data; a bug in lmerTest (R 4.5.2, checked by running it) | the same tests at any units (the factorisation on the cross-product matrix scaled to unit diagonal) |
| `anova()` of lmer fits of different rows of the data or different responses with the same number of rows | a likelihood ratio test | an error (lme4 compares only the number of rows) |

## Deliberate differences

### General

- **Indices are 0-based.** `sampleInt(n)` returns values in 0..n-1 (R's `sample.int()` minus 1,
  from the same random stream), and the `pivot` of `qr()` and `chol(x, { pivot: true })` is
  0-based. `sample(array, ...)` returns elements, as in R.
- **Distribution parameters are scalars**; they are not recycled as vectors. The first argument
  may be a number, an array or a `Float64Array`. Use `map` for vector parameters; random draws made
  one at a time after `setSeed` consume R's stream in the same order as R's recycling, so the
  results are R's:

  ```ts
  [0, 1, 2].map((m) => pnorm(1.96, { mean: m }));         // R: pnorm(1.96, mean = c(0, 1, 2))
  setSeed(1);
  [0, 10, 100].map((m) => rnorm(1, { mean: m })[0]);      // R: set.seed(1); rnorm(3, mean = c(0, 10, 100))
  // [-0.6264538107423324, 10.183643324222082, 99.16437138758995]
  ```
- **NA is represented by NaN.** R tells `NA` from `NaN` (for example `table` and `unique` count them
  apart); rStats.js has one `NaN`.
- **`var` is called `variance`**, because `var` cannot be a name in JavaScript.

- **Input that has no meaning is an error** where R returns a value: for example a known standard
  deviation <= 0 in `zTest`, an infinite probability in `chisqTest`, non-binary data in
  `cochranQTest`, negative counts in `propTrendTest`, `polychor` and two-column binomial `glm`,
  fewer than 2 subjects or raters in `icc` and `kappamFleiss`, `df <= 0` in `pwrChisqTest`, and
  a non-finite or NaN tolerance (`optim`'s `reltol`, `uniroot`, `optimize`, `integrate`, `qr`,
  `chol`, `solve`, `coxph`, `glm`), and a temperature `temp` that is not positive and finite in
  `optim`'s SANN (R stops on 0 with "non-finite value supplied by optim" and accepts a negative one),
  `binomTest([0, 0])` (no trials; R returns a p-value of 1 for `binom.test(c(0, 0))`, while `poissonTest` compares two
  counts of 0 as R), and a `covmat` in `factanal` and `omega` that is not square, finite and symmetric (as R's
  `isSymmetric`) with a positive diagonal (R's `factanal` analyses an asymmetric matrix), a time base `T` of 0 in
  `poissonTest` (R returns NaN or Inf for the estimate and the interval), counts whose total overflows in `binomTest`
  and `poissonTest` (R: NaN or an error), a fractional `B`, or goodness-of-fit counts summing to a fraction, in
  `chisqTest`'s simulation (R's p-value can exceed 1 there), fractional counts in `mantelhaenTest(exact: true)` (R
  returns a result), a table without discordant pairs in `mcnemarTest`, only zero differences in the signed rank
  `wilcoxTest`, two constant samples in `varTest`, fractional counts in `chisqTest`'s simulation of tables (R returns
  NaN or truncates the margins), groups that are all constant in `dunnettTest`, `tukeyTest` and `glhtDunnett` (a
  pooled variance of 0: R's p-values are 0 in `TukeyHSD` and PMCMRplus, 1 in multcomp's `glht`), and a step `eps` of 0 or a
  non-finite `d`, `eps` or `zeroTol` in `grad`, `jacobian` and `hessian` (numDeriv's "simple" method gives NaN for
  `eps = 0`; `d = 0` is an error there too).
- **The power and effect-size functions** reject NaN for a known quantity (pwr mostly stops with "missing value
  where TRUE/FALSE needed"; NaN was returned), a correlation outside [-1, 1] in `pwrRTest`, probabilities outside
  [0, 1] in `esH`, `esW1` and `esW2` (R: NaN), an empty or ragged matrix in `esW2` (R: 0), n <= 0 in `powerPropTest`
  (R: a power for n = 0, NaN below), and n < 2 in `pwrTTest` (as pwr). Solving for `sd` with `delta = 0`, or for
  `withinVar` with `betweenVar = 0`, says that the power does not depend on it (R: "lower < upper is not fulfilled").
  `cohensD` rejects infinite values and fewer than 2 observations (per group) with a message (effectsize: NA).

### Distributions

| Case | R | rStats.js |
|---|---|---|
| `qbeta` answer underflows (e.g. `qbeta(0.5, 1e-10, 2.5)`) | 2^-1024 (5.56e-309) | 0 |
| `qf` answer overflows (e.g. `qf(-1e-300, 1, 1, log.p = TRUE)`) | a finite value near 2^1023 | Inf |
| `dchisq`, `pchisq` and `qchisq` with df = -5e-324 (the least negative subnormal) | df / 2 rounds to -0, the point mass at 0: Inf, 0, 1, 0 | NaN (a negative df is invalid) |
| `qbinom` with non-integer size (e.g. 2.5) | searches with NaN from `pbinom` and returns meaningless values (including -0) | NaN (as `dbinom` and `pbinom`) |
| Uniform with overflowing max − min (min = -1e308, max = 1e308) | Inf / 0 / NaN | computed with both ends halved (`dunif` 5e-309, `punif(-1)` 0.5, `qunif(0.5)` 0) |
| `dmultinom` with finite weights whose sum overflows (`dmultinom(c(1, 1), prob = c(1e308, 1e308))`) | 0 (log -Inf) | 0.5 (log -0.693): the weights are divided by a power of 2 before they are summed |
| `dmultinom` where a category's share of the weights is below the double range (`dmultinom(c(1, 0, 0), prob = c(5e-324, 1, 1), log = TRUE)`) | -Inf | -745.133 (log 5e-324 - log 2): the term of that category from the log of its share |
| `dnbinom` with size = Inf | finite log probabilities such as -1.2e308 for prob < 1; NaN for log P[X = 0] with prob = 1 | -Inf and 0 |
| `qnbinom` with size = Inf and prob < 1 | Inf or NaN depending on p | always Inf (the mass is at X = ∞; p = 0 and 1 as in R) |
| `qnbinom` answer above 2^53 | an answer whose distribution function misses the target (log p −31.85 for a target of −32) | an answer that meets the target |
| `qsignrank`, `qwilcox` with tiny p (below about 1e-15), small upper-tail p, or deep log p | converts to a linear lower-tail p and compares with absolute slack 10ε, so returns 0 and similar (`qsignrank(1e-100, 1000)` is 0) | the answer by definition (69727) |
| `qsignrank`, `qwilcox`, `qhyper` with `log.p = TRUE` and p = -Inf | NaN | same as p = 0 (lower end of the support) |
| signrank with n = Inf, wilcox with m = Inf | crashes | NaN |
| Non-central `qbeta` with an infinite parameter (e.g. shape2 = Inf) | 0, 0.5 or 1 from a search on NaN | NaN |
| `qchisq(p, 0, ncp = 0)` (all mass at 0) | NaN or Inf | 0 |
| `pgamma(Inf, shape, rate = r)` with a subnormal r (below about 5.6e-309, so 1 / r overflows) | NaN | 1 (P[X ≤ Inf] = 1 by definition) |
| `pgamma(q, Inf, scale = s)` with 0 < q / s < 1, so `pchisq(q, Inf)` with 0 < q < 2 (all mass at +Inf) | NaN | the limits: lower tail 0, upper tail 1 (as R gives for every other finite q) |
| `df(0, df1, Inf, ncp, log = TRUE)` | not the log of the linear value (−1.386 with ncp = 0, where the linear value is 1) | log of the linear value |
| `qf` with df2 = Inf when the answer rounds to 0 | meaningless values such as 2e-130; Inf for log p = -1e-300 | value checked with the distribution function |

For very flat `qnbinom` cases (size = 1e-10, p = 1 − 1e-10 and similar) the rounding width of p
contains dozens of integers, so the answer can differ from R by dozens; both answers are checked
to have a distribution function within 16ε of p.

R's `dgeom` and `dnbinom` treat x as non-integer when |x − round(x)| > 1e-9 max(1, |x|).
rStats.js's `dpois` and `dbinom` use a threshold of 1e-7, which may differ from R near integers
(not verified).

- **Distributions outside base R** take extraDistr's names and parameters; `darcsine`, `parcsine`,
  `qarcsine` and `rarcsine` (not in extraDistr) are beta(1/2, 1/2) moved to (a, b); where b - a
  overflows (a = -1e308, b = 1e308) they are computed on the halved scale. An infinite
  shape or location is taken as the limit, where extraDistr's formulas give NaN or a stray value at
  the edges (`qkumar(0, Inf, 1)` is 1 there, 0 here). `qinvgamma` returns NaN for alpha <= 0, as
  `dinvgamma` and `pinvgamma` do (extraDistr's `qinvgamma` does not check alpha).
- **`distSummary`** follows these conventions: a moment that does not exist is NaN, an infinite
  one Infinity; the mode of a discrete distribution with two equal maxima is the larger, and NaN
  when the density has no unique maximum.

### Random numbers

- `setSeed(seed)` followed by any `r*` function or `sample` gives the same stream as R's
  `set.seed(seed)`. Discrete values, `sample` and the number of uniform draws consumed match
  exactly; continuous values agree to about 1e-13 (at most 1e-12), because the last bits of
  `Math.log`, `Math.exp`, `Math.pow` and `Math.tan` differ between V8 and glibc.
- **`rbinom` with n min(p, 1 - p) >= 30 (algorithm BTPE) is not R's stream.** The final acceptance test of R's
  rbinom.c adds the Stirling corrections of log ix! and log (n - ix)! where they are to be subtracted (an error of up
  to 0.013 in the log of the probability ratio at n = 60); rStats.js uses the right signs, so some draws are accepted
  or rejected differently and the stream departs from R's from there (`set.seed(439); rbinom(1, 10000, 0.5)`: R
  5023, rStats.js 4879). The binomial draws of `rmultinom` go through the same code.
- **`rbeta` with one huge shape and one up to 1e32 (2ab overflows) is not R's stream.** R returns the mean there
  (`set.seed(12); rbeta(5, 1.1, 1e308)` is 1.1e-308 five times, though the coefficient of variation is 0.95);
  rStats.js draws G from Gamma(m) for the smaller shape m and returns G / (G + B), which is the beta variate to double
  precision, so the stream departs from R's from there. With both shapes above 1e32 the mean is returned with R's
  stream, as R.
- **`rbinom` with p below 1.1e-16** (where 1 - p rounds to 1): R's inversion starts from (1 - p)^n = 1, so every draw
  is 0 although a success has probability n p (up to 1e-7); rStats.js starts from exp(n log1p(-p)). Both use one
  uniform per draw, so the stream stays R's; a uniform above exp(n log1p(-p)) gives 1 where R gives 0.
- The reference is the x86_64 build of R. The arm64 build fuses multiply-adds (FMA), which
  changes the last bit of `qnorm` and therefore of normal variates: `set.seed(42); rnorm(3)[2]`
  is -0.56469817139608869 on x86_64 and -0.5646981713960888 on arm64. JavaScript has no FMA, so
  rStats.js matches x86_64 R.
- Of R's RNG kinds, the uniform generators `"Mersenne-Twister"` (the default) and
  `"L'Ecuyer-CMRG"`, the normal kind `"Inversion"` and both sample kinds (`"Rejection"`, the
  default, and `"Rounding"`) are supported, through `RNGkind({ kind, sampleKind })`. R's
  `set.seed(seed, kind, sample.kind = ...)` is `RNGkind({ kind, sampleKind })` followed by
  `setSeed(seed)`, which gives the same state (R does the same internally); `setSeed` itself only
  takes the seed, so that the L'Ecuyer-CMRG generator is left out of bundles that do not use it.
  `RNGkind` returns an object (`{ kind, normalKind, sampleKind }`) instead of R's character vector,
  and choosing `"Rounding"` gives no warning.
- `getRandomSeed()`/`setRandomSeed()` use the same integers as R's `.Random.seed`: the kind code
  (`10403`, `403` with Rounding, `10407` for L'Ecuyer-CMRG), then 625 integers for
  Mersenne-Twister or 6 for L'Ecuyer-CMRG. Where R silently reseeds from the clock (an
  unsupported kind code, or an L'Ecuyer-CMRG state with seeds out of range or the first three
  all zero), `setRandomSeed` throws a RangeError, and so do `nextRNGStream` and `nextRNGSubStream`
  (R computes a meaningless state without checking).
- `rmultinom` returns an array of n arrays of length K instead of R's K × n matrix.
- `r2dtable` returns an array of tables, each an array of rows, instead of R's list of matrices.

### Hypothesis tests

- **Warnings are not returned** (such as "Chi-squared approximation may be incorrect" or "cannot
  compute exact p-value with ties"). Method names and all numeric fields match R.
- **`wilcoxTest`** with n = 3, one-sided exact interval: the achieved confidence level is 0.88.
  R reports 0.87 because its `psignrank(0, 3)` is 0.12500000000000003, 1 ulp above 1/8 (R itself
  reports 0.88 for the two-sided interval with n = 4).
- **`brunnerMunzelTest`** takes `confLevel` where lawstat takes `alpha` (`confLevel = 1 - alpha`),
  and returns an `alternative` field, which lawstat's result lacks. An empty sample throws "not
  enough 'x' observations" (or 'y'); lawstat returns meaningless numbers, because it indexes the
  ranks with `n1 + 1:n2` and `1:0` is `c(1, 0)`.
- **`pAdjust`** with the Hommel method throws when `n` is not an integer (R returns a value), and
  returns an empty array for an empty `p` with n > 0 (R returns 1).
- **`kruskalTest` and `flignerTest` with a list of one sample** throw rStats.js's "all observations
  are in the same group" (R: "'x' must be a list with at least 2 elements").
- **Character group labels** (`g` of `kruskalTest`, `aov`, `TukeyHSD`, the `pairwise*` tests, ...)
  are sorted in C-locale order, by code point; R sorts factor levels with the locale's collation,
  so the order of groups, and of the results listed by group, can differ (`"a"`, `"b"`, `"B"`
  sorts as `"B"`, `"a"`, `"b"` here and as `"a"`, `"b"`, `"B"` in an en_US locale). The same holds
  for the levels of the two factors of `chisqTest(x, y)` (the rows and columns of the table), which
  must be strings (`null` for missing values).
  It also holds for the factors of formulas (`modelMatrix`, `lm`, `aov`, `lmer`; `levels` fixes the order)
  and for the between-subject factors of `aovEz`. The within-subject factors of `aovEz` keep afex's
  order of first appearance in the data.
- **Formulas** are strings and support variable names, `.`, `+`, `-`, `*`, `/`, `:`, `%in%`, `^`,
  parentheses, `0` and `1`, one `Error()` term in `aov`, and random-effects terms `(lhs | g)` and `(lhs || g)` in
  `lmer` (not the covariance structures `diag()`, `cs()`, `ar1()` of lme4 2.0). Function calls (`log(x)`, `I(x^2)`,
  `poly(x, 2)`, `offset()`), backquoted names and transformed responses are not supported: compute
  the column first. Contrasts are `contr.treatment` (default), `contr.sum` and `contr.helmert` (and `contr.poly` in
  `lmer`). A
  formula that cannot be parsed throws "invalid formula: ..." instead of R's parse error.
- **The warnings of a fit** (`lm`, `aov` with or without `Error()`; such as "Error() model is singular" or an
  absent variable named in `contrasts`) are carried to `anova` (of all the fits compared), car's `Anova`, `aovSummary`
  and the effect sizes computed from them, each message once (R gives them when fitting only).
- **`dunnTest`** ranks the values as numbers. dunn.test 1.4.2 given a character group vector ranks them as text
  (so 10.06 before 8.88); with a factor it ranks them as numbers, which is what `dunnTest` reproduces.
- **`aovEz` messages that R completes with a printout of the data** (ids removed for missing
  values, empty within-subject cells, empty between-subject cells) stop where the printout starts.
- **`aovEz` and missing values**: a response that is `null` or `NaN` removes its id (afex's "Missing values for ...
  ID(s)"), an infinite response is an error, and rows with a missing id or factor value are dropped. When the error
  SSP matrix of a within-subject term is singular, a warning says that its p-values are uncorrected (afex prints none).
  A within-subject factor with one level is an error, as a between-subject one is (afex returns an empty table).
- **`aovEz` with a singular error SSP matrix** (for example fewer subjects than measurements): car gives no
  sphericity corrections ("Singular error SSP matrix"). rStats.js judges each on its own condition: the
  Greenhouse-Geisser epsilon tr(A)^2 / (p tr(A^2)) is defined for any nonzero A and is given; Huynh-Feldt only when
  d - p GG > 0 (otherwise NaN, and `correction: "HF"` corrects with GG); Mauchly's test only for a nonsingular matrix.
  Each omission comes with a warning. An eigenvalue of the error SSP matrix counts as 0 below 1e-12 of the largest one
  or 1e-24 of the sum of squares of the wide data, judged on the matrix in the metric of (P'P)^-1 (whatever the
  contrasts). So an error SSP matrix made only of the rounding of the data (additive data with decimal values, such as
  y = s_i + c_j with s_i = 0.3, 1.7, ...) counts as 0: no corrections and no Mauchly test, at any scale. car gives none
  either at the usual scales, but its absolute threshold gives W = Inf with p = 1 at 1e100 times the same data.
- **`Anova` (types II and III)** reports "residual sum of squares is 0 (within rounding error)" when the residual sum
  of squares is below sqrt(eps) times the total (centred, weighted) sum of squares of the response; car compares it
  with sqrt(eps) itself, which depends on the units.
- **`nextRNGStream`** takes only the L'Ecuyer-CMRG kind codes 10407 and 407, those `setRandomSeed` restores (R takes any
  code ending in 07).
- **Random generators with parameters that define no distribution** give NaN where R draws or returns 0: `rgamma`
  and `rweibull` with a negative (or NaN) shape and scale 0, `rlogis` with a negative scale. The uniforms R draws are
  drawn as well, so the stream after the call is R's.
- **`setRandomSeed`** refuses a Mersenne-Twister state whose position is negative or not an integer, or whose words are
  not 32-bit integers. R takes a negative position as given, and its first draw then reads the position slot itself as a
  state word. A position past 624 regenerates on the next draw, as in R.
- **`rwilcox`** throws "m + n must be at most 2147483647" where R's allocation of the ranks fails.
- **Comparisons of fits** (`anova(fit1, fit2)` for lm, `glmAnova` with several fits) require the same rows, response
  values and weights; R compares only the number of rows (and for glm drops fits with another response formula).
  `lmerAnova` checks the same.
- **Confidence levels outside (0, 1)** are errors in `confint` and `predict` for lm (R gives NaN limits, or an interval
  of another coverage for a negative level) and in the effect sizes (`cohensD`, `etaSquared`, ..., as effectsize).
- **`qr`** rejects a negative `tol` (R accepts it, and then no column is dependent); `tol: Infinity` gives rank 0.
- **`lmerAnova` comparing fits that differ in a variance component** uses the chi-squared distribution, as lme4: the
  null value 0 is on the boundary, so the p-value is conservative (the reference distribution is a mixture of
  chi-squared distributions, 0.5 chi2_0 + 0.5 chi2_1 for a single random intercept).
- **Inputs without meaning** that R lets through: an infinite count in `chisqTest` (R returns NaN), an infinite
  offset in `glm` (R stops on the working response; rStats.js had returned coefficients of 0), and a distribution
  function returning values outside [0, 1] in `ksTest` (R reports D = 1.5 and p = 0 for one returning 1.5) are errors.
- **`glmAnova`** rejects fits of different families or links (R uses the first fit's family for all).
- **`glmConfint`** gives NaN limits when the fit, or a restricted fit of the profile, does not converge.
- **The inverse Gaussian family** requires a positive mean (R's validmu accepts any): a step of the iterations to a
  mean of 0 or below is halved, where R goes on to NaN working weights.
- **`lmerAnova` of fits that are not nested** (fixed-effect columns of the smaller fit missing from the larger, or a
  random-effect term not within a term of the same grouping factor there, such as `(1 | g)` against `(1 | h)`) gives
  no Chisq and p-value; lme4 reports a likelihood ratio test for any pair. AIC and BIC compare them as before.
- **`coxph`** takes a time censored at `Inf` as at risk throughout and rejects an event at `Inf`, as `survdiff` and
  `survfit` (R stops on any infinite time).
- **The noncentral `pbeta`** checks its parameters before the ends of the support: a negative shape or a negative or
  infinite ncp gives NaN (R returns 0 or 1 at q <= 0 or q >= 1 for them, and the central `pbeta` NaN). Shapes of 0
  (point masses) keep the ends, as in R.
- **`qnbinom`** with a negative size or mu is NaN, as `dnbinom` and `pnbinom` (R's `qnbinom` returns 0 for mu = 0 or
  size = 0 before checking them).
- **`qgamma` and `qchisq`** with a negative shape or df, or a scale <= 0, are NaN also at p = 0 and 1, as the density
  and distribution function (R returns 0 and Inf there).
- **`qgeom`** takes the slack of the other discrete quantiles (8 ε relative on p, 2 ε on the log scale) where it is
  below half a step, and is otherwise exact for p as given; it equals `qnbinom` with size 1. R's closed form subtracts
  1e-12 from the ratio of logs, which takes y − 1 for a p up to 1e-12 relative above a jump: `qgeom(0.7500000000000866,
  0.5)` is 1 in R, where P[X <= 1] = 0.75 < p (2 here, as R's `qnbinom(p, 1, 0.5)`), and
  `qgeom(0.8757104766401955, 1.1843097327690854e-6, lower.tail = FALSE)` is 112065 in R (112064 here and in R's
  `qnbinom`, p being `pgeom(112064)`).
- **`phyper` and `qhyper`** whose support reaches beyond 2^53 are NaN: the tail sums step through the integers one by
  one, which no longer move there (`phyper(5e16, 1e17, 1e17, 1e17)` did not return). Below 2^53 the time grows as
  sqrt(m + n), about 40 s at 1e16.
- **`dwilcox`, `pwilcox` and `qwilcox`** with mn beyond 2^53 are NaN: the statistic ranges over 0..mn, whose
  integers are not all doubles there (as `phyper` above). The table was built in min(m, n) passes even for one
  entry (`dwilcox(0, 1e12, 1e12)` would have taken about 50 minutes).
  The bound is on the exact product: m = 3, n = 3002399751580331 (mn = 2^53 + 1, which rounds to 2^53) is NaN too.
  Likewise **`dsignrank`, `psignrank` and `qsignrank`** are NaN for n >= 2^27, where n(n + 1)/2 exceeds 2^53 (R's
  `psignrank(5, 134217733)` did not finish in two minutes).
- **`omega`** adds a warning when the minres fit (L-BFGS-B) does not converge ("minres did not converge ...");
  psych's `fa` goes on from the last point silently. The values are the same.
- **`mauchlyTest`** drops the rows of `y` with a missing value and those with a missing `group` (as `lm(y ~ group)`);
  an infinite value is an error.
- **No residual degrees of freedom is an error** in `aovEz` (fewer subjects than between-subject parameters, or as
  many) and in `mauchlyTest` (as many complete rows as groups), where R returns NaN.
- **`icc`, `cronbachAlpha` and the other functions on rating matrices** reject infinite values ("contains infinite
  values").
- **`poissonTest`** requires a finite `T` and `r` (R accepts `Inf`). The one-sample test accepts `confLevel` 0 and 1
  as R does (the two-sample test, as `binomTest`, needs 0 < `confLevel` < 1).

- **`coxph`** takes the covariates as a matrix (no formula), and non-integer case weights throw "non-integer
  weights (robust variance) are not supported yet": R switches to the robust (sandwich) variance for them.
  R's own results for a coefficient running off to infinity over many iterations depend on the platform (x86_64
  and arm64 R differ by 1e-7 after 20 iterations), so such fits agree with R only to that size.
- **`omega`** with one factor reports the group column of the Schmid-Leiman matrix and the group omegas as exactly 0;
  R reports the square roots of rounding residues (about 1e-8). With four or more group factors R's own results move
  by up to 4e-11 when the data change in the last bit, so `omega` agrees with R to about that size there (1e-12 with
  up to three).

### Data handling

- **`subset`** takes the condition as a boolean per row or a function of the row (`(r) => r.age >= 20`), not an
  expression; `select` is an array of names. A missing condition counts as false, as in R.
- **`split`** returns a `Map` (in R's order of the groups), since a plain object would move integer-like names
  first.
- **`aggregate`** summarises numeric columns with a function returning a number or the same number of values for
  every group (R would also make list columns).
- **`pivotLonger` and `pivotWider`** return the data frame; tidyr's warnings go to the optional `onWarning`
  callback. A cell that several rows fill is an error in `pivotWider` (tidyr warns and makes a list column):
  summarise them with `valuesFn`. Regular expressions (`namesSep`, `namesPattern`) are JavaScript's.
- **`merge`** never matches a number key with a string key (R converts one to the other); `merge` and `cbind`
  throw on a duplicated column name, which R allows but an object of columns cannot hold.

### Linear models

- **`lm` with every weight 0** throws "all weights are zero"; R returns NA coefficients.

### Generalized linear models

- **No formulas:** `glm` takes the predictors as a matrix (or a vector), with a column of ones added
  unless `intercept` is false, and the response as a vector or, for the binomial families, rows of
  (successes, failures). Each column is one term: `glmAnova` adds the columns one by one (rows
  `"x1"`, `"x2"`, ...), so a factor coded as several columns is several rows of the table. Coefficient
  indices (`parm` of `glmConfint`) are 0-based, intercept first.
- **`glmAnova` warns about a model that has not converged** ("model k has not converged: its deviance is not that of
  the maximum likelihood fit"); the table is R's. R's `anova` tests such fits without a word.
- **`glmConfint` computes the exact profile likelihood limits.** R's `confint` for a glm moves each
  coefficient on a grid of steps of about 1/5 of its standard error and interpolates a spline through
  the signed roots of the likelihood ratio (or score) statistic; its limits are up to 4.5e-4 standard
  errors from the exact ones in the test fixture. rStats.js solves z(b) = qnorm((1 ∓ level)/2) by
  Brent's method, with the fit and every profile refit iterated until the coefficients stop changing
  (R's rule on the relative change of the deviance stops while they can still move by about
  sqrt(epsilon)), and the dispersion from the converged fit. The limits agree with the exact references
  of the test fixture (computed in R from fits converged in the same way) to 1e-14 standard errors.
- **Warnings** are returned, not emitted: `glm`'s result has R's warnings in `warnings` (each message
  once, in order of first appearance), including those of R's `dpois` in the Poisson AIC
  (`"non-integer x = 0.500000"`) and of `sqrt` in the `1/mu^2` link (`"NaNs produced"`).
  `glmSummary` and `glmAnova` return their own (`"observations with zero weight not used for
  calculating dispersion"`, `"using F test with a 'binomial' family is inappropriate"`, and those of
  the refits of `glmAnova`); `glmResiduals`, the influence measures and `glmPredict` return none.
  The intercept-only refit for the null deviance of a model with an offset reports the warnings of
  its iterations too (R's `glm.fit` gives them as well).
- **Not available:** `etastart` and `mustart` (use `start`), `method`, `singular.ok = FALSE`, and the
  `x`, `y` and `model` flags (the model matrix and response are always kept, in `model`).
- **Comparisons with R in the tests:** residuals of a well-fitting model cancel in y − mu and are
  compared relative to max(|y|, |mu|) (scaled as each kind of residual is), deviance residuals and
  deviances relative to the rounding of the logarithms of y/mu, and linear predictors near 0 relative
  to the sum of |x_j b_j|. Beyond these, three kinds of cases differ from R by more than 1e-12:
  complete or quasi-complete separation, where the estimate is at infinity and the coefficients are
  where the iterations stopped (they agree to 4e-11; the weights exp(−|eta|) and what depends on them,
  such as the hat values, to 1.5e-9); fits stopped at the boundary with a mean within 1e-8 of the end
  of its range (log-binomial with mu near 1, identity-Poisson with mu near 0), which is the result of a
  cancellation and known only to eps times its condition number (up to 7.3e-4 for a standard error
  that depends on a mean of 3.9e-14); and the AIC of a gaussian perfect fit, n log of a deviance that
  is rounding residue.

### Mixed models

- **`lmer` returns the exact optimum** of the REML criterion (or the ML deviance), found by Newton's method with
  the analytic gradient. lme4's optimiser stops when its own tolerances are met, typically 1e-9 to 1e-5 (relative)
  from the optimum in θ, so θ, the variance components (`VarCorr`), the standard errors and the random effects
  differ from lme4's in about the 5th to 9th significant digit; the fixed effects and the log-likelihood agree to
  more digits (the criterion is flat at the optimum). lme4's convergence warnings (`Model failed to converge ...`)
  are not emitted.
- **Local minima:** the criterion can have several local minima (for example crossed groups without a fixed
  intercept, where one term can take the place of the intercept). After the local minimisation, rStats.js compares
  the fit with the boundary points where one random-effects term is removed (its variances set to 0), minimised
  over the other terms, and continues from the lowest of them if it is lower. This finds the global minimum in the
  usual case of two crossed terms, but it is not a global optimiser: with three or more terms, two of them can
  change roles (one taking the place of the intercept instead of the other), and the fit can then stay above the
  model without one of its terms. lme4 can stop at a higher local minimum where rStats.js does not; rStats.js then
  reports a different (better) fit of the same model, often singular.
- **A singular fit is judged at the exact optimum:** an element of θ whose optimum is on the boundary is exactly 0,
  and `singular` and the message `boundary (singular) fit: see help('isSingular')` follow from it. Where lme4 stops
  just inside the boundary (θ above its threshold of 1e-4) it reports a non-singular fit that rStats.js reports as
  singular.
- **Terms with two or more columns** (`(x | g)`): when the variance of the first column goes to 0, lme4's
  bound-constrained optimiser can stop at a point that is not a minimum, because the criterion does not change
  when a column of the covariance factor changes sign. rStats.js minimises without that bound and reports the
  equivalent factor, so it can reach a lower criterion than lme4 there (a better fit of the same model).
- **The computation is sparse,** as lme4's, but in JavaScript: a fit takes about 2.5 to 3 times lme4's time (see
  [performance.md](performance.md)).

- **Options are checked:** an option that R's `lmer` has but rStats.js does not support (`weights`, `offset`,
  `subset`, `naAction`, `control`, `start`, ...) is an error, and so is an unknown key (`unused argument (reml)`; R
  also writes the value). lmerTest's `summary`, `contest` and `anova` ignore unknown arguments (`summary` with a
  warning); `lmerSummary`, `lmerContest` and `lmerAnova` reject them. The logical options (`REML`, `joint`,
  `confint`, `refit`) take booleans and numbers (0 is false), as R does, but not strings (R accepts `"TRUE"`, `"F"`
  and the like).
- **A response fitted exactly by the fixed effects** (a constant response with an intercept, or as many fixed
  effects as observations) is an error: the residual variance is 0 and there is no estimate. lme4 returns a σ of
  rounding size and a log-likelihood near +∞ (or fails when there are as many fixed effects as observations).
- **A random-effects term without columns** (`(0 | g)`, `(0 || g)`) is an error with its own message, where lme4
  fails with internal messages.

- **lmerTest's tests** (`lmerSummary`, `lmerContest`, `lmerAnova`) use exact (analytic) derivatives of the deviance
  and of the covariance of the fixed effects at the exact optimum; lmerTest differentiates numerically at lme4's
  approximate optimum. The Satterthwaite degrees of freedom therefore differ from lmerTest's in about the 4th to
  8th significant digit (agreeing to about 1e-13 with references computed in 128-bit arithmetic), and the p-values
  correspondingly. The Hessian's warnings (`Model failed to converge with ...`, `Model may not have converged
  with ...`) are decided from the exact Hessian and returned in each result's `warnings`, not emitted when the
  model is fitted. Only Satterthwaite's method is available (not Kenward-Roger's, nor `ddf = "lme4"` in
  `lmerAnova`); `ranova`, `ls_means`, `difflsmeans` and `step` are not implemented.
- **`lmerContest` with `joint: false`** accepts a right-hand side per row of L (`rhs: [1, 0, 2]`), each row tested
  against its own value; lmerTest gives an error there.
- **`lmerContest` with an infinite L or rhs** is an error (lmerTest gives a row of NaN for an infinite L, and F Inf with
  p 0 for an infinite rhs); NaN gives NaN results, as lmerTest's NA. `level` must be strictly between 0 and 1, as in
  lmerTest.
- **Comparing fits** (`lmerAnova([fit1, fit2])`): the REML fits are refitted by maximum likelihood to the exact ML
  optimum (lme4's refit stops near it); the fits must be results of `lmer` on the same data object, unchanged
  between the fits. The hypotheses and refits of `lmerAnova` are built from a copy of the data taken at the fit, as R
  uses the model frame stored in the fit.
- **The denominator df of a joint F test** takes the term ν/(ν − 2) of an infinite ν as its limit 1, and is infinite
  when every ν is (lmerTest's formula gives NaN there, and an error when every ν is infinite).

### Linear algebra

- **Matrices** are passed as arrays of rows; a 0-row matrix is treated as 0 × 0.
- **`qrSolve`** keeps a NaN of the solution (from a NaN in the response); only the coefficients of the columns the
  decomposition leaves out (of a wide matrix) are 0. R's `qr.solve` sets every NA and NaN to 0 (`qr.solve` of the
  identity with b = (NaN, 1) is (0, 0)).
- **Eigenvectors and singular vectors** may have the opposite sign from R; both are correct.
  Complex eigenvectors are scaled so that the component with the largest modulus is real and
  positive (R's `dgeev` only makes that component real). Vectors for repeated eigenvalues or
  singular values, and singular vectors beyond min(rows, columns), are not unique and generally
  differ from R.
- **Algorithms:** `svd` uses Golub–Reinsch and `eigen` uses the EISPACK algorithms `tred2`,
  `tql2`, `orthes` and `hqr2` (R uses LAPACK's `dgesdd`, `dsyevr` and `dgeev`). Values agree to
  rounding. The general `eigen` balances the matrix first as `dgeev` does (`dgebal`). `eigen`, `svd` and `schur`
  scale a matrix whose largest entry is outside [2^-256, 2^256] by a power of 2 before the decomposition (exact),
  so that its sums neither overflow nor underflow.
- **`rcond` of triangular matrices** solves by plain substitution instead of `dlatrs` (which
  rescales to avoid overflow), so matrices on the edge of overflow may give a different value.
- **`chol`** propagates NaN on the diagonal instead of failing (R's OpenBLAS does the same; the
  reference `dpotf2` stops). With `pivot: true`, a rank-deficient matrix returns `rank` instead
  of a warning, and the diagonal at the stopping position holds the remaining value at that
  point.
- **`solve`** with NaN or Inf in the matrix solves without the condition check (LAPACK 3.12's
  `dgecon` returns an error that R ignores); `rcond` of the same matrix throws.

### Numerical methods

- **Third derivative of a cubic Hermite spline** (`splinefunH`, and `splinefun` with
  `method: "monoH.FC"`, `deriv = 3`): rStats.js returns the mathematically correct value,
  (6 m_i + 6 m_{i+1} − 12 δ) / h² on an interval of width h. R (4.5.2 and R-devel) returns h times
  that, dividing by h only once, which looks like a bug in R; the two agree on intervals of width 1.
  For example `splinefunH(c(0, 2), c(0, 0), c(1, 1))(1, deriv = 3)` is 6 in R and 3 here.

## Behaviour matched to R

These were determined from R's documentation and observed output, and for the special functions
also from R's source. They are listed because they are easy to get wrong.

### Distributions

- Slack in discrete quantile searches: relative 8ε for linear p and 2ε for log p.
- Beta point masses are checked in the order q ≥ 1, then parameters 0 or ∞, then q ≤ 0.
- `df(Inf, df1, df2)` is NaN for df1 < 2 and 0 otherwise.
- Hypergeometric and rank distributions round parameters half to even. `dhyper` returns NaN for
  non-integer m, n, k; `phyper` and `qhyper` round them. `psignrank` uses round(q + 1e-7), the
  others floor(q + 1e-7). Signrank/wilcox n and m are rounded and give NaN if ≤ 0.
- Non-central beta `pbeta` returns 0 or 1 for x ≤ 0 or x ≥ 1 even with invalid parameters.
  Non-central chi-squared and beta with ncp = Inf give NaN (`qchisq` returns values only at the
  end points). `pf(·, Inf, df2, ncp)` is NaN; `df(·, Inf, df2, ncp)` ignores ncp;
  `df(Inf, df1, finite, ncp)` is NaN.
- The gamma distributions (and so `dgamma`, `pgamma`, `qgamma`) with a rate below about 5.6e-309 (subnormal):
  scale = 1 / rate overflows to Inf, and the distribution is treated as lying at +Inf: `pgamma` and `dgamma`
  are 0 at every finite x and `qgamma` is Inf, as in R (some quantiles of the exact distribution would be finite,
  for example about 0.3 for `qgamma(3.3e-160, 0.5, rate = 4.19e-319)`). Only `pgamma(Inf, ...)` differs (1, not
  NaN; see the table of deliberate differences).
- `ptukey` returns NaN for nmeans < 2, df < 2 or nranges < 1; non-integer nmeans and nranges are
  accepted.
- The order in which arguments are checked (for example, `qcauchy` with scale = 0 returns
  location before looking at p) follows R.

### Hypothesis tests

- **Missing values:** tests remove only NaN and keep Inf (`wilcoxTest`, `corTest`). Paired tests
  remove pairs. `cor` with the default `use: "everything"` returns NaN when the data contain NaN,
  as in R.
- **Confidence level checks:** `tTest` accepts exactly 0 and 1 (1 gives ±Inf);
  `wilcoxTest` (only when `confInt` is true) and `fisherTest` (always) require an open interval;
  `corTest` checks it only for Pearson.
- **`tTest`:** data are "essentially constant" (an error) when the standard error is below 10ε
  times the absolute mean. The equal-variance method name starts with a space
  (`" Two Sample t-test"`), as in R.
- **`chisqTest`:** Yates' correction subtracts min(0.5, min |O − E|) from all cells (SciPy
  corrects per cell); if that amount is 0, the method name does not mention Yates. Matrices of
  2 × 2 or larger reject negative, NaN and Inf entries; vectors and 1-row or 1-column matrices
  reject negative and NaN entries, Inf gives a NaN statistic, and 1-row or 1-column matrices are
  treated as goodness-of-fit tests. `p` must sum to 1 within sqrt(ε) and is used without
  renormalising. No `alternative` is returned.
- **`fisherTest`:** the odds-ratio estimate and interval reproduce R's `uniroot` behaviour,
  including its error: the value at ψ = 1 decides whether to search ψ ∈ [0, 1] or 1/ψ ∈ [ε, 1]
  with Brent's method (tolerance ε^0.25), so results can be up to 0.7% from the true root (the
  upper limit for the tea-tasting table is 621.93 in both R and rStats.js; the true root is
  626.24). The two-sided p-value sums tables with probability up to 1 + 1e-7 times the observed
  one. Non-integer counts are rounded half to even. A 2 × 2 table with a zero margin gives p = 1,
  estimate 0, interval [0, Inf]. For r × c tables `alternative` is not checked and is returned as
  given. No `statistic` is returned.
- **`wilcoxTest`:** by default (`exact` unset) the exact method is used for n < 50 after removing
  zeros (both samples < 50 for two samples) without ties; with ties or zeros the normal
  approximation is used even with `exact: true`. Normal-approximation intervals and estimates use
  the same search range and objective as R and match to the last digit. When the achieved α of
  an exact interval is more than α/2 from the target, the reported confidence level is replaced
  (signed rank: 1 − signif(α, 2); rank sum: not rounded).
- **`corTest`:** Spearman's exact test (Best and Roberts 1975, AS 89) is used for n ≤ 1290
  without ties (R's help says n < 1290, but 1290 is exact too): full enumeration for n ≤ 9,
  Edgeworth series above. The p-value uses round(S). Spearman's `continuity` applies only to the
  t approximation and always moves rho towards larger values, (rho + d)/(1 + d) with
  d = 6/(n³ − n), regardless of sign or alternative; this looks like an R bug but is matched.
  Kendall's exact test is the default for n < 50 without ties, and `exact: true` forces it for
  n ≥ 50; `continuity` replaces S with sign(S)(|S| − 1). Pearson needs at least 3 pairs, Kendall
  and Spearman at least 2; intervals need at least 4. Constant data give NaN statistic, p-value
  and estimate.
- **`ansariTest` interval (`confInt: true`):** computed as R 4.5.2 does, with the locations taken as
  0. Exact: the candidate ratios are the x_i / y_j ≥ 0, the statistic of x / s against y is
  evaluated between consecutive candidates (and at 2.01 times the largest), the limits are the
  candidates where it crosses R's `qansari` quantiles (whose cumulative sums have no slack, so a
  probability that is exactly 1/2 can be missed by rounding, as in R), and limits that cannot be
  formed are NaN (R's NA). Normal approximation: the standardised statistic (R 4.5.2's tie-corrected
  variance with the no-ties mean; R-devel changed it) crosses the normal quantiles; the roots are
  found with `uniroot` (tolerance 1e-4) between the smallest and largest ratio of the positive values
  and of the non-positive x to the negative y; 0 / 0 at s = 0 is ranked last, as R's `rank` puts NA
  last.
- **Simulated p-values** (`chisqTest`, `fisherTest`): (1 + number of simulated statistics at least
  (1 − 64ε) times the observed one) / (B + 1); for `fisherTest`, simulated tables whose
  −Σ log(x_ij!) is at most the observed one / (1 + 64ε). The method gets R's suffix
  `" with simulated p-value\n\t (based on B replicates)"` and the parameter is NaN (R's NA).
  `chisqTest` uses the uncorrected statistic, does not simulate when a margin is 0 (the ordinary
  test), and for goodness of fit draws B n categories at once and counts them n at a time (with a
  non-integer total n, R's matrix of floor(n) rows, recycled, is reproduced). `fisherTest` drops
  empty rows and columns first and ignores `simulatePValue` for 2 × 2 tables. `B: 0` gives p = 1.
- **`pAdjust`:** `n` defaults to the number of non-NaN values, and a smaller `n` is an error.
  p-values outside [0, 1] are processed, with only the upper end capped at 1. Abbreviated method
  names are case-sensitive.

### Generalized linear models

- **Links:** a power link with lambda <= 0 is the log link (named `"log"`) and with lambda = 1 the
  identity; other power links are named `"mu^"` with lambda rounded to 3 decimals. The inverse links
  and their derivatives have R's clamps (eps = 2^-52 for logit beyond |eta| > 30, the log link,
  probit and cauchit at the eps quantile, cloglog).
- **Iterations:** step halving after a non-finite deviance and after an invalid mean or linear
  predictor sets the boundary flag, which reports the last iteration; "no observations informative at
  iteration k" is a warning that ends the iterations without convergence. The working weights reported
  (and used by the dispersion, the influence measures and the standard errors) are those of the last
  least squares step, computed from the means before the last update; the QR tolerance is
  min(1e-7, epsilon/1000), so with `epsilon: 1e-14` an exactly collinear column is no longer aliased.
- **AIC:** the gaussian AIC sums log w over all rows, so a prior weight of 0 makes it infinite; the
  binomial AIC rounds m y half to even, as R's `round`.
- **`glmAnova`:** the refits of the sequential table use the same `start` as the fit, which has the
  wrong length for the smaller models (an error, as in R); the default test is `"Chisq"` when the
  dispersion is known and `"F"` otherwise (R 4.4.0 and later).

### Linear algebra

- **`qr` default pivoting:** columns are processed left to right; a column whose remaining norm
  is below its original norm × tol (always, if the original norm is 0) is moved to the right end,
  and moved columns are still transformed when their turn comes. rank = min(columns − moved,
  rows).
- **`qrFitted`, `qrResid`:** with k = 0 they return y unchanged; a 1-row matrix has residual 0.
- **`qrX`:** `ncol` defaults to min(rows, columns); with pivoted columns, an `ncol` smaller than
  the number of columns is an error.
- **`qrSolve`:** an error unless rank = min(rows, columns). For wide matrices the unused
  coefficients are 0. `b` may be omitted only for square matrices.
- **`qr(x, { lapack: true })`:** `qraux` (tau) has min(rows, columns) elements, one
  per reflection, as in R; rank is always min(rows, columns); `qrFitted` and `qrResid` throw. Matrices
  containing NaN or Inf are not rejected (R also returns meaningless values; the values need not
  match R's).
- **`kappa`:** the default (`exact: false`) applies LINPACK's `dtrco` estimate to R from a QR
  decomposition (after transposing wide matrices). With `norm: "I"` it uses the same triangle of
  the transposed matrix, as R does. `triangular` has an effect only with `method: "direct"`, and
  then also uses `dtrco`. As in R, these estimates through a triangular factor use the infinity norm only
  for `norm: "I"` (not `"i"`) and the 1-norm for any other norm; R's warnings about the replaced norm are not
  reported. Exact `kappa` of a singular matrix is Inf.
- **`norm`:** `type` must be a single letter ("One" is an error). `type: "2"` returns NaN if the
  matrix contains NaN and throws if it contains Inf.
- **`eigen`:** a matrix is treated as symmetric when sum|A − Aᵀ| / sum|A| ≤ 100ε (as
  `isSymmetric`), and then only the lower triangle is used. General matrices return eigenvalues
  in decreasing modulus, ties in their original order (the conjugate with positive imaginary part
  first).

### Special functions

By default rStats.js returns what R returns;
`{ rCompatible: false }` returns the mathematical value instead.

- **n near an integer in `choose` and `lchoose`:** R treats n within 1e-9 max(1, |n|) of an
  integer as that integer, so `choose(1e-10, 2)` is 0 (mathematically -4.9999999995e-11) and
  `choose(5 + 1e-9, 2)` is 10. For k < 30 `choose` keeps n in the product and rounds the result;
  for k ≥ 30, and in `lchoose` for k ≥ 2, n itself is rounded, and for n < 0 the test is made on
  k − 1 − n (so the tolerance is relative to it). `lchoose(n, 1)` is log|n| without rounding.
- **Infinite arguments:** `choose(±Inf, k)` is NaN for k ≥ 30 (±Inf below) and `lchoose(±Inf, k)`
  is NaN for k ≥ 2; `choose(n, Inf)` is 0 and `lchoose(n, Inf)` is -Inf for finite n ≥ 0, NaN
  otherwise. With `rCompatible: false`, `choose(±Inf, k)` is ±Inf for every k and
  `choose(n, Inf)` is NaN.
- **`trigamma(-Inf)` and `psigamma(-Inf, deriv)`:** R treats -Inf like the poles, giving Inf for
  odd deriv and NaN for even (always NaN with `rCompatible: false`).
- k in `choose` and deriv in `psigamma` are rounded half to even (`psigamma(x, 2.5)` is
  `psigamma(x, 2)`).

### Numerical methods

- **Functions are plain JS functions of a number** (`integrate`, `optimize`, `uniroot`) or of an
  array (`grad`, `jacobian`, `hessian`); extra arguments (R's `...`) are passed through a closure.
  `ode`'s `func(t, y, parms)` returns the derivatives as an array (deSolve's `list(dy)`) and the
  result is an array of rows `[t, y1, y2, ...]`.
- **Results agree with R to the last bits where the functions do.** Where R and JS evaluate a
  function differently in the last bit (R's `sum` accumulates in long double; `exp`, `log`, `sin`
  and `cos` come from different libraries), the error estimate of `integrate` moves by up to a few
  percent, a flat optimum by about 1e-14, and numerical derivatives by up to 1e-9 relative (a
  difference quotient magnifies the function's rounding by |f| / h).
- **`uniroot`** returns `initIt` as NaN when the interval was not extended (R's NA) and does not
  warn when `maxiter` is reached (`iter` is then `maxiter`, as in R).
- **`optimize`** searches with NaN and +Inf values of the function as the largest double and -Inf as the most
  negative, as R does, without R's warnings ("NA/NaN replaced by maximum positive value" and the like); `objective`
  is the function's own value there (NaN or -Inf, as in R).

## Not supported

- Recycling of distribution parameters (`rnorm(3, mean = c(0, 10, 100))`).
- RNG kinds other than R's default.
- Fisher's `hybrid` and `workspace`, and Wilcoxon's `digits.rank`. Kendall's concordance count is O(n²).
- `kappa`'s `inv_z`, complex matrices, and `EISPACK = TRUE` / `LINPACK = TRUE`.
- Formulas for `glm` (the predictors are a matrix; see [ROADMAP.md](../ROADMAP.md)).
- `lmer`: the covariance structures of lme4 2.0 (`diag()`, `cs()`, `ar1()` terms), `weights`, `offset`, `subset`,
  `na.action` (rows with a missing value are always dropped), `start` and `control`; `predict`, `simulate`,
  `confint` and `profile`; lmerTest's Kenward-Roger method, `ranova`, `ls_means` and `step`; `glmer` and `nlmer` (see
  [ROADMAP.md](../ROADMAP.md)).
- numDeriv's complex-step method (`method = "complex"`), which needs a function of a complex
  argument, and the `side` argument of `grad` and `jacobian`.
- deSolve's adaptive solvers (`lsoda`, `ode45`, ...); `ode` has the fixed-step `euler`, `rk2`
  and `rk4`.
- `coxph`: counting-process data (`Surv(start, stop, event)`), `ties = "exact"`, offsets, clusters and the robust
  variance, `tt()` terms and residuals; concordance.
- `omega`: factoring methods other than minres, rotations other than oblimin, `n.iter` (bootstrap intervals) and
  `poly = TRUE`.
