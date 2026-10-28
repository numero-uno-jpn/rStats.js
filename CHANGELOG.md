# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

While the version is 0.x, a minor release (0.y.0) may contain breaking changes;
they are listed under **Breaking** for each release. From 1.0.0 the project follows
[Semantic Versioning](https://semver.org/).

## Unreleased

### Fixed

- `qcauchy` returned ±Infinity for p between about 1.8e-309 and 5.6e-309 although the quantile is finite
  (`qcauchy(2.2e-309, { lowerTail: false })` is now 1.4468631190172319e308): scale / p overflowed before the division
  by π.

## 0.15.2 - 2026-10-28

### Fixed

- Calls that did not return: `ptukey` and `qtukey` for small or huge q (`ptukey(1e-20, 200, 5)`); `qpois` for λ
  around 1e20; `qnbinom`, `qgamma`, `qchisq`, `qinvgamma`, `qbeta`, `qf` and `pf` at huge or tiny parameters;
  `pchisq` with a noncentrality parameter and a large df (`pchisq(1.1e10, 1e10, { ncp: 1e9 })`); the noncentral
  quantiles at extreme parameters. All now return in milliseconds.
- TypeErrors: `dweibull` and `pweibull` when x / scale underflows or overflows (`dweibull(1e-300, 2, { scale: 1e100 })`);
  the noncentral `qbeta` upper tail for a tiny p, also at an ordinary ncp
  (`qbeta(1.2e-270, 0.0316, 0.279, { ncp: 0.646, lowerTail: false })`); `qnbinom`, `qbeta`, `dbeta`, `dgamma`, `pf`
  and `qf` at extreme parameters.
- NaN, or values outside [0, 1], for valid arguments: `dchisq` with a noncentrality parameter and a large df;
  `pnorm` and `dnorm` when (x - mean) / sd overflows; `qlnorm`'s upper tail (`-Infinity` for `+Infinity`); the
  triangular distribution for very wide or very narrow intervals; `ppareto`'s upper tail (0 for a subnormal b / x);
  `pkumar` and `qkumar` for large b; `pinvgamma` (a positive log, `pinvgamma(3.65e-16, 35.87, { beta: 269.9, logP: true })`)
  and `dinvgamma` when beta / x underflows; `pgamma`, `pchisq`, `ppois` and `pbeta` at huge parameters.
- `qunif`'s upper tail lost digits near `max` (`qunif(3.7e-216, { min: -1, max: 0, lowerTail: false })` was 0).

- Accuracy:
  - The noncentral t, χ², F and beta distribution functions could give a larger tail an ulp or two above 1, and
    step backwards; the larger tail is now 1 minus the smaller.
  - `pbeta` lost accuracy for a large non-integer shape just below a power of 2 (relative error 1.3e-4 in the log at
    a = 2^52 - 0.5), and at tiny shapes (above 1). `pbinom`, `pnbinom` and `pf` gain from the same fixes
    (`pbinom` was 2e-15 off near the upper end).
  - Subnormal arguments and results: `pgamma` and `qgamma` (0 for `pgamma(2e-323, 0.0548, { rate: 0.045 })`),
    `qinvgamma`, `pf` and `qf`, `dlnorm` (relative error 2.8e-7), the arcsine distribution.
  - `pt` and `qt` at huge or tiny df (`qt(9.2e-16, 9e243)` was 0); `dt` and `pt` with a noncentrality parameter at
    large df (NaN from about df = 1e14); `pinvgamma` for alpha above 1e15; `pnbinom` at tiny size; `pgeom` for x
    around 1e300.
- `qbeta`'s upper tail for a tiny first shape (`qbeta(2.2e-265, 5.7e-37, 5643, { lowerTail: false })` is 0.088;
  R gives 1 with a warning), and `df` at subnormal x (R gives NaN), now differ from R; see docs/differences-from-r.md.

## 0.15.1 - 2026-10-27

### Fixed

- `pchisq` and `qchisq` with a noncentrality parameter when x λ > 4e18: the distribution function came from an
  expansion valid only far in the right tail, and gave values outside [0, 1] near the centre
  (`pchisq(3e9, 1, { ncp: 3e9 })` was -21849.97, now 0.5) and a relative error up to 3e-3 in the log of the right
  tail. It now integrates the density, to full double precision in both tails and in log scale. `qchisq` with a huge
  λ no longer takes seconds.
- `dchisq` with a noncentrality parameter when x λ > 4e18 lost digits to the difference of two rounded square roots
  (relative error 1e-8 for λ = 1e15); it is now accurate to rounding.
- `dsignrank`, `psignrank` and `qsignrank` depended on earlier calls with the same n: once the centre of the
  distribution had been evaluated, small values underflowed (`dsignrank(0, 2000, { log: true })` became `-Infinity`)
  or lost digits. Results no longer depend on the order of calls.

## 0.15.0 - 2026-10-27

### Breaking

- `lmer`, `lmerSummary`, `lmerContest` and `lmerAnova` check their options: an option of R that is not supported
  (`weights`, `offset`, `subset`, `naAction`, `control`, `start`, ...) and an unknown key are errors (they were
  ignored: `lmer(..., { weights })` fitted without weights, `{ reml: false }` fitted by REML). The logical options
  (`REML`, `joint`, `confint`, `refit`) accept booleans and numbers (0 is false); a string such as `"no"` is the
  error `argument is not interpretable as logical`.
- `lmer` throws for a response fitted exactly by the fixed effects (a constant response, or as many fixed effects
  as observations) and for a random-effects term without columns (`(0 | g)`), which it fitted before.

### Fixed

- `lmer` could stop at a local minimum of the criterion (crossed groups without a fixed intercept, where one term
  takes the place of the intercept), with a higher criterion than the model without that term. The fit now compares
  its result with the boundary points where one term is removed and continues from a lower one. lmerTest's tests and
  the model comparisons follow.
- The names of `lmer`'s fixed effects follow the formula without the random-effects terms, as lme4's do:
  `y ~ (z | g) + x * z` has `x:z` (it was `z:x`), and the rows of `lmerAnova`'s tables follow.
- `lmer` failed ("did not converge") for a response with a large mean (1e6 and more): the fit now works with the
  response minus its least-squares fit on the fixed effects, which gives the same model without the cancellation.
- `lmer(..., { REML: 0 })` reports `REML: false` (it was `0`).
- `glm`: the warning `NaNs produced` when a step makes a mean negative under a family whose deviance takes the
  logarithm of y/μ (Poisson, quasi-Poisson and Gamma with the inverse link, for example), before `step size truncated
  due to divergence`, as in R; the deviance of `quasi` with variance `"mu^2"` for a negative response follows R's.

## 0.14.0 - 2026-10-27

### Added

- **Tests for linear mixed models** (area `@numero-uno-jpn/rstats/mixed`), as lmerTest 3.2.1 and lme4 give them:
  - `lmerSummary(fit)`: the coefficient table with Satterthwaite's degrees of freedom, t values and p-values
    (`summary()` of a `lmerTest::lmer` fit).
  - `lmerContest(fit, L, { joint, rhs, confint, level })`: t-tests of contrasts with confidence intervals, and joint
    F-tests (`lmerTest::contest`).
  - `lmerAnova(fit, { type })`: the Type III (default), II and I ANOVA tables with Satterthwaite's F-tests
    (`anova()` of a lmerTest fit), with lmerTest's hypothesis matrices (and their rounding) and its "Missing cells"
    message.
  - `lmerAnova([fit1, fit2, ...], { refit, names })`: likelihood-ratio comparison of fits (lme4's `anova()`), REML
    fits refitted by maximum likelihood.
  The degrees of freedom use exact (analytic) derivatives at the exact optimum and agree with references computed
  in 128-bit arithmetic to about 1e-13; lmerTest differentiates numerically at lme4's approximate optimum, so its
  values differ in about the 4th to 8th significant digit (see docs/differences-from-r.md). A summary takes about
  0.05 s for a fit with 5000 groups. Kenward-Roger, `ranova`, `ls_means` and `step` are not included.
- `lmer` accepts `contr.poly` among the `contrasts` of the fixed effects.

## 0.13.0 - 2026-10-27

### Breaking

Results change where they now follow R (details under Fixed):

- Numeric group labels with the same 15-digit text form one group (`table`, `tapply`, `split`, `aggregate`, the
  tests' (x, g) forms and others), and numeric level names are written as R writes them ("1e+15").
- `beta` and `lbeta` return NaN for a negative argument.
- `kappa` without `exact` no longer throws for the norms "F", "M" and "2" through the triangular factor (it uses
  the 1-norm, as R does), a lower-case "i" there gives the 1-norm estimate, and `qr(x, { lapack: true }).qraux` has
  min(n, p) elements.
- Several functions throw R's errors for arguments they used to accept (`optimize`/`uniroot` with infinite ends,
  `tabulate` with a negative `nbins`, `pretty` with a negative `n`, `approx` with `f` outside [0, 1], `cut` of data
  without a finite range).

### Added

- `prcomp` options `rank` and `tol` (R's `rank.` and `tol`): `rotation` and `x` keep only the first components;
  `sdev` keeps all of them, as in R.
- `factanal` option `scores` (`"regression"` or `"Bartlett"`) and the `scores` of the result.

### Fixed

Differences from R found by an external check of 0.11.1 against R (4057 cases) and confirmed with R 4.5.2:

- `optimize` never returned when an end of the interval was infinite; it and `uniroot` now fail with R's
  `invalid 'xmin' value` / `invalid 'xmax' value`.
- `eigen` of a nonsymmetric matrix now balances it first, as LAPACK's dgeev does: badly scaled matrices lost most of
  their accuracy (eigenvalues of [[1, 1e8, 0], [1e-8, 1, 1e6], [0, 1e-6, 2]] were 2.635, 1.714, -0.348 instead of
  2.802, 1.445, -0.247).
- `sum`, `prod`, `cumsum`, `cumprod`, `mean` (also trimmed), `median` and `weightedMean` gave NaN when a running
  sum or product passed the double range; they now give R's values (R accumulates in long double), for example
  `mean([1e308, 1e308, 1e308])` = 1e308 and `prod([1e-308, 1e-10, 1e10])` = 1e-308.
- Numbers as group labels (`table`, `tapply`, `split`, `aggregate`, the (x, g) forms of the k-sample tests and
  multiple comparisons, survival strata, `aovEz`, `mauchlyTest` and others) are grouped by their 15-digit text, as
  R's `factor()` does: 0.1 + 0.2 and 0.3 are one group, and so are 1e15 and 1e15 + 1. A level's value is the
  smallest of its values; numeric level names are written as R writes them ("1e+15"). **Results for such labels
  change.**
- Gamma and chi-squared distributions with an infinite shape (`qgamma(p, Inf)` gave 1, `pgamma(Inf, Inf)` NaN).
  Where R itself gives NaN (0 < q/scale < 1) the library gives the limit; see docs/differences-from-r.md.
- `tTest` with `varEqual: true` accepts a sample of size 1, as R does.
- `glm` accepts every named link in every family, as R does (`poisson` with `"inverse"`, `binomial` with
  `"identity"`, ...), with R's errors for links that fail (`Value 1.1 out of range (0, 1)`) or are unknown.
- `cut` drops NaN among the breaks and gives R's errors for data without a finite range.
- `cor` and `cov` of fewer than 2 observations are NaN, the diagonal included.
- `dbinom` with `size` Inf is 0 (1 at x = 0 for prob 0), as in R 4.5.
- `beta` and `lbeta` with a negative argument are NaN, as in R (they gave the analytic continuation).
- `qr` with `lapack: true` returns `qraux` with min(n, p) elements.
- `kappa` estimates: through the triangular factor, every norm other than "I" gives the 1-norm estimate (R warns),
  instead of an error for "F", "M" and "2"; with `method: "direct"` other norms are R's error.
- `dbeta` with a shape of 1 is exact (`dbeta(x, 1, 1, { log: true })` is 0).
- `findInterval` with fewer than 2 break points, `tabulate` with a fractional or invalid `nbins`, `pretty` with a
  negative or fractional `n` or invalid `minN`, `mad` with `low`/`high` and missing values, and `approx` with `f`
  outside [0, 1]: R's values and errors.

## 0.12.0 - 2026-10-27

### Added

- **Linear mixed models:** `lmer`, lme4's `lmer()`, in a new area `@numero-uno-jpn/rstats/mixed` (`dist/mixed.js` on a
  CDN). It is not in the main entry point or the single-file bundle `dist/rstats.js` while it is new. REML (default)
  and maximum likelihood; random-effects terms `(x | g)` and `(x || g)`, crossed factors, `a:b` and nested `a/b`
  grouping, the fixed-effects part coded as in `lm` (`contrasts`, `levels`). The result has the quantities of
  `fixef`, `coef(summary())` (estimates, standard errors, t values; p-values come later), `vcov`, `sigma`,
  `VarCorr`, `ranef`, `fitted`, `residuals`, `logLik`, `AIC`, `BIC`, `deviance`, `REMLcrit` and `isSingular`, with
  lme4's checks, messages and warnings. Implemented from Bates, Mächler, Bolker and Walker (2015) with a sparse
  Cholesky factorisation and the analytic gradient of the profiled criterion; the estimates are the exact optimum
  (references at the optimum in 128-bit arithmetic, matched within 1e-9 and the log-likelihood within 1e-12), which
  lme4's optimiser approaches to its own tolerances, so lme4's variance components differ in about the 5th to 9th
  significant digit. A fit with 5000 subjects and correlated random slopes takes under a second (lme4: 0.35 s);
  see docs/performance.md and docs/differences-from-r.md.

### Fixed

Six differences from R in the formula functions, found by an external check of 471 formula cases against R and
confirmed with R 4.5.2:

- `modelMatrix` made all-zero columns for a value of a string column that occurs only in rows dropped for a missing
  value (`y ~ A` with `A = "c"` only where `y` is missing gave a column `Ac`; `y ~ A * B` gave 9 columns instead of
  4). A string column is now a factor of the rows kept, as R's; a column with `levels` given still keeps its unused
  levels in `modelMatrix`, as an R factor does. **The model matrices of such data change.**
- `lm`, `aov` (and `lmer`) threw "contrasts can be applied only to factors with 2 or more levels" for a boolean
  column with one value in the rows used. Booleans are now always coded with the levels FALSE and TRUE in model
  matrices, as R codes logicals: the column is aliased (coefficient `NaN`, R's `NA`). Grouping by a boolean (the
  formula forms of the tests) still uses the values present.
- `1 * B`, `1/B`, `0 * B` and other `*`, `/` and `%in%` whose left operand expands to no terms gave the terms of the
  right operand; R gives none (`B * 1` still gives `B`).
- `^` with a non-integer power was an error; R truncates it (`(A + B)^2.5` is `(A + B)^2`).
- `contrasts` naming a variable that is not in the formula is now warned about (`variable 'B' is absent, its
  contrast will be ignored`), in `modelMatrix`, `lm`, `aov` (where a variable only inside `Error()` is absent) and
  `lmer`; a numeric variable is an error (`contrasts apply only to factors`). Both were ignored silently.
- `aggregate("y ~ A:B", ...)`, `"y ~ A*B"`, `"y ~ ."` and `"y ~ 1"` were errors; as in R, the grouping variables are
  all the variables of the right-hand side, whatever its operators (`y ~ 1`: one row).

### Changed

- docs/differences-from-r.md: the "Not supported" list no longer lists the formula interfaces of the tests, `lm`
  and `aov`, which are supported since 0.10.0 and 0.11.0.

## 0.11.1 - 2026-10-26

Documentation only; the code is the same as in 0.11.0.

### Added

- The [API reference](https://numero-uno-jpn.github.io/rStats.js/api/) is published on GitHub Pages, built from
  each release: a front page, the functions grouped by subject, every result field documented, and an example for
  every function (the examples are run by the tests, which found and fixed wrong values in eight of the older ones).
- [docs/r-functions.md](docs/r-functions.md) (and [docs/ja/r-functions.md](docs/ja/r-functions.md)): the R function
  that each rStats.js function corresponds to, with a one-line description, generated from the doc comments.
- The performance page is remeasured on 0.11.0, with R's times alongside.

## 0.11.0 - 2026-10-26

### Added

- Data handling, for "missing values → groups → test" without hand work:
  - formula forms of the tests: `tTest("y ~ g", data)` (also `"y ~ 1"` and `"Pair(a, b) ~ 1"`), `wilcoxTest`,
    `varTest`, `ansariTest`, `moodTest`, `ksTest`, `kruskalTest`, `flignerTest`, `bartlettTest`, `onewayTest`
    (several factors as their interaction), `friedmanTest` and `quadeTest` (`"y ~ w | b"`), `corTest("~ x + y",
    data)`, with R's handling of missing values, levels and messages;
  - `completeCases` (`complete.cases`) and `naOmit` (`na.omit`);
  - `tapply`, `split` (a `Map` in R's order) and `aggregate` (formula and data-frame forms);
  - `merge` (R's row order, including its order of duplicated keys), `subset`, and `rbind` / `cbind` of data
    frames (the matrix forms are unchanged);
  - `fromRows` and `toRows`: data frames from arrays of row objects (JSON, parsed CSV) and back;
  - `pivotLonger` and `pivotWider` (tidyr's `pivot_longer` and `pivot_wider`): wide and long formats, with
    `.value`, `namesSep`, `namesPattern`, `valuesFill` and `valuesFn`.
- [docs/guide-for-js-developers.md](docs/guide-for-js-developers.md) (and its Japanese translation): R's way of
  writing an analysis explained for JavaScript developers, with a worked example that the tests run.

### Changed

- The tests with a formula form import the formula and model-frame code: `tTest` alone is 24.9 KB gzipped (was
  21.4 KB), `wilcoxTest` 12.1 KB (was 8.6 KB). Everything together is 185.8 KB.

## 0.10.0 - 2026-10-26

### Added

- Model formulas: `lm(formula, data)` and `aov(formula, data)` take an R formula string and a data frame (an
  object of columns; strings and booleans are factors), besides the existing matrix and group forms. Formulas
  support `+`, `-`, `*`, `/`, `:`, `%in%`, `^`, `.`, `0`/`1` and parentheses, with R's term order, labels and
  coding (contrasts or indicators by R's rule, the first factor coded by indicators without an intercept), the
  contrasts `contr.treatment`, `contr.sum` and `contr.helmert`, a `levels` option and weights. `modelMatrix`
  returns R's `model.matrix` with the attributes of `terms()`.
- `anova` (`anova.lm`): the sequential table of a fit and the comparison of several fits; `aovSummary`
  (`summary(aov(...))`).
- `aov` with an `Error()` term: the error strata and their tables, as R's multistratum `aov`.
- `Anova` (`car::Anova` for linear models): type II and type III tests.
- `aovEz` (`afex::aov_ez`): repeated-measures, between-subjects and mixed designs from long data, with car's
  univariate tests, the Greenhouse-Geisser and Huynh-Feldt corrections, Mauchly's tests, generalized and partial
  eta squared (`es`, `observed`), types II and III, and afex's aggregation and checks.
- `mauchlyTest` (`mauchly.test`) for the responses of several measurements per subject, with `group`, `M`, `X`
  and `idata`.
- The fits are computed in double-double where R's QR decomposition loses digits (a mean of 1e6: R's
  coefficients are off by up to 1.5e-11); every table agrees with R to 1e-12 or with exact rational values.
- Effect sizes (effectsize): `cohensD` and `hedgesG` (one sample, two samples pooled or not, paired), and
  `etaSquared` (partial, non-partial, generalized), `omegaSquared` and `epsilonSquared` of `anova` and `Anova`
  tables, with confidence intervals. The limits are the exact solutions; effectsize's optimiser leaves them about
  1e-9 (up to 3e-3) off.
- Power calculations: `powerTTest`, `powerPropTest`, `powerAnovaTest` (R's `power.*.test`) and pwr's `pwrTTest`,
  `pwrT2nTest`, `pwr2pTest`, `pwr2p2nTest`, `pwrPTest`, `pwrNormTest`, `pwrRTest`, `pwrChisqTest`, `pwrAnovaTest`,
  `pwrF2Test` with `esH`, `esW1`, `esW2` and `cohenES`. Give the quantity to solve for as `null`; it is found with R's
  own `uniroot` calls, with accurate noncentral distributions (R's noncentral t and F are not: computed powers
  differ from R's by up to 3e-8).

- More tests: `leveneTest` (car), `propTrendTest` (`prop.trend.test`), `jonckheereTest` (DescTools' and clinfun's
  variants), `cochranQTest` (DescTools), and nortest's `adTest`, `lillieTest`, `cvmTest`, `sfTest`, `pearsonTest`.
- Effect sizes of repeated-measures designs: `etaSquared`, `omegaSquared`, `epsilonSquared` of `aov` fits with
  `Error()` and of `aovEz` results, with exact intervals.
- Multiple comparisons: PMCMRplus's `dscfAllPairsTest` (Steel-Dwass), `kwAllPairsDunnTest`, `kwManyOneDunnTest`, `manyOneUTest` (Steel's many-one rank test),
  `dunnettTest`, `gamesHowellTest`, `tukeyTest` and `steelTest` (its errors); dunn.test's `dunnTest`; multcomp's
  Dunnett comparisons (`glhtDunnett`). Dunnett-type probabilities are computed exactly by a one-dimensional integral
  (R's mvtnorm integration is randomised and about 1e-3 accurate); studentized-range p-values are R's to full
  precision (R's `ptukey` has about 8 digits).
- Survival analysis: `survdiff` (log-rank, G-rho family) and `survfit` (Kaplan-Meier with its intervals and median).
- `coxph` (Cox regression, survival's `coxph` for right-censored data with a covariate matrix): Efron and Breslow
  ties, case weights, strata, starting values, R's Newton-Raphson iterations and warnings, and the summary's
  coefficient table, intervals and the likelihood-ratio, score and Wald tests.
- Agreement and reliability: `kappa2`, `kappamFleiss`, `icc` (irr), `cronbachAlpha`, `partialR` (psych).
- `schur` (real Schur decomposition, `Matrix::Schur`) and `expm` (the matrix exponential, expm's `Higham08.b`,
  `Higham08`, `Pade`, `Taylor`, `PadeO` and `TaylorO` with `order`).
- `factanal` (maximum-likelihood factor analysis with varimax and promax rotations), on `optim`'s L-BFGS-B.
- `omega` (McDonald's ω, psych's `omega`): minres factor analysis, varimax and oblimin rotations, the
  Schmid-Leiman transformation, ω_h, ω_t, ω_lim, α, G6, ECV and the group omegas.
- `polychor` and `polyserial` (polycor's two-step estimates) and `pbvnorm` (bivariate normal rectangle
  probabilities, Genz's method). With `{ ML, stdErr }`, the maximum-likelihood estimates (correlation and
  thresholds) and the standard errors with polycor's chi-squared statistics, at the exact maximum of the likelihood
  (R's optimisers stop up to 1e-3 short of it, and fail on some strongly associated tables).
- `optim` with Nelder-Mead, BFGS, CG, L-BFGS-B (a port of the Netlib code), SANN and Brent, following R's iterations
  (the same evaluation counts), and `optimHess`.

### Fixed

- `pchisq` and `pf` with a huge noncentrality (above about 1e12) far from the quantile returned wrong values or NaN;
  a Chernoff bound now returns 0 and 1 there.


## 0.9.0 - 2026-10-25

### Added

- `glm` (R's `glm` with a matrix interface): generalized linear models fitted by iteratively
  reweighted least squares, with every family of R's `stats` (`gaussian`, `binomial`,
  `quasibinomial`, `poisson`, `quasipoisson`, `Gamma`, `inverse.gaussian`, `quasi` with its five
  variance functions) and every link each accepts, power links (`{ power: lambda }`), prior weights,
  an offset, starting values, `epsilon`, `maxit` and a model without intercept. A binomial response
  can be rows of (successes, failures). The result has the coefficients (NaN for aliased columns),
  fitted values, deviance, null deviance, AIC, degrees of freedom, iterations, `converged`,
  `boundary`, and R's warnings as strings in `warnings`.
- `glmSummary` (`summary.glm`): dispersion, coefficient table with z or t tests, unscaled and scaled
  covariance; `glmResiduals` (deviance, Pearson, working, response); `glmHatvalues`,
  `glmRstandard`, `glmCooksDistance`; `glmPredict` on the link or response scale with standard
  errors, for the data or new rows (with their offset).
- `glmConfint`: profile likelihood confidence intervals (likelihood ratio or Rao score), with the
  exact limits where R's `confint` interpolates a spline (R is up to 4.5e-4 standard errors from
  them); see [docs/differences-from-r.md](docs/differences-from-r.md#generalized-linear-models).
- `glmAnova` (`anova.glm`): the sequential analysis of deviance of one fit (each column of `x` a
  term) and the comparison of several fits, with the `"Chisq"`/`"LRT"`, `"Rao"`, `"F"` and `"Cp"`
  tests and R 4.4's default test.
- Together they add 7.8 KB gzipped to everything (122.2 → 130.0 KB); `glm` with `glmSummary` alone
  is 27.2 KB, with all its methods 39.2 KB.

## 0.8.0 - 2026-10-25

### Added

- `RNGkind({ kind, sampleKind })` (R's `RNGkind()`): the `"L'Ecuyer-CMRG"` generator (L'Ecuyer's
  MRG32k3a) besides R's default Mersenne-Twister, and `sampleKind: "Rounding"`, the `sample` of R
  before 3.6.0 (affects `sample`, `sampleInt` and `rwilcox`), with R's streams after the same seed.
  As in R, changing the kind in the middle of a stream seeds the new generator from the next
  uniform, and the call returns the previous kinds. R's `set.seed(seed, kind, sample.kind)` is
  `RNGkind({ kind, sampleKind })` followed by `setSeed(seed)`.
- `nextRNGStream` and `nextRNGSubStream` (R's `parallel::nextRNGStream()` and
  `nextRNGSubStream()`): the L'Ecuyer-CMRG state advanced by 2^127 or 2^76 steps, for independent
  streams in parallel work.
- `getRandomSeed` and `setRandomSeed` handle every supported combination in R's `.Random.seed`
  format (kind code `10403`, `403` with Rounding, `10407` for L'Ecuyer-CMRG with 6 seeds).
- `brunnerMunzelTest` (`lawstat::brunner.munzel.test()`): the Brunner-Munzel test for the relative
  effect P(X < Y) + P(X = Y)/2 of two samples, with its interval. The interval is set with
  `confLevel` (lawstat's `alpha = 1 - confLevel`); small p-values are computed from the upper tail
  directly, where lawstat's 1 − P loses them. It adds 0.4 KB gzipped to everything (121.8 → 122.2
  KB with the speed-up below).

### Changed

- `sampleInt` accepts n up to 4.5e15, as R (before: less than 2^31), when sampling with
  replacement or with a size of at most n / 2 (`sampleInt(1e10, { size: 3 })`); weighted sampling and
  sampling more than half without replacement still need n < 2^31. Uniform integers above 2^47 are
  built from random bits without rounding.
- Bundle size: `setSeed` with `rnorm` is unchanged (1.7 KB gzipped); `sampleInt` grows from 1.9 to
  2.1 KB and `getRandomSeed` with `setRandomSeed` from 1.0 to 1.5 KB (they read L'Ecuyer-CMRG
  states). The new generator is only included with `RNGkind`, `setRandomSeed` or the stream
  functions. Everything together grows from 119.6 to 120.9 KB.

- Speed: the incomplete beta function with both parameters large (ab/(a + b) >= 25, x near the
  mean) uses Temme's uniform asymptotic expansion, in constant time (about 1 µs):
  `pbeta(0.5, 1e6, 1e6)` becomes about 245 times faster and `pbinom(n/2, n, 0.5)` with n = 1e6
  about 170 times. The continued fraction of the incomplete beta function runs without array
  allocations (bit-identical results, about twice as fast), and Loader's deviance, `dbeta` and the
  prefactors leave out double-double steps whose rounding an error bound shows to be negligible.
  On typical inputs (`npm run bench`, Apple M1): `pbeta` 1.6, `dbeta` 2.0, `pt` 1.7, `dbinom` 2.1,
  `pf` 1.7, `qbeta` 1.8 and `qgamma` 1.3 times faster (see [docs/performance.md](docs/performance.md)).
  Accuracy is unchanged: all tests pass with the same tolerances, and new mpmath fixtures cover
  the large-parameter region.
- Bundle size: the expansion and the allocation-free loop add about 3.6 KB gzipped to everything
  that uses the incomplete beta function (`qbeta` 18.5 → 22.1 KB, `pt` and `qt` 25.5 → 29.4 KB,
  `tTest` 16.7 → 20.3 KB, everything 115.4 → 119.6 KB).
- Speed: the incomplete beta function with one parameter large and the other small (a >= 15,
  b <= 40, x in the bulk) uses DiDonato and Morris's asymptotic expansion (TOMS 708, eq. 9, in the
  form of Boost.Math's `beta_small_b_large_a_series`) where it used the continued fraction, whose
  length stops growing with a but which took 30 to 170 double-double steps there. This covers `pt`
  and `pf` with large degrees of freedom, `pbeta(x, 1e6, 10)` and `pbinom` with x near 0 or n:
  `pt(1.5, 1e6)` becomes 12 times faster, `pbeta(1 - b/(a + b), 1e10, 0.5)` 31 times,
  `pf(3, 1, 1e5)` 14 times, `pbeta(1 - b/(a + b), 1e6, 10)` 1.4 times, and `pt` over t ~ N(0, 3²)
  takes about the same time for every df from 1e5 to 1e15 (5 to 9 times faster); `qt`, `qbeta`,
  `qf` and `qbinom` there become about 2 times faster (see [docs/performance.md](docs/performance.md)).
  Its cases are within 1.2e-15 of mpmath and Rmpfr references, as the continued fraction was; new
  mpmath fixtures cover a from 15 to 1e10 and b from 0.1 to 40.
- Bundle size: the expansion adds 0.8 to 1.1 KB gzipped (`pt` and `qt` 29.4 → 30.3 KB, `qbeta`
  22.1 → 23.2 KB, `tTest` 20.3 → 21.4 KB, everything 120.9 → 121.8 KB).

### Fixed

- Weighted sampling with replacement by Walker's alias method (more than 200 likely candidates)
  compares in the same way as R (t + u against q[t] + t), so that rounding cannot pick a different
  candidate in rare cases.
- The log of the larger tail of the incomplete beta function for x (or 1 − x) in the subnormal
  range: `pbeta(1e-308, 1, 1e8, lowerTail: false, logP: true)` was off by 4.7e-14, as R's value
  still is (now 1.8e-15).
- `pt` and `pf` with degrees of freedom above about 1e21 (the continued fraction in the frame of the
  large parameter, now replaced by the expansion for large a): `pt(0.001, 1e22, lowerTail: false)`
  was 1.19 and `pt(0.01, 1e25)` off by 2.6e-4; with degrees of freedom from about 1e153 on, `pt` and
  `pf` returned NaN (`pt(1, 1e160)`, `pf(2, 3, 1e160)`). `pt` now agrees with its normal limit to
  5e-16 for |t| up to 31.6 (beyond, where the tail is below 1e-218, the NaN remains for df from
  1e153 on).

## 0.7.0 - 2026-10-25

### Added

- `ansariTest`: `confInt` and `confLevel` (R's `conf.int = TRUE`), the confidence interval for the
  ratio of scales and its estimate, exact and by the normal approximation.
- `chisqTest` and `fisherTest`: `simulatePValue` and `B` (R's `simulate.p.value`, default 2000),
  with Monte Carlo p-values from the random stream of `setSeed`, the same as R's after `set.seed()`.
- `chisqTest(x, y, options)` with two factor vectors (arrays of labels; `null` for missing values):
  the test of independence in their table, with the levels in `rowLevels` and `colLevels`.
- `r2dtable` (random two-way tables with given margins, Patefield's algorithm), with R's random
  stream.
- `log1pmx`, `lgamma1p`, `log1mexp` and `log1pexp`, the log1p-type functions of R's C API
  (Rmath.h), checked against correctly rounded values.

### Changed

- With ties and `exact` unset, R's `ansari.test(conf.int = TRUE)` fails ("object 'cint' not
  found"); `ansariTest` returns the normal-approximation interval there (see
  [docs/differences-from-r.md](docs/differences-from-r.md)).
- Bundle size: `chisqTest` now includes the random number generator, `sample` and `r2dtable`;
  the `tests` entry grows from 59.4 KB to 65.2 KB gzipped, `fisherTest` alone from 13.8 KB to
  15.4 KB, and everything from 112.4 KB to 115.4 KB.

## 0.6.1 - 2026-10-24

The first release of the 0.6 series on npm. A `v0.6.0` tag was pushed to GitHub earlier the same
day but never published to npm and has been withdrawn; use 0.6.1.

### Added

- Everything jStat offers, with R's names and defaults, and a migration guide
  ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)) whose replacements are checked
  against jStat itself (`test/jstat-replacement.test.ts`):
  - descriptive statistics (`@numero-uno-jpn/rstats/descriptive`): `sum`, `prod`, `mean` (with `trim`),
    `weightedMean`, `variance` (R's `var`), `sd`, `median`, `range`, `cumsum`, `cumprod`, `cummax`,
    `cummin`, `diff`, `quantile` (all nine types), `IQR`, `fivenum`, `mad`, `rank`, `cov` and `cor`
    for vectors and matrices (Pearson, Kendall, Spearman, with `use`), `tabulate`, `table`, `unique`,
    `cut`, `findInterval`, `pretty`, `hist`, `ecdf`, `scale`, and `skewness`, `kurtosis` (e1071),
    `geometricMean`, `modes`, `meanAD`, `cv` (DescTools); sums in double-double;
  - matrix arithmetic: `matMul`, `add`, `subtract`, `multiply`, `divide`, `outer`, `t`, `diag`,
    `cbind`, `rbind`, `matrix`, `kronecker`, `seq`, and `lu` (`Matrix::lu`) and `prcomp`;
  - hypothesis tests: `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`,
    `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`,
    `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest`, `ksTest`, `pairwiseTTest`,
    `pairwiseWilcoxTest`, `pairwisePropTest`, `aov` (one way), `TukeyHSD` and `zTest` (BSDA);
  - linear models: `lm` with a matrix interface and the quantities of `summary.lm`, `confint`,
    `predict`;
  - numerical methods (`@numero-uno-jpn/rstats/numerics`): `integrate`, `optimize`, `uniroot` (with
    `extendInt`), `approx`, `spline`, `splinefun`, `splinefunH`, `barylag` (pracma),
    `hermiteInterp`, `ode` (fixed-step, deSolve), `grad`, `jacobian`, `hessian` (numDeriv);
  - distributions outside base R with extraDistr's names: `invgamma`, `kumar`, `pareto`, `triang`,
    `laplace`, and `arcsine` (d/p/q/r), and `distSummary` (mean, variance, sd, median, mode,
    skewness, kurtosis) for 23 distributions (all but signrank, wilcox and tukey);
  - special functions: `gammainc`, `erfinv`, `erfcinv`, `perm`.
- Subpath exports and per-area CDN files: `@numero-uno-jpn/rstats/distributions`, `/tests`, `/linalg`,
  `/descriptive`, `/numerics`, `/special` (`dist/<area>.js`, with shared code split out).
- `choose`, `lchoose`, `factorial` and `lfactorial`, for any real `n` (and `x`).
- `digamma`, `trigamma` and `psigamma` (derivatives up to 100, negative arguments by
  reflection; unlike R, also for x < 0 with deriv ≥ 6).
- `besselI`, `besselK` (with `exponScaled`, R's `expon.scaled`), `besselJ` and `besselY` for any
  real order, ported from Boost.Math.
- The option `rCompatible` of `choose`, `lchoose`, `trigamma` and `psigamma` (type
  `RCompatibleOptions`): by default they follow R at its edge cases (n near an integer in
  `choose`, infinite arguments); `rCompatible: false` returns the mathematical values there.
- `erf` and `erfc`, which R lacks (checked against mpmath). `erfc` is now accurate in the far tail:
  it forms exp(-x^2) from an exact x^2 and no longer flushes subnormal results to 0.
- `dmultinom`, as a product of binomial probabilities (accurate for large counts).
- The new functions are checked against R 4.5.2, and against mpmath (100 to 800 digits) where R
  is inaccurate or fails (docs/differences-from-r.md).

### Changed

- Code that followed the GPL sources of R (and of BSDA, for `zTest`) too closely was re-implemented independently, so that the
  package stays MIT licensed: `propTest`, the two-sided p-values of `poissonTest` and `binomTest`,
  the exact 2 × 2 parts of `mantelhaenTest` and `fisherTest`, the intervals of `wilcoxTest`,
  `zTest`, `approx`, `spline`, `splinefun`, `splinefunH`, `uniroot`, `seq`, `pretty`, `hist` and
  `quantile`.
- `uniroot`'s zero finder is now a port of netlib's `zeroin.f` (public domain).
- **Type change:** `fStatistic` and `fPValue` of `lm`'s result are optional; they are absent for a
  model with nothing beyond the intercept, as `summary.lm` has no `fstatistic` there.
- The error messages of `grad`, `jacobian`, `hessian` and `zTest` are worded differently.

### Fixed

- `lbeta` and `beta` with an argument of 2^52 or more: `lbeta(1e17, 31)` was off by 20 and
  `lbeta(1e100, 31)` returned 0.92 instead of -7063.

- Accuracy of the incomplete beta function behind `pbeta`, `pt`, `pf`, `pbinom` and `pnbinom`
  (checked against mpmath). The 15 `pnbinom` cases that were excluded as known accuracy
  problems now pass:
  - results near 1e-308 kept their exponent only to double precision (up to 1.2e-13 relative);
  - the continued fraction rounded a + b, losing the digits of a small b (up to 6e-11 relative,
    e.g. `pnbinom(1e8, 0.01, mu = 1e4)`).
- With parameters of 2^52 or more the continued fraction stopped advancing its coefficients, and
  a result could pass through a subnormal intermediate: `pnbinom` with q around 1e17 was off by
  up to 1e-3 relative, and returned NaN in some cases.
- `pgamma` and `ppois` with a shape (or lambda) above about 1e6, 5 to 40 standard deviations below
  the mean (lower tail of `pgamma`, upper tail of `ppois`): off by up to 2e-14 relative, now 2.7e-15.
  The series is summed in double-double there, which makes those calls about 9 times slower.
- `pchisq` and `pbeta` with `ncp` around 1000 in the far tails: off by up to 1.4e-13 relative, now
  below 5e-15 (the terms of the Poisson mixture are corrected to the exact shape a + j).
- Fixed since the withdrawn `v0.6.0` tag:
  - `propTest` with missing groups and with `p`; `pairwisePropTest` with missing groups (dropped and
    the rest renumbered, as in R);
  - `uniroot` when `f` returns a non-finite value;
  - default number of points and range of `spline`, now taken from the regularized x;
  - the third derivative of `splinefunH` and of `splinefun` with `method: "monoH.FC"` is now the
    exact one; R returns h times it on an interval of width h (see docs/differences-from-r.md);
  - `lm` with weights of 0 (those rows are left out of the fit, all zero is an error) and with an
    intercept-only model (R² = 0 and no F test, as in R);
  - `optimize` with `lower >= upper` is now an error, as in R;
  - a non-integer `deriv` (`splinefun`, `splinefunH`) is truncated and non-integer lengths (`n`)
    are rounded up, as in R;
  - `barylag` with duplicate nodes; `lu` forms its multipliers as LAPACK does;
  - `TukeyHSD` comparison names (labels, or positions in the list; groups without data left out);
  - `kruskalTest` and `flignerTest` with an empty group, `mcnemarTest` with different numbers of
    levels in x and y, `bartlettTest` with infinite values, `poissonTest` with zero counts and
    zero `T` or `r`, all now as in R;
  - accuracy of `besselK` and `besselI` for orders near 2.5, the arcsine distribution near its
    upper end, `gammainc` for large a, `perm` (overflow and non-integer k), the `distSummary` kurtosis of
    `lnorm` for small sdlog, `psigamma` for large x, `beta` for huge a, and `choose` for
    non-integer n;
  - `pretty` no longer overflows for huge ranges.

## 0.5.0 - 2026-10-21

First public version.

### Included

- Special functions: `gamma`, `lgamma`, `beta`, `lbeta`.
- d/p/q functions with `lowerTail` and `logP` for the normal, t, chi-squared, F, beta, gamma,
  binomial, Poisson, uniform, exponential, log-normal, logistic, Cauchy, Weibull, geometric,
  negative binomial, hypergeometric, Wilcoxon signed rank and rank sum, and studentized range
  distributions, and the non-central chi-squared, t, F and beta (`ncp`).
- Random numbers that reproduce R's `set.seed()` streams: `setSeed`, `getRandomSeed`,
  `setRandomSeed`, 20 `r*` functions, `sample` and `sampleInt`.
- Hypothesis tests returning R's `htest` fields as plain objects: `tTest`, `chisqTest`,
  `fisherTest` (including r × c tables), `wilcoxTest` (exact and normal approximation, with
  confidence intervals), `cor`, `corTest` and `pAdjust`.
- Linear algebra on matrices given as arrays of rows: `crossprod`, `tcrossprod`, `norm`,
  `backsolve`, `forwardsolve`, `chol`, `chol2inv`, `qr` (R's default limited pivoting and the
  LAPACK variant) with `qrQ`, `qrR`, `qrX`, `qrCoef`, `qrQy`, `qrQty`, `qrResid`, `qrFitted`,
  `qrSolve`, `solve`, `det`, `determinant`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and
  general, including complex eigenvalues) and `ginv`.

### Conventions

- Indices are 0-based, matching JavaScript arrays: `sampleInt(n)` returns integers in `0..n-1`
  (R's `sample.int()` minus 1, from the same random stream), and the `pivot` of `qr()` and of
  `chol(x, { pivot: true })` is 0-based.
- Errors are thrown with English messages, and the class tells the kind of problem: `TypeError`
  for wrong types or shapes, `RangeError` for values out of range, and `Error` for numerical
  failures (singular matrix, not positive definite, no convergence, data essentially constant).
- A single-file minified ES module, `dist/rstats.js`, for loading from a CDN; release tags contain
  the build output so that jsDelivr can serve it from GitHub.
- ESM only, no dependencies, tree-shakable. Requires Node.js 22 or later (or another ES2022
  environment).
