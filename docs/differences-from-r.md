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
| `dchisq(1e4, 5, ncp = 10, log = TRUE)` | -2975.1 | -4688.08 | same as truth |
| `dchisq(1e-300, 0, ncp = 1)` | 0 | 0.1516 | same as truth |
| `df(1e10, 5, Inf, ncp = 0, log = TRUE)` | -1.25e11 | -2.5e10 | same as truth |
| `qchisq(-1e10, 5, ncp = 1, lower.tail = FALSE, log.p = TRUE)` | 2.29e10 | 2.00e10 (checked with the distribution function) | same as truth |

### Special functions

The comparison values for these come from mpmath (100 to 800 digits) rather than Rmpfr.

- **`choose` and `lchoose`** with a non-integer n and large k: R is off by up to 2.6e-10
  (`choose(10.3, 1e5)`).
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
| Dunnett-type p-values (multcomp's Dunnett, PMCMRplus's `dunnettTest` and single-step `kwManyOneDunnTest`) | mvtnorm's randomised integration: about 1e-3 absolute, different from run to run (seeded) | exact one-dimensional integral |
| Studentized-range p-values of post-hoc tests (Steel-Dwass, Games-Howell, Tukey) | R's `ptukey`, about 8 digits (off by up to 3.4e-8 in the tests) | full precision |
| irr's kappa p-values | formed as 2 (1 − Φ(|z|)), losing small ones (2.2e-16 instead of 1.7e-16) | 2 Φ(−|z|) |
| polycor's maximum-likelihood estimates and standard errors (`ML = TRUE`, `std.err = TRUE`) | Nelder-Mead or BFGS stops early and the Hessian is taken by finite differences: off by up to 1e-3 relative; on strongly associated tables the two-step BFGS runs past 1 and reports 0.9999 with an infinite variance | the exact maximum (within 4e-15 of 160-bit values) and the analytic Hessian |

### Distributions outside base R

The R references are extraDistr (invgamma, kumar, pareto, triang, laplace), R's beta functions (arcsine) and
closed forms written in R (`distSummary`). The values here agree with 50-digit mpmath values
(`scripts/mpmath/extradist.py`, `scripts/mpmath/distsummary.py`).

| Case | R | rStats.js |
|---|---|---|
| Tails of `pinvgamma`, `pkumar`, `ppareto`, `plaplace`, `ptriang` | extraDistr evaluates the textbook formulas: 1 − x^a and 1 − p cancel and log probabilities are taken after the probability underflowed (`pkumar(1e-10, 1, 1)` is off by 8e-8, `pinvgamma(1e-300, 1, 1, log.p = TRUE)` is −Inf instead of −1e300) | tails computed directly |
| Quantiles in the far tails (`qlaplace`, `qkumar`, `qtriang`, ...) | 1 − p rounds: `qlaplace(1e-300, lower.tail = FALSE)` is Inf | correctly rounded (maps back to p) |
| Densities steep in a parameter (`dinvgamma` with alpha = 100, `dtriang` near the ends) | the rounding of beta / x or b − x is magnified (to 9e-14) | the division in double-double |
| `distSummary` skewness and kurtosis of `weibull` and `kumar` | the raw-moment formulas cancel: 9 digits of the kurtosis lost for shape 20 | central moments integrated directly (3e-14) |
| `erfinv` of a small argument (pracma's definition through `qnorm((1 - |y|) / 2)`) | the relative accuracy of y is lost: `erfinv(1e-10)` off by 8e-8, `erfinv(1e-300)` is −0 | Newton steps on `erf` |
| `gammainc` (R's `pgamma(x, a) * gamma(a)`) | two roundings, and exp of a large log where the product overflows (1e-13 for a = 200) | the series for x < a with `pow` |

## Where R fails and rStats.js returns a value

| Case | R | rStats.js |
|---|---|---|
| `pbinom(36, 1e5, 0.01, log.p = TRUE)` | -Inf (internal underflow, with a warning) | -851.68… |
| `qbinom(-1e10, 1e5, 0.01, log.p = TRUE)` | 37 (search stops early) | 0 (F(0) ≈ e^-1005 exceeds e^-1e10) |
| `qt(1e-320, 2)` (subnormal p) | -Inf | -7.0711e159 (matches the closed form −sqrt(1/(2p))) |
| `qbeta(-1e5, 1e-10, 100, lower.tail = FALSE, log.p = TRUE)` | NaN | 1 (the true answer rounds to 1) |
| `dcauchy(1e300, log = TRUE)`, `pcauchy(-1e300, scale = 1e-300, log.p = TRUE)` | -Inf | -1382.69… |
| `dweibull(1e-300, 3, log = TRUE)` | -Inf | -1380.45… |
| `dweibull(1e100, 5, log = TRUE)` | NaN (∞ − ∞) | -Inf |
| `pnbinom(30, 1e7, 0.7, log.p = TRUE)` | -Inf | -3566376.67… |
| `qcauchy(-1000, 0, 1e-300, log.p = TRUE)` | -Inf | -6.27e133 |
| `qcauchy(1e-320, 0, 1e-300)` | inaccurate (πp is subnormal) | correct value, computed as scale/p/π |
| `qlogis(1e-320, lower.tail = FALSE)` | Inf | 736.83 |
| `plogis(-745)` and other subnormal answers | 0 | 5e-324 |
| `pwilcox(q, 500, 500)` | uses several GB and runs out of memory | computed (memory grows with mn/2) |
| `dwilcox(3, Inf, 5)`, `dsignrank(3, Inf)` | allocation error or crash | NaN |
| `qsignrank(p, 1100)`, `qhyper(0.5, 1e15, 1e15, 1e15)` | does not finish | computed (`qhyper` takes about ten seconds at this size) |
| `qtukey(1e-10, 20, 10)` | NaN | finite answer |
| `qhyper(1 - 1e-15, 1e4, 1e5, 5000)` | 5000 | 617 (by definition) |
| `fisher.test` on a 3 × 5 table with n = 179 | FEXACT error 7 with the default workspace | 0.2023726720757 (0.65 s) |
| `wilcox.test(exact = TRUE)` with very large n (e.g. 3000) | `psignrank` gives NaN | computed |
| `psigamma(x, deriv)` for x < 0 and deriv ≥ 6 | NaN (not implemented in R) | computed (`psigamma(-1.5, 10)` = -156.229596593233) |
| `trigamma(1e-300)`, `psigamma(1e-100, 3)` and other results that overflow | NaN | ±Inf |
| `besselI(1000, 1000)` | Inf | 2.7234536469108428e229 |
| `besselK(1000, 1000)`, `lfactorial(1e-300)`, `besselI(1e-300, 1)` | 0 | 1.2981802514667e-233, -5.77e-301, 5e-301 |
| `besselJ(1e6, 0)` | 0 | 3.3104301373987376e-4 |
| `besselY(1e6, -2.75)` | -4.1e-4 | -2.8030753997749413e-5 |
| `ansari.test(conf.int = TRUE)` with ties and `exact` unset (or `TRUE`) | error "object 'cint' not found" (with both samples below 50 values R takes the exact branch, which skips the interval with ties) | the normal-approximation interval and estimate, the same as with `exact: false` |

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

### Distributions

| Case | R | rStats.js |
|---|---|---|
| `qbeta` answer underflows (e.g. `qbeta(0.5, 1e-10, 2.5)`) | 2^-1024 (5.56e-309) | 0 |
| `qf` answer overflows (e.g. `qf(-1e-300, 1, 1, log.p = TRUE)`) | a finite value near 2^1023 | Inf |
| `qbinom` with non-integer size (e.g. 2.5) | searches with NaN from `pbinom` and returns meaningless values (including -0) | NaN (as `dbinom` and `pbinom`) |
| Uniform with overflowing max − min (min = -1e308, max = 1e308) | Inf / 0 / NaN | computed with both ends halved (`dunif` 5e-309, `punif(-1)` 0.5, `qunif(0.5)` 0) |
| `dnbinom` with size = Inf | finite log probabilities such as -1.2e308 for prob < 1; NaN for log P[X = 0] with prob = 1 | -Inf and 0 |
| `qnbinom` with size = Inf and prob < 1 | Inf or NaN depending on p | always Inf (the mass is at X = ∞; p = 0 and 1 as in R) |
| `qnbinom` answer above 2^53 | an answer whose distribution function misses the target (log p −31.85 for a target of −32) | an answer that meets the target |
| `qsignrank`, `qwilcox` with tiny p (below about 1e-15), small upper-tail p, or deep log p | converts to a linear lower-tail p and compares with absolute slack 10ε, so returns 0 and similar (`qsignrank(1e-100, 1000)` is 0) | the answer by definition (69727) |
| `qsignrank`, `qwilcox`, `qhyper` with `log.p = TRUE` and p = -Inf | NaN | same as p = 0 (lower end of the support) |
| signrank with n = Inf, wilcox with m = Inf | crashes | NaN |
| Non-central `qbeta` with an infinite parameter (e.g. shape2 = Inf) | 0, 0.5 or 1 from a search on NaN | NaN |
| `qt` with ncp = ±Inf | a mix of NaN and ±Inf depending on p | NaN except at the end points |
| `qchisq(p, 0, ncp = 0)` (all mass at 0) | NaN or Inf | 0 |
| `df(0, df1, Inf, ncp, log = TRUE)` | not the log of the linear value (−1.386 with ncp = 0, where the linear value is 1) | log of the linear value |
| `qf` with df2 = Inf when the answer rounds to 0 | meaningless values such as 2e-130; Inf for log p = -1e-300 | value checked with the distribution function |

For very flat `qnbinom` cases (size = 1e-10, p = 1 − 1e-10 and similar) the rounding width of p
contains dozens of integers, so the answer can differ from R by dozens; both answers are checked
to have a distribution function within 16ε of p.

R's `dgeom` and `dnbinom` treat x as non-integer when |x − round(x)| > 1e-9 max(1, |x|).
rStats.js's `dpois` and `dbinom` use a threshold of 1e-7, which may differ from R near integers
(not verified).

- **Distributions outside base R** take extraDistr's names and parameters; `darcsine`, `parcsine`,
  `qarcsine` and `rarcsine` (not in extraDistr) are beta(1/2, 1/2) moved to (a, b). An infinite
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
  It also holds for the factors of formulas (`modelMatrix`, `lm`, `aov`; `levels` fixes the order)
  and for the between-subject factors of `aovEz`. The within-subject factors of `aovEz` keep afex's
  order of first appearance in the data.
- **Formulas** are strings and support variable names, `.`, `+`, `-`, `*`, `/`, `:`, `%in%`, `^`,
  parentheses, `0` and `1`, and one `Error()` term in `aov`. Function calls (`log(x)`, `I(x^2)`,
  `poly(x, 2)`, `offset()`), backquoted names and transformed responses are not supported: compute
  the column first. Contrasts are `contr.treatment` (default), `contr.sum` and `contr.helmert`. A
  formula that cannot be parsed throws "invalid formula: ..." instead of R's parse error.
- **`dunnTest`** ranks the values as numbers. dunn.test 1.4.2 given a character group vector ranks them as text
  (so 10.06 before 8.88); with a factor it ranks them as numbers, which is what `dunnTest` reproduces.
- **`aovEz` messages that R completes with a printout of the data** (ids removed for missing
  values, empty within-subject cells, empty between-subject cells) stop where the printout starts.

- **`coxph`** takes the covariates as a matrix (no formula), and non-integer case weights throw "non-integer
  weights (robust variance) are not supported yet": R switches to the robust (sandwich) variance for them.
  R's own results for a coefficient running off to infinity over many iterations depend on the platform (x86_64
  and arm64 R differ by 1e-7 after 20 iterations), so such fits agree with R only to that size.
- **`omega`** with one factor reports the group column of the Schmid-Leiman matrix and the group omegas as exactly 0;
  R reports the square roots of rounding residues (about 1e-8). With four or more group factors R's own results move
  by up to 4e-11 when the data change in the last bit, so `omega` agrees with R to about that size there (1e-12 with
  up to three).

### Linear models

- **`lm` with every weight 0** throws "all weights are zero"; R returns NA coefficients.

### Generalized linear models

- **No formulas:** `glm` takes the predictors as a matrix (or a vector), with a column of ones added
  unless `intercept` is false, and the response as a vector or, for the binomial families, rows of
  (successes, failures). Each column is one term: `glmAnova` adds the columns one by one (rows
  `"x1"`, `"x2"`, ...), so a factor coded as several columns is several rows of the table. Coefficient
  indices (`parm` of `glmConfint`) are 0-based, intercept first.
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

### Linear algebra

- **Matrices** are passed as arrays of rows; a 0-row matrix is treated as 0 × 0.
- **Eigenvectors and singular vectors** may have the opposite sign from R; both are correct.
  Complex eigenvectors are scaled so that the component with the largest modulus is real and
  positive (R's `dgeev` only makes that component real). Vectors for repeated eigenvalues or
  singular values, and singular vectors beyond min(rows, columns), are not unique and generally
  differ from R.
- **Algorithms:** `svd` uses Golub–Reinsch and `eigen` uses the EISPACK algorithms `tred2`,
  `tql2`, `orthes` and `hqr2` (R uses LAPACK's `dgesdd`, `dsyevr` and `dgeev`). Values agree to
  rounding. The general `eigen` does not balance the matrix first (`dgebal`), so badly scaled
  matrices may lose more accuracy than in R.
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
- **`qr(x, { lapack: true })`:** `qraux` (tau) has length equal to the number of columns
  (padded with 0); rank is always min(rows, columns); `qrFitted` and `qrResid` throw. Matrices
  containing NaN or Inf are not rejected (R also returns meaningless values; the values need not
  match R's).
- **`kappa`:** the default (`exact: false`) applies LINPACK's `dtrco` estimate to R from a QR
  decomposition (after transposing wide matrices). With `norm: "I"` it uses the same triangle of
  the transposed matrix, as R does. `triangular` has an effect only with `method: "direct"`, and
  then also uses `dtrco`. Exact `kappa` of a singular matrix is Inf.
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

## Not supported

- Recycling of distribution parameters (`rnorm(3, mean = c(0, 10, 100))`).
- RNG kinds other than R's default.
- Formula interfaces, Fisher's `hybrid` and `workspace`, and Wilcoxon's `digits.rank`.
  Kendall's concordance count is O(n²).
- `aov` beyond one way: multi-way designs and the formula interface (`aov` takes one sample with
  group labels, or a list of samples).
- `kappa`'s `inv_z`, complex matrices, and `EISPACK = TRUE` / `LINPACK = TRUE`.
- Formulas for `lm` and `glm` (the predictors are a matrix; see [ROADMAP.md](../ROADMAP.md)).
- numDeriv's complex-step method (`method = "complex"`), which needs a function of a complex
  argument, and the `side` argument of `grad` and `jacobian`.
- deSolve's adaptive solvers (`lsoda`, `ode45`, ...); `ode` has the fixed-step `euler`, `rk2`
  and `rk4`.
- `coxph`: counting-process data (`Surv(start, stop, event)`), `ties = "exact"`, offsets, clusters and the robust
  variance, `tt()` terms and residuals; concordance.
- `omega`: factoring methods other than minres, rotations other than oblimin, `n.iter` (bootstrap intervals) and
  `poly = TRUE`.
