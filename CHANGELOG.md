# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

While the version is 0.x, a minor release (0.y.0) may contain breaking changes;
they are listed under **Breaking** for each release. From 1.0.0 the project follows
[Semantic Versioning](https://semver.org/).

## Unreleased

### Breaking

- Argument errors that were a plain `Error` are a `TypeError` (wrong type or shape) or a `RangeError` (value out of
  range), as the other functions (the messages are unchanged):
  - `pivotLonger` and `pivotWider`: a `colsVary` or `namesVary` that is not a string, a `namesSep` with one
    `namesTo`, several `namesTo` without `namesSep` or `namesPattern`, a `namesPattern` with the wrong number of
    groups, and a `.value` transform that gives no string are TypeErrors; an unknown `colsVary` or `namesVary`, a
    column that does not exist, an empty `cols`, `namesFrom` or `valuesFrom`, `.value` twice in `namesTo`, a value
    column given twice for one key, `idCols` that overlap `namesFrom` or `valuesFrom`, and values not uniquely
    identified without `valuesFn` are RangeErrors.
  - `merge`: `byX` and `byY` of different lengths are a TypeError, a key that is not a column a RangeError.
  - The formula forms of the tests (`tTest`, `wilcoxTest`, `varTest`, `ansariTest`, `moodTest`, `ksTest`,
    `kruskalTest`, `flignerTest`, `bartlettTest`, `onewayTest`, `friedmanTest`, `quadeTest`, `corTest`): a formula of
    the wrong form for the test is a TypeError. A grouping factor without exactly 2 levels and a block design that is
    not unreplicated and complete stay an `Error` (data whose result is not defined).
  - Data frames and columns: a duplicate column name (`cbind`, `merge` with suffixes that collide, `aggregate`) and a
    `select` of `subset` that is not a column are RangeErrors, and data frames with different names in `rbind` a
    TypeError; a column named in a formula or option that does not exist ("object 'x' not found": `aggregate`, the
    model functions such as `lm` and `glm` and their `weights`, the formula forms of the tests, `aovEz`) is a
    RangeError, and so are a factor given in both `between` and `within` of `aovEz`, a factor name repeated in
    `between` or `within` ("duplicated factor names in 'between': A") and an `observed` variable that is not a factor
    ("Observed variable not in data: x"), the same error of `etaSquared`'s `generalized` included.
- `aov(x, g)` and `aov(samples)` return the fit of the model `y ~ g` (an `LmFormulaResult`, as `aov("y ~ g", data)`)
  instead of the one-way table, as R's `aov` always returns a fit; the table is `aovSummary(aov(x, g))` (rows `g` and
  `Residuals`), and the `AovResult` type is removed. The levels of `g` are the group labels in R's order, or the
  positions of the samples in the list (from 1). F and p agree with the old table to the last bit or within a few ulps
  of rounding (the sums of squares now come from the QR of the fit). Where the residual sum of squares is exactly 0,
  the fit leaves rounding residue as R's does; the table takes it as 0, as the old table: F = Inf and p = 0, and NaN
  when all values are equal (see Changed).
- `steelTest` is removed. It only reproduced the errors of PMCMRplus 1.9.12's `steelTest`, which fails on every input,
  and never returned a value; Steel's many-to-one rank test is `manyOneUTest` (its normal approximation).
- A key of an options object that the function does not know is a RangeError, where it was ignored: a misspelt key
  such as `pnorm(q, { lowertail: false })` gave the lower tail without a sign ("unknown option 'lowertail' for pnorm
  (known: mean, sd, lowerTail, logP)"). A key whose value is `undefined` counts. This holds for every exported function
  that takes options, the nested objects with fixed keys included (`optim`'s and `optimHess`' `control`, `glm`'s
  `family` and `link` given as objects, `coxph`'s and `factanal`'s `control`; "unknown option 'control.maxitt' for
  optim", and so for `optimHess`, whose `control` is a position), for the `params` of `distSummary` (the parameters
  of the distribution's d function: `shape`, `rate` and `scale` for `"gamma"`; not `ncp` of `chisq`, `beta`, `t` and
  `f`, which was ignored, giving the summaries of the central distribution) and for the options of the function
  `splinefun` and `splinefunH` return. Objects whose keys are the user's data (data frames, `contrasts`, `levels`) are
  not checked. In `lmer`, `lmerSummary`, `lmerContest` and `lmerAnova` an unknown key was a TypeError with R's
  message ("unused argument (reml)") and is now this RangeError too; an argument of R that they do not support
  (`lmer`'s `weights`, `lmerAnova`'s `ddf`, ...) is still the Error "lmer: argument 'weights' is not supported",
  checked first.
- `HTest` and the other results of the tests, effect sizes, power and agreement functions, and `factanal`'s, have a
  required `warnings: string[]`: R's warnings, each once, in R's order, an empty array when there are none. Code that
  builds such an object itself must add the field. The functions that had no `warnings` return an empty array, except
  those that now give R's warnings where they were silent: `wilcoxTest` ("cannot compute exact p-value with ties" or
  "with zeroes" and the same of the interval, when the exact method asked for or chosen by default cannot be used;
  "requested conf.level not achievable", where the interval's confidence level is lowered; "cannot compute confidence
  interval when all observations are zero or tied", where the interval is `NaN`) and `ansariTest` ("cannot compute
  exact p-value with ties" and, with `confInt`, "cannot compute exact confidence intervals with ties", where R stops
  but the normal-approximation interval is returned; "samples differ in location: cannot compute confidence set,
  returning NA", "cannot compute confidence set, returning NA", "cannot compute estimate, returning NA" and "cannot
  compute asymptotic confidence set or estimator", where the interval or estimate is `NaN` or left out). The warnings
  R gives in the other tests that lack them are to come.

### Added

- The package can be loaded with `require()` (Node 22.12 and later load ES modules with `require`): each subpath of
  `exports` has a `default` condition besides `import`, and `@numero-uno-jpn/rstats/package.json` is exported.
- Each subpath exports the types its functions use, so they need no import from another subpath: `Sample` and
  `DataFrame` from `/descriptive` and `/linalg`, `Sample` from `/numerics`, `DataFrame` and `ContrastName` from
  `/mixed`, `MatrixInput` and `QR` from `/tests`.
- Results whose fields keep the names of R or of a package get aliases with the names the other results use, as
  ordinary fields with the same values (the old names stay): `pValue` for `survdiff`'s `pvalue`; `stdError`, `zValue`
  and `pValue` for `coxph`'s `se`, `z` and `p`; `stdError`, `tValue` and `pValue` for `glhtDunnett`'s `se`, `t` and
  `p`; `zValue`, `pValue` and `pAdjusted` for `dunnTest`'s `Z`, `P` and `PAdjusted`; `pAdjusted` for `TukeyHSD`'s
  `pAdj`; `stdError` for the `stdErr` of `tTest` and `survfit`; `fValue` for `icc`'s `Fvalue`.
- The optional arguments taken by position as in R are also accepted in an options object (an overload), in place of
  the argument or after it: `glmResiduals(fit, { type })`, `cohenES(test, { size })`, `outer(x, y, { fun })`,
  `tabulate(bin, { nbins })`, `propTrendTest(x, n, { score })` and `s(xq, { deriv })` for the function `s` that
  `splinefun` or `splinefunH` returns (its type is the new `SplineFunction`). `optimHess` keeps `gr` and `control` by
  position only, as R (a positional `control` is itself a plain object). Giving one both by position and in the options is a
  RangeError. New types: `GlmResidualsOptions`, `CohenESOptions`, `OuterFun`, `OuterOptions`, `TabulateOptions`,
  `PropTrendTestOptions`, `SplineFunction` and `SplineFunctionOptions`.
- `setWarningHandler(handler)` passes R's warnings to a function of the user's choice, as R prints them, such as
  ``setWarningHandler((message, source) => console.warn(`${source}: ${message}`))``: each call of a test, model or fit
  (and `pivotLonger` without `onWarning`) passes its warnings once it has its result, each distinct warning once, with
  the name of the function called (also the warnings the tests now give, such as `wilcoxTest`'s "cannot compute exact
  p-value with ties"); a function that calls another, such as `pairwiseWilcoxTest`, passes them once under
  its own name. A fit's warnings are passed once, when it is fitted (`lm`, `glm`, `aov`, `lmer`, ...); a function
  given a fit or a table (`anova`, `aovSummary`, `Anova`, `glmSummary`, `etaSquared`, `lmerSummary`, ...) keeps them
  in its result's `warnings` but passes only those it adds. An error thrown by the handler propagates to the caller
  (as R's `options(warn = 2)`). `setWarningHandler(null)`, the default, passes nothing; the previous handler is
  returned. The handler is kept on `globalThis`, one setting for every copy of the library on a page. Exported from
  the root, `rStats.js/distributions`, `rStats.js/tests` and `rStats.js/mixed`, with the type `WarningHandler`.

### Changed

- `aovSummary` and the sequential table of `anova` take a residual sum of squares at the level of rounding (below
  1e-24 times the weighted sum of squares of the response, as `Anova`'s check of an exact fit) as 0, with the sums of
  squares of the terms at that level: F = Inf and p = 0 for groups without spread (`aov([[1, 1], [2, 2]])` gave F =
  3.4e64 from the residue of the QR, as R), and F = NaN where all values are equal (F = 0.6 or 1 from the residue).
  The same holds in each stratum of a fit with `Error()` (the sum of squares of the whole response as the scale): F =
  Inf or NaN where the Within stratum of `aov("y ~ g + Error(id)", d)` gave F = 2.9e33 from the residue. The tables
  of other fits are unchanged to the bit.

### Fixed

- The result of `svd` no longer has the internal field `s` (the power-of-2 exponent of the singular values), which is
  not part of `SvdResult`.

## 0.16.0 - 2026-11-04

Fixes from a numerical review and GitHub issues #8 to #513. Each case is described, with R's value and rStats.js's, in
[differences from R](docs/differences-from-r.md) and in the review logs (`docs/review-logs/review_fix_log_*.md`).
Where R itself is wrong, rStats.js now returns the mathematically right value; where R is right, the aim is R's bits.
The rules behind these changes are listed under "Design rules" in [CONTRIBUTING.md](CONTRIBUTING.md).

### Breaking

- More inputs that define no result are errors, also where R returns NaN, NA or a meaningless value (the distribution
  functions keep returning NaN for invalid parameters, as R):
  - Hypothesis tests: a simulation with `B = 0` or a fractional `B` in `chisqTest` and `fisherTest`; `TukeyHSD` and
    `tukeyTest` with 0 or 1 residual degrees of freedom, and `TukeyHSD` with a NaN `confLevel` or one outside [0, 1];
    `pairwiseTTest` (pooled SD) and `onewayTest(varEqual: true)` with a pooled within-group variance of 0, and the
    Welch `onewayTest` with two or more constant groups; `mauchlyTest` with one tested dimension; `propTrendTest` with
    no events or only events, fewer than two distinct scores or an infinite score; an infinite observation in `adTest`,
    `cvmTest`, `lillieTest`, `sfTest` and `pearsonTest`; `flignerTest` with a group whose median is infinite;
    `jonckheereTest` with fewer than 2 nonempty groups; `brunnerMunzelTest` with a sample of fewer than 2 values;
    `cronbachAlpha` with one subject, `kappa2` with fewer than 2 complete pairs, `omega` with fewer than 2 variables;
    `tTest` with a standard error of 0 also when the mean is 0; `powerTTest`, `powerPropTest` and `powerAnovaTest`
    solving for n (or a proportion) where there is no effect.
  - Models: `lm` with an infinite weight; `lmer` with a non-finite response or a non-finite column of a random-effects
    term; `aov` with `Error()` and a non-finite response; `lmerContest` with NaN in `L` or `rhs`; `aovEz` with a factor
    name given twice; `glm` with a two-column binomial response whose total overflows; a formula power beyond the
    integer range (`y ~ (a + b)^1e999` did not return).
  - Numerical methods: `uniroot` with `tol = 0` or an unknown `extendInt`; `optim` and `optimHess` with
    `fnscale = ±Infinity`, a non-finite function value at an evaluated point or a non-finite analytic gradient;
    `grad`, `jacobian` and `hessian` with a step that is not positive and finite, `r` above 512, or (`jacobian`)
    results of differing lengths; `integrate` with `subdivisions` beyond the integer range; `ode` with a non-finite
    time; `approx` with a `rule` other than 1 or 2 or an unknown `method`; `seq` with an infinite `by` pointing away
    from `to`.
  - Linear algebra: `lu` of a matrix with NaN or infinite values; `qr` and `qrSolve` with `tol = Infinity`; `qrX` with
    `ncol` above the dimensions; `rcond` with a `uplo` other than `"U"` or `"L"`; `svd` with a negative or NaN `nu` or
    `nv`.
  - Descriptive statistics and data: `hist` with an infinite or NaN break; `cut` with fewer than 2 breaks; `pretty`
    with invalid `shrinkSml`, `highUBias` or `u5Bias`; `mean` with `trim = NaN`; `tapply`, `split` and `aggregate`
    with 2^31 cells or more; `pivotWider` and `pivotLonger` with tidyr's errors (an id column also selected as names
    or values, an empty `namesFrom` or `valuesFrom`, `colsVary` and `namesVary` other than `"fastest"` or
    `"slowest"`, a `namesPattern` with the wrong number of groups).
- Computation limits: calls that would allocate more than 2^24 values in one array or run for more than about 10
  seconds throw a RangeError before allocating or computing (exact tests point to `exact: false`). Before, they ran for
  minutes, ran out of memory or did not return.
  - Exact tests: `fisherTest` (2 × 2) and `mantelhaenTest(exact: true)` with a support above 2^24 values (and
    `mantelhaenTest` with a total of 2^53 or more); `ksTest`'s exact one-sample p-value above 2^33 multiply-adds;
    `ansariTest` and `jonckheereTest` above 2^24 values or 2^32 steps; `corTest(method: "kendall")` without ties for
    n above 1290; `pAdjust(method: "hommel")` for n above 65536.
  - Simulations and random numbers: `r2dtable` and the simulated p-values of `chisqTest` and `fisherTest` for tables
    with a total above 2^24; `chisqTest`'s goodness-of-fit simulation above 2^27 draws (`B` times the total);
    `rwilcox` with n above 2^24; `rsignrank` with n of 2^27 or more; weighted `sample` and `sampleInt` with a size of
    2^31 or more.
  - Distributions and special functions: `dwilcox`, `pwilcox` and `qwilcox` above 2^29 steps; `phyper` above 2^26
    terms and `qhyper` with a standard deviation above 2^21; `besselJ`, `besselY`, `besselI` and `besselK` where the
    series or recurrences would take more than 2^25 to 2^31 steps, or a phase that doubles cannot resolve.
  - Linear algebra: `expm` with the Taylor and Padé methods where order × (n^3 + 64) exceeds 2^31.
- Values that change in the ordinary range:
  - Welch's degrees of freedom in `tTest`, `cohensD` and `gamesHowellTest`, and `tTest`'s interval ends and Welch
    standard error, take R's (and the packages') forms and now match R's bits (they were 1 to 3 ulp off).
  - `contr.poly` (the polynomial contrasts of `lmer`) with 15 levels or fewer comes from a recurrence that is within
    5.8e-16 of the exact values; its last bits differ from R's, which were up to 2.8e-13 off.
  - `chisqTest`'s standardized residuals (`stdres`) of a contingency table use exact complements of the margins
    (R's form lost small margins); other tables change in the last bits.
  - `distSummary` of the triangular distribution forms the variance and the skewness from differences without
    cancellation.
  - `Anova` takes a residual sum of squares below 1e-24 times the sum of squares of the response as 0 and returns the
    table (car's behaviour) instead of an error.
  - `pAdjust(method: "hommel")` with n = 2 is Hochberg's method, as R.
  - `ksTest`'s exact two-sided one-sample p-value for D < 1/2 is summed from positive terms where it is below about
    1e-2 (it had an absolute accuracy of 1e-15 only).
  - `quadeTest` counts only the complete blocks (R counts the dropped ones as well).
  - The Welch `onewayTest` with one constant group returns the limit as its variance tends to 0 (R: NaN).
  - `cor` has NaN on the diagonal where a column's correlation with itself is undefined; group labels that mix
    numbers and strings are strings, as R coerces them; `chisqTest` sorts the levels by code point; the two-sample
    `wilcoxTest` with every value tied has p = 1.
  - The Laplace distribution with `sigma = Infinity` is the limit (as the normal, logistic and Cauchy ones), and
    `df(Infinity, ...)` is 0 (R: NaN); `qbinom` rounds a fractional `size` half to even, as R.

- Inputs that define no result are errors (R returns NaN or a meaningless value): `mcnemarTest` on a table without
  discordant pairs, the signed rank `wilcoxTest` with only zero differences, `varTest` with two constant samples,
  `chisqTest`'s simulation with fractional counts, a non-integer `B` or goodness-of-fit counts not summing to an
  integer, `mantelhaenTest(exact: true)` with fractional counts, `dunnettTest`, `tukeyTest` and `glhtDunnett` with a
  pooled within-group variance of 0 (or no residual degrees of freedom), `pAdjust` with `n = Infinity`, `glm` with
  infinite weights ("non-finite weights not allowed"), and `table` with a `useNA` other than `"no"`, `"ifany"` and
  `"always"` (R's match.arg error).
- `glm` halves an IRLS step that increases the deviance (by `epsilon` relative or more, glm2's rule). R's `glm.fit`
  accepts such steps and can stop at a false convergence: a binomial fit with all weights 1000 returned coefficients
  of 1e15 and a deviance of 144175 (the maximum is 4956), and the glm2 example (binomial, `start = -1.81`) a
  coefficient of 2.25e15 instead of log 3.
- The links of `glm` are exact beyond R's clamps: logit beyond |η| = 30, log below `exp(η) = eps`, probit, cauchit,
  cloglog and power at the ends (R clamps η or μ to the values at eps and the derivatives to eps), kept within (0, 1)
  by the least double and the largest double below 1; the cloglog link is `log(-log1p(-mu))`. Fits that reach these
  ends (separated data in particular) change. `glm` also warns when the linear predictor still moves at convergence
  ("the data may be separated").
- `optim(method = "CG")` tries the minimum of the parabola through the start of the line search and the accepted point;
  R's cgmin always tries the midpoint. CG's path, results and counts now differ from R's (a quadratic of 3 variables:
  8 function evaluations instead of 46).
- `fisherTest` (2 × 2) and `mantelhaenTest(exact: true)`: the conditional MLE and the confidence limits are the roots to
  full precision (R's uniroot stops up to several percent off, at the end 1/eps for a 99.99% limit).
- `jonckheereTest`'s normal approximation with ties uses the permutation variance with the ties (Hollander & Wolfe);
  clinfun and DescTools use the variance without ties.
- `dunnTest`'s step-wise adjustments give tied p-values the same adjusted value (dunn.test's depend on the order of the
  groups); without ties as dunn.test.
- `glm`'s AIC leaves out the rows of weight 0 (R's gaussian AIC was Inf), and deviance residuals without residual
  degrees of freedom come from each row's contribution (R returns 0, also for a fit that has not converged).
- `glmSummary` names the statistics "z value" whenever the dispersion is not estimated (as R; a given dispersion was
  named "t value").

### Added

- Formula variable names may contain letters outside ASCII (`lm("転帰 ~ 年齢", ...)` was an error).
- `modelMatrix` accepts a response of any type (it was "the response must be numeric"), as R's `model.matrix`.
- `aov` accepts `Error()` terms in parentheses (`y ~ treatment + (Error(subject))`), as R.
- `grad`, `jacobian` and `hessian` accept a negative step `eps`, as numDeriv.

### Changed

- `rwilcox` with m + n above 2^24 keeps only the swapped ranks instead of an array of m + n ranks (up to 8 GB), with the
  same values and random stream.

### Fixed

- Distributions (#19 to #493): point masses and overflowing shapes of the beta family, `ppois`, `pbinom` and `pnbinom`
  beyond 2^53, `phyper` and `qhyper` beyond 2^53, the discrete quantile search near the largest double, the
  location-scale families near the ends of the range, noncentral distributions, `wilcox` and `signrank` tails,
  `distSummary` where its closed forms overflow or underflow (the beta, gamma, F, Weibull, Kumaraswamy, negative
  binomial and hypergeometric families among others) and of a hypergeometric point mass (populations of 0 or 1 gave
  NaN moments).
- Special functions (#24 to #492): Bessel functions at subnormal and huge arguments and orders (Debye's expansion for
  orders above 1000, the large-x expansion where its powers overflow), `gamma` near its edges, `choose` near overflow.
- Random numbers (#30 to #428): R's rounding of integer parameters, NaN for invalid parameters with R's stream kept,
  infinite draws of `rgeom` and `rnbinom`, `r2dtable`'s limits, noncentral `rt` and `rf` with infinite df, and `r`
  functions at infinite parameters that return the limits of their `q` functions.
- Descriptive statistics (#16 to #473): moments, `sd`, `scale`, `cv` and `prcomp` scaled before centring (no overflow
  where the deviations do), `sum` and `mean` with values in three bands of magnitude that cancel, `weightedMean` with
  products below the normal range, `hist`, `cut`, `ecdf` and `findInterval` with more than 2^31 values or breaks,
  `omega`'s convergence warning.
- Hypothesis tests (#41 to #507): tail probabilities computed directly (`ksTest`'s exact p-value for D ≥ 1/2: 2.0e-20
  where it was 0), intervals at confidence levels next to 1, `binomTest` and `poissonTest` at large counts and beyond
  2^53, `quadeTest` and `flignerTest` at any scale, `mcnemarTest` where a pair's counts overflow and its continuity
  correction with fractional counts, `ansariTest`'s interval and estimate at the ends of the range, `wilcoxTest`'s
  signed rank interval at a large `mu`, `survdiff` with a singular variance.
- Linear models and ANOVA (#8 to #509): standard errors independent of the units of x and of the weights (`lm` with a
  column of 1e-200 or weights below 1e-308), `aov` with `Error()` and large covariates, `anova` and `glmAnova` test
  only nested fits (judged on the rows of positive weight), `aovEz` scaled on the kept subjects only, `predict` with
  the exact inner product where the plain sum overflows, warnings of the fits carried to the tables, `mauchlyTest`
  checks.
- `glm`: hat values follow the rows of the last QR (a working weight that underflowed shifted them), the null deviance
  with weights of 1e308, `glmPredict`'s standard errors where the squares overflow, Rao's score test with the smaller
  model's intercept (as R), profile intervals of `glmConfint` whose restricted fits cycled in the last bits (NaN
  limits), `glmAnova` warns about a model that has not converged, `glmRstandard` keeps small residuals of a rank-0 fit,
  deviances and AIC of the binomial, Poisson, Gamma and inverse Gaussian families where their terms overflow,
  `glmPredict` with the exact inner product.
- `lmer` and lmerTest: a response of 1e200 times ordinary data fits (#9), random slopes at any units of x (#11),
  Satterthwaite's degrees of freedom independent of the units of the response and of x (#10; a response times 1e6 made
  the df of x 7.4e8 instead of 31), a response with a large constant added is no longer taken for an exact fit (#12),
  and `lmerAnova` compares the fixed effects of fits as column spaces (#8).
- `coxph`: a column dropped by the Cholesky factorisation no longer enters the solution (#13), tests in units of each
  covariate's scale, times near 1e308.
- Linear algebra (#55 to #465): `eigen`, `svd`, `schur`, `qr`, `solve` and `expm` at the ends of the range, triangular
  solves, `determinant`, `matMul`, `crossprod` and `tcrossprod` with the exact inner product where the plain sum
  overflows or falls below the normal range, `rcond`, `qrSolve` and `kappa` on singular matrices.
- Numerical methods (#13 to #504): `integrate`, `optimize` and `uniroot` on intervals whose width overflows, `seq`,
  `approx` and `spline` near overflow, `barylag` with nodes of any scale (#14), `splinefunH` and `hermiteInterp`
  where differences overflow, `ode`, `optimHess` and `hessian` with large steps or values.
- Data handling (#35 to #500): `pivotLonger` and `pivotWider` as tidyr (name transforms, separators after zero-width
  matches, repeated columns), `merge` with key columns of different types.

## 0.15.3 - 2026-10-29

### Fixed

- `qcauchy` returned ±Infinity for p between about 1.8e-309 and 5.6e-309 although the quantile is finite
  (`qcauchy(2.2e-309, { lowerTail: false })` is now 1.4468631190172319e308): scale / p overflowed before the division
  by π.
- `pt`, `dt` and `qt` at a huge df: from about 1.3e300 `dt` and `pt` were NaN (`pt(10, 1e305)`,
  `dt(0, 1e305)`), and `qt` was off (`qt(1.31e-295, 7.19e301, { lowerTail: false })` was 36.72783758590317; now
  36.727901113286414, as R) or took a second. Above df = 1e200 the normal is used where t²/df < 1e-17, and the far tail
  -(df/2) log1p(t²/df) beyond; likewise with `ncp`, where `pt(-4.05e269, 3.586e307, { ncp: 1 })` and `dt` were NaN
  (R gives 0.5 for that `pt`; it is 0).
- `qt` and `dt` at a subnormal df: `qt(1e-5, 1e-310, { lowerTail: false })` was 4.26 although `pt` is 1/2 at every
  finite t there (now Infinity, as at df = 1e-300 and in R), `dt(0, 5e-324)` was NaN; with `ncp`, `pt` and `dt` at
  df = 5e-324 were NaN, and below df = 1e-308 tails of the order of df were 0, Infinity on the log scale or lost
  digits (`pt(51.65, 2.6e-316, { ncp: 51.6 })` was 0, below its value at 49.77).
- `qt` near p = 1/2 for df between 1e-15 and about 1e-9 (`qt(0.499999999, 1e-10, { lowerTail: false })` was 0.59,
  not 2425.8), and `qt(-1e100, 1e150, { logP: true })` (-1, not -1.4e50).
- `qt` with `ncp` at a tiny df and a large ncp: `qt(1e-300, 1e-300, { ncp: 1e4 })` was 1, where `pt` is 3.4e-298 (now
  2.463741370564455e-146; R gives 18961.5, with `pt(1, 1e-300, 1e4)` 0). The test for a t so near 0 that `pt` is
  Φ(-δ) overflowed below df = 2e-300 with a large ncp, and at t = 0 it was NaN, so the solver's first step to 0 led
  nowhere; the solver now starts from the gamma quantile where P[T <= t] is about Q(df/2, (df/2) δ²/t²) (at df = 1e-200
  it took 50 ms). And `pt` with `ncp = 1e5` and `1e6` at a subnormal df was +Infinity on the log scale at some t
  (`pt(1e-155, 1e-310, { ncp: 1e5, logP: true })`, now -2500000735.787591), where the peak of the integral was not
  found.
- The gamma family, `chisq`, `invgamma`, `weibull` and `lnorm` at a huge parameter: from a shape, df, alpha or sdlog of
  about 1e301 many calls were NaN (`pgamma(1.4e-284, 4.2e301, { rate: 0.0014, logP: true })`, now -5.643831101470294e304
  as R; `pchisq(1e-300, 1e308)`, `dchisq(0.22, 5.3e306)`, `dweibull(1.9e-255, 6.6e306, { scale: 98.6 })`,
  `pinvgamma(5.1e280, 2e304)`, `plnorm(2, { sdlog: 1e302 })`, `qlnorm(1e-30, { sdlog: 9.3e307 })`), where double-double
  products of numbers above 1e300 overflowed in their splitting or an overflowed term met another in a sum; and
  `dchisq(1e308, 1e308)` was 0, not 2.8209479177387811e-155 (2πx overflowed in the normalizing factor).
- The same functions at a subnormal parameter: `qchisq(0.5, 1e-310)` and `qgamma` at shapes below about 1e-307 were NaN
  (now 0, as R); `pgamma(Inf, 892.4, { rate: 2.8e-316 })`, where 1/rate overflows, was NaN (now 1; R gives NaN) and
  `qgamma` at such a rate NaN for a quantile below the normal range (now Infinity, as at other p, since `pgamma` is 0 at
  every finite q there); and upper tails of the order of a shape below 1e-300 lost digits on the log scale
  (`pgamma(1, 4.8e-316, { scale: 2.06, lowerTail: false, logP: true })` was 5e-9 off,
  `pgamma(1e-310, 5e-324, { lowerTail: false, logP: true })` 3e-4), so that `dgamma` did not match their differences.
- The beta and F families at a huge parameter: from a shape of about 1e299 `pbeta` was NaN far from the mass
  (`pbeta(1.5e-236, 9220.5, 2.6e301)`, now 1 as R; `pbeta(1e-307, 55.1, 6.3e307)`; and where b log(1 - x) is beyond the
  doubles, `pbeta(0.998, 55.1, 6.3e307)` and `dbeta` there), where the double-double divisions and products of the
  continued fraction overflowed in their splitting; `qbeta` was 0 after 0.8 s (`qbeta(5.9e-49, 9220.5, 2.6e301)`, now
  3.078354768366422e-298 as R) or did not return (`qbeta(8.7e-285, 1.3e304, 5.9)`, now 1; R does not converge);
  `qf(1.9e-13, 0.0885, 6e302)` did not return (now the χ² limit 4.611344535319733e-287, where R gives
  4.6113445353195029e-287), and the noncentral `qf` far out took seconds (`qf(5.4e-11, 3.7e-313, 1249, { ncp: 1.7e243 })`
  did not return; now Infinity, as R, from Chernoff bounds at the ends; from a df2 of about 1e40 the noncentral χ²
  limit, where `qf(-385.8, 1.05, 1.1e264, { ncp: 1.7e262, logP: true })` did not return (R gives Inf)); `pf` with ncp
  near the largest double was 0 in both tails (`pf(2.5e300, 1828, 0.165, { ncp: 3.7e307 })`; R gives NaN); and the
  `nbinom` upper tail far out at prob near 1e-300 is no longer NaN (`pnbinom(1e303, 641, { prob: 9e-300, lowerTail: false
  })`, 0).
- The beta and F families at a subnormal or tiny parameter: noncentral densities at a tiny ncp were NaN
  (`dbeta(1.05e-231, 0.19, 141, { ncp: 1.4e-303 })`, `dchisq(1, 1, { ncp: 1e-310 })`, `df(2.9e-257, 0.0275, 3, { ncp:
  5e-324 })`; now the central density, which they equal to the double); the log of a beta tail of the order of a
  shape below 1e-300 lost digits, so that `dbeta` did not match its differences (`pbeta(0.97, 0.13, 8.15e-322, { logP:
  true })`, now -736.93155014878607; R gives -736.93128475074695); `pbeta(1 - 6e-14, 0.97, 4.7e-307, { lowerTail:
  false })` was 1 - 5.5e-14 beside a lower tail of 1.4e-305 (now 1, as R); a subnormal `qbeta` was 5e-14 off
  (`qbeta(3.8e-277, 27.9, 1.5e299)`, now 9.585930727509766e-309 as R); and `pf(2e-323, 0.0121, Inf)` was 0 (q df1
  underflowed; now 0.01091389160021212, R gives 0).
- `qtukey` with nranges > 1 did not return where 1 - W underflows in the upper tail
  (`qtukey(1.5e-287, 3, 4.7e10, { nranges: 2, lowerTail: false })`, now 51.31849500218445; R does not converge), as the
  log of that tail was -Infinity (`ptukey(54.5, 3, Inf, { nranges: 2, lowerTail: false, logP: true })`, now
  -744.6488312090673; R gives -Inf).
- `qcauchy` with `logP` at a subnormal scale lost digits (`qcauchy(-547.5, { location: 3.5e-180, scale: 9.1e-314,
  logP: true })` was 7e-11 off; scale / π was subnormal), and was -Infinity from log p = -1420 on although the quantile
  at the smallest scales is finite down to -1454.
- `qkumar` at a shape a below 1e-300 was NaN (`qkumar(4.8e-52, 9.9e-314, 2.5)`, now 0 as extraDistr); the log of the
  lower tail of `pkumar` and `ppareto` at a subnormal shape lost digits (`pkumar(0.2, 0.42, 1.85e-317, { logP: true })`
  was 2.5e-10 off, `ppareto(318.7, { a: 1.04e-317, logP: true })` 3e-11; extraDistr gives -Inf for both).
- `dnbinom(0, size)` from a size of about 1e299 was NaN (`dnbinom(0, 2.4e301, { prob: 1 - 2.3e-11 })`, now 0 and
  -5.5037505412224715e290 on the log scale, as R).
- Noncentral χ²: from ncp = 2e290 at a tiny x, `pchisq` and `dchisq` were NaN (`pchisq(1e-308, 294, { ncp: 2.9e304
  })`, now 0 as R; on the log scale -λ/2 to the double, where R's `dchisq` gives -1.02e307 instead of -1.45e304); at a
  subnormal x with an odd last bit, the rounding of x/2 showed (2% at `pchisq(1.63e-322, 0.49, { ncp: 1 })`, 2e-6 in the
  differences of `pchisq` against `dchisq(7.02e-315, 0.5, { ncp: 24.3 })`), and below x = 2.2e-308 the log Poisson
  weights of the mixture took log Γ in double, so that `pchisq(2.1e-317, 1.2e-51, { ncp: 197 })` was 3.8e-15 above its
  value at 5.3e-296 (likewise 1.4e-15 at x = 1e-307 and df = 1.1e-261). At a huge x and a tiny ncp `pchisq` and `dchisq`
  were NaN (`dchisq(3e307, 0.5, { ncp: 2.2e-320 })`, `pchisq(4.2e301, 0.0115, { ncp: 1.5e-303 })`), and where x + ncp
  is beyond the doubles they were wrong or NaN (`pchisq(1e308, 3.3e268, { ncp: 6.9e307 })` was 0.55, not 1, and NaN or
  -Infinity above; `qchisq(-85.6, 3.3e268, { ncp: 6.9e307, logP: true })` was Infinity, not 6.939005443890441e307;
  `dchisq(1.79e308, 3, { ncp: 1e308, log: true })` was -Infinity).
- `pcauchy` and `dcauchy` where q - location overflows: the smaller tail was 0 and the log density -Infinity
  (`pcauchy(1.79e308, { location: -1.1e307, scale: 2.7e296, lowerTail: false })`, now 4.529328385253959e-13).
- `dnorm` at an sd below about 2.2e-309, where 1 / sd overflows, was NaN (`dnorm(4.85e-319, { sd: 1.7e-322 })`, now 0;
  `dnorm(30 sd, { sd })` is now 8.772626419912559e125 there).
- `qtriang` with a subnormal width returned the mode where the tail's share of its part overflowed
  (`qtriang(1.6e-8, { a: 0, b: 1.03e-316, c: 8.7e-317, lowerTail: false })`, now 1.02817096e-316).
- Quantile searches at a subnormal p: the residual F(x) / p overflowed, and the steps went astray
  (`qgamma(7.2e-317, 3.3e126, { scale: 0.136, lowerTail: false })` was 8.2e146, 1e21 times the mean; now
  4.4838914172971214e125, as R).
- `pbeta` at a subnormal x and a shape above 1e300 was NaN (`pbeta(1.5e-323, 1.4e304, 0.5)`, now 0 as R, and
  -1.0617460181147866e307 on the log scale; `pbeta(4.2e-310, 4.1e307, 1113)`, where a log x overflows, now 0).
- `pf` at a subnormal df1 was 1 in the upper tail from x = 1e301 on (`pf(1e301, 1.4e-312, 6.72, { lowerTail: false })`,
  now 1.77365978354e-311), and `qf` there did not return (`qf(1.1e-322, 1.4e-312, 6.72, { lowerTail: false })`, now
  Infinity as R); `qf` whose search stepped to Infinity, where `pf` was NaN, returned 1 after 5 s
  (`qf(-735.2, 1.25e-305, 3.3e5, { lowerTail: false, logP: true })`, now 4.63214927370753e306); the noncentral `qf` at
  a huge ncp took a second (`qf(3.97e-237, 364.4, 1.476, { ncp: 1.94e11 })`).
- `ptukey` at a subnormal q lost digits (3e-11 in the log at `ptukey(3.53e-316, 2, 486.9, { logP: true })`) and took
  20 to 50 ms a call, so that `qtukey(-726.9, 2, 486.9, { logP: true })` took 1.2 s: the lower tail is now scaled from
  q = 2^-1000 by q^((k-1) r).
- `lgamma` at a subnormal argument was Infinity (`lgamma(5e-324)`, now 744.4400719213812 as R), and with it `lbeta`
  (`lbeta(5e-324, 3)`); `lbeta(1e-310, 1e-310)` was NaN (now 714.494526008714 as R), `beta(1e-310, 1e-310)` NaN (now
  Infinity; R gives NaN).
- Densities whose linear value passed through a subnormal intermediate lost digits: `dlaplace` and `dlogis` through
  exp(-|z|) (`dlaplace(9.4863e-158, { mu: 9.4863e-158 + 4.5e-167, sigma: 6.04e-171 })` was 6e-4 off; extraDistr is
  right there), `dlogis`, `dcauchy` and `dnorm` through a subnormal scale (`dnorm(-1.59e-321, { sd: 3e-323 })` 3e-4
  off; `dcauchy(1e-10, { scale: 5e-324 })` was 0, now 1.5726597949504821e-304), `dnbinom` through size / (size + x) at
  a subnormal size (`dnbinom(57, 3.94e-315, { prob: 0.125, log: true })` was 2.4e-8 off), and `dtriang` through a
  subnormal ratio of lengths, as was the log of `ptriang` (extraDistr gives -Inf for it).
- Quantiles at a log p below -708: `qexp`, `qweibull` and `qkumar` took exp(p) on the subnormal grid
  (`qexp(-720.6, { rate: 7.4e-258, logP: true })` was 4e-14 off, `qkumar(-744.24, 1.13, 0.124, { logP: true })` 17%;
  extraDistr gives 0 for it).
- `pgeom` at a subnormal prob was 0 from x = 1e290 on (`pgeom(1e290, 5e-324)`, now 4.940656458412465e-34).
- Gamma and Poisson tails of a few subnormal ulps were 0 (`pchisq(150856.77, 172464.33)`, now 1e-323 as R; its log
  was right): the factor x^a e^-x / Γ(a + 1) underflowed before the product with the series.

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
