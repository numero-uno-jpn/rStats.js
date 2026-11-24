# Roadmap

English | [日本語](ROADMAP.ja.md)

## Goal

Cover the numerical core of R's `stats` package (and the related parts of `base`) in plain
TypeScript, with R's function names, defaults and numerical results: distributions, descriptive
statistics, hypothesis tests, linear models, special functions, numerical methods and the basics
of linear algebra. R is the oracle: every function is tested against R's output, and against
high-precision reference values where R itself is inaccurate (see [docs/accuracy.md](docs/accuracy.md)).

The point is to fill a gap. JavaScript has libraries for distributions and special functions
(such as [stdlib-js](https://github.com/stdlib-js/stdlib), which is accurate and broad) and for
descriptive statistics, and R itself can run in the browser through WebAssembly (webR), at the
cost of a download of tens of megabytes. What is missing is a light library whose results can
be trusted to match R, from the distributions up to the hypothesis tests, including R's
`set.seed()` random streams.

The priority is the analyses used in medical, biological and psychological research. Where R's
`stats` has no function for one of them, the reference is a widely used CRAN package (such as
`car`, `multcomp` or `survival`), installed in the oracle image from the same dated snapshot as
the other packages.

SciPy (`scipy.stats`, `scipy.special`, `scipy.linalg`) is a source of ported code and a guide
to what is useful, but not a target: functions that have no counterpart in R cannot be checked
against R and are not a priority.

## Done

| Area | Status |
|---|---|
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY`, and `erf`, `erfc`, `erfinv`, `erfcinv`, `gammainc`, `perm` (not in R), and the log1p-type functions of R's C API `log1pmx`, `lgamma1p`, `log1mexp`, `log1pexp` |
| Distributions | d/p/q with `lowerTail` and `logP` for all 20 distributions in R's `stats` (including the studentized range), the non-central chi-squared, t, F and beta, and inverse gamma, Kumaraswamy, Pareto, triangular, Laplace (extraDistr) and arcsine; `distSummary` for 23 of them (all but the Wilcoxon signed rank and rank sum distributions and the studentized range) |
| Random numbers | R's default Mersenne-Twister with `set.seed()`-compatible streams, and `RNGkind` with `"L'Ecuyer-CMRG"` (with `parallel`'s `nextRNGStream` and `nextRNGSubStream`) and `sample.kind = "Rounding"`; 26 `r*` functions including `rmultinom` (extraDistr's streams for the extra distributions), `sample`, `sampleInt`, `r2dtable` |
| Time series | `acf`, `pacf`, `ccf` (autocorrelation, partial autocorrelation and cross-correlation) |
| Descriptive statistics | R's summaries (`mean`, `variance`, `quantile` with all nine types, `rank`, `cov`/`cor` matrices, `table`, `cut`, `hist`, `ecdf`, `scale`, ...) and e1071's and DescTools' (`skewness`, `kurtosis`, `geometricMean`, `modes`, `meanAD`, `cv`) |
| Hypothesis tests | R's `htest` functions: `tTest`, `chisqTest` (including simulated p-values and two factor vectors), `fisherTest` (including r × c and simulated p-values), `wilcoxTest`, `corTest`, `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`, `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`, `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest` (with its confidence interval), `ksTest`, the `pairwise*` helpers, `pAdjust`; `aov` (one way), `TukeyHSD`, `zTest` (BSDA), `brunnerMunzelTest` (lawstat), Tamhane's T2/T2', Page's test and type-10 Grubbs' test |
| Regression | Ordinal logistic regression (`polr`), robust regression (`rlm`) and nonlinear least squares (`nls`), with their summaries, covariance, prediction, confidence intervals and model comparisons; ten self-starting models. Separate `/regression` area. |
| Multivariate analysis | Sequential MANOVA (`manova`, `manovaSummary`), linear discriminant analysis (`lda`, `ldaPredict`), canonical correlation (`cancor`), distance calculation (`dist`, `asDist`), hierarchical clustering (`hclust`, `cutree`), k-means (`kmeans`), classical multidimensional scaling (`cmdscale`), correspondence analysis (`ca`, `caSummary`, `caCoord`), multiple correspondence analysis (`mjca`) and non-metric multidimensional scaling (`sammon`, `isoMDS`). Separate `/multivariate` area. |
| Linear models | `lm` with a matrix interface and `summary.lm`'s quantities, `confint`, `predict`; `glm` with a matrix interface (every family and link of R's `stats`), `summary.glm`, the four kinds of residuals, `hatvalues`, `rstandard`, `cooks.distance`, `predict` with standard errors, profile likelihood `confint` (exact limits) and `anova`; robust covariances: sandwich's `vcovHC` (HC0 to HC5) and `vcovCL` (one-way and multi-way clustered, HC0 to HC3) and lmtest's `coeftest` and `coefci`, for modified Poisson regression (risk ratios), weighted regression after inverse probability weighting and difference-in-differences |
| Analysis of variance | `aov`, `lm` and `modelMatrix` from formulas (several factors, interactions, covariates, `Error()` strata), `anova` (sequential and model comparison), car's `Anova` (types II and III), afex's `aov_ez` as `aovEz` (repeated measures, Greenhouse-Geisser and Huynh-Feldt, generalized eta squared), `mauchly.test` |
| Effect sizes and power | effectsize's `cohens_d`, `hedges_g`, `eta_squared`, `omega_squared`, `epsilon_squared` (from `anova` and `Anova` tables, exact confidence limits); `power.t.test`, `power.prop.test`, `power.anova.test` and the power functions of `pwr` |
| More tests | `leveneTest` (car), `propTrendTest` (`prop.trend.test`), `jonckheereTest` (DescTools and clinfun), `cochranQTest` (DescTools), `adTest`, `lillieTest`, `cvmTest`, `sfTest`, `pearsonTest` (nortest); `tTOST` and `tsumTOST` (TOSTER: equivalence and minimal-effect t tests for one, two and paired samples, with the standardised mean difference) |
| Contingency tables and proportions | `binomCI`, `binomDiffCI`, `binomRatioCI` (DescTools' `BinomCI`, `BinomDiffCI`, `BinomRatioCI`), `oddsRatio` (epitools, and epiR's score interval), `fisherTest(x, { midp: true })` (exact2x2), `boschlooTest` (Exact), `gTest`, `stuartMaxwellTest`, `goodmanKruskalGamma` (DescTools), `lblTest` (coin), `chisqTest(x, { nMinus1: true })` (Campbell's 'N − 1' test) and Freeman-Tukey residuals, `tost` (equivalence), `binomDiffEquivalenceTest` (score TOST of two proportions) |
| Multiple comparisons | PMCMRplus's `dscfAllPairsTest` (Steel-Dwass), `kwAllPairsDunnTest`, `kwManyOneDunnTest`, `manyOneUTest` (Steel's many-one rank test), `dunnettTest`, `gamesHowellTest`, `tukeyTest`, Tamhane's T2/T2'; `dunnTest` (dunn.test); `glhtDunnett` (multcomp); Dunnett-type probabilities computed exactly (R's are randomised) |
| Mixed models | lme4's `lmer` as `lmer` (REML and ML; correlated and uncorrelated random effects `(x \| g)`, `(x \|\| g)`, crossed and nested grouping factors `a/b`, `a:b`), with the quantities of `fixef`, `vcov`, `coef(summary())` (without p-values), `VarCorr`, `ranef`, `fitted`, `residuals`, `logLik`, `AIC`, `BIC`, `deviance`, `REMLcrit` and `isSingular`; lmerTest's Satterthwaite t- and F-tests (`summary`, `contest`, Type I/II/III `anova`) and lme4's `anova` of several fits; lme4's `glmer` as `glmer` (all glm families, Laplace approximation and adaptive Gauss-Hermite quadrature) with `summary`, `anova` and `predict` (`glmerSummary`, `glmerAnova`, `glmerPredict`) and `predict` of `lmer` (`lmerPredict`); implemented from Bates et al. (2015) with a sparse Cholesky factorisation; the estimates are the exact optimum of the criterion (lme4 stops close to it). In its own area `@numero-uno-jpn/rstats/mixed` (`dist/mixed.js`), not in the single-file bundle |
| Survival analysis | `survival`'s `survdiff` (log-rank and the G-rho family); `survfit` (Kaplan-Meier, Nelson-Aalen and Fleming-Harrington cumulative hazards, integer weights, robust standard errors, six confidence transformations, medians, restricted means and counting-process data); `rmst2` (unadjusted and covariate-adjusted RMST/RMTL, `survRM2`); `coxph` (Efron and Breslow ties, case weights, strata, summary tests, robust variance and `cluster`; counting-process data) and `coxZph` (proportional-hazards score tests); `cuminc`, `timepoints`, `crr` and `predictCrr` (cumulative incidence, Gray's tests and Fine-Gray regression, `cmprsk`); `survreg`, `survregPredict` and `survregResiduals` (parametric accelerated-failure-time regression) |
| Diagnostic accuracy and method comparison | pROC's `roc`, `auc` (with the partial AUC), `ci.auc`, `roc.test` and `coords` (DeLong's interval and tests, the bootstrap on R's random stream); epiR's `epi.tests` as `diagnosticTests`; BlandAltmanLeh's `bland.altman.stats` as `blandAltman` (with the exact interval of the limits of agreement); mcr's `mcreg` (Deming, weighted Deming and Passing-Bablok regression with analytical, jackknife and bootstrap intervals) |
| Agreement and reliability | `kappa2`, `kappamFleiss`, `icc` (irr), `ICC` (psych's six forms of Shrout and Fleiss), `cronbachAlpha`, `partialR` (psych), `polychor`, `polyserial` (polycor, two-step and maximum likelihood), `pbvnorm`, `omega` (McDonald's ω, psych); effect sizes of repeated-measures designs (`Error()` strata and `aovEz`) |
| Optimisation | `factanal` (maximum likelihood, varimax and promax); `optim` with all six methods (Nelder-Mead, BFGS, CG, L-BFGS-B, SANN, Brent), following R's iterations (except CG, which tries the minimum of the parabola where R tries the midpoint, so its path differs), and `optimHess` |
| Data handling | `completeCases` (`complete.cases`), `naOmit` (`na.omit`), `subset`, `merge`, `rbind` and `cbind` of data frames, `tapply`, `split`, `aggregate`, `pivotLonger` and `pivotWider` (tidyr); formula forms of the tests (`tTest("y ~ g", data)`, `kruskalTest`, `friedmanTest("y ~ w \| b", data)`, `corTest("~ x + y", data)`, ...) |
| Linear algebra | the matrix functions of R's `base`, with `Matrix::lu`, `prcomp` (`stats`) and `MASS::ginv`: matrix arithmetic, `crossprod`, `norm`, `backsolve`, `chol`, `qr` (R's pivoting and LAPACK), `solve`, `det`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and general), `lu`, `prcomp`, `ginv`, `schur` (`Matrix::Schur`) and `expm` (expm's Higham08, Padé and Taylor methods) |
| Numerical methods | `integrate`, `optimize`, `uniroot`, `approx`, `spline`/`splinefun`/`splinefunH`, Lagrange (pracma) and Hermite interpolation, fixed-step `ode` (deSolve), `grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | every jStat function has a replacement ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)), checked against jStat |

The full list is in the [README](README.md#what-is-included); known differences from R are in
[docs/differences-from-r.md](docs/differences-from-r.md).

Regression (the former item 2) was completed for 1.8.0: quantile regression (`rq`), generalized estimating
equations (`geeglm`) and penalized regression (`glmnet`). See [the release changes](CHANGELOG.md#unreleased) and
[the documented differences from R](docs/differences-from-r.md#regression-rq-geeglm-and-glmnet).

## Remaining

The priority is that a medical or psychological study can use the right method: exact methods for small samples,
and effect measures with their confidence intervals, not only p-values. The list was drawn up against the methods of
a statistics web application for medical and psychological research (2026-11-06). In order of priority; the R
function or package that each item is checked against is given in brackets.

The order below (decided 2026-11-24) comes from comparing the methods of EZR, HAD and Excel Toukei (statistics tools
widely used in Japanese medical and psychological research) and ReactiveStat with what rStats.js already has.

1. **Propensity scores** [MatchIt / Matching, WeightIt, cobalt, survey]: the propensity score (logistic or probit),
   balance before and after (standardized differences, variance ratios); **matching** (nearest neighbour 1:1 and 1:k,
   with or without replacement, caliper) with the analyses of the matched sample (paired tests, McNemar, conditional
   logistic regression, Cox stratified by pair or with clustered robust errors, Kaplan-Meier, the ATT); **IPTW** (ATE and
   ATT weights, stabilized, trimmed) with the weighted analyses (linear, logistic and Poisson regression with robust
   errors, weighted Kaplan-Meier and Cox, risk differences and ratios, odds and hazard ratios). Matching and IPTW may be
   two versions
2. **Conditional logistic regression** [survival `clogit`] (with item 1)
3. **Multinomial logistic regression** [nnet `multinom`]
4. **Stepwise selection** [`step`, MASS `stepAIC`]
5. **Mediation and moderation analysis** [mediation `mediate`], including moderated mediation
6. Smaller models: tobit regression (on `survreg`), log-linear models [`loglin`, MASS `loglm`], gamma and beta
   regression [betareg]
7. To be considered afterwards: time-dependent ROC [timeROC, survivalROC], network meta-analysis [netmeta],
   Bradley-Terry paired comparisons [BradleyTerry2], control charts [qcc], time series [`arima`, forecast `auto.arima`]

Mixed models continued (the former item 1) were done for 1.6.0: `confintLmer`, `confintGlmer`, `simulateLmer` and
`simulateGlmer` after lme4's `confint` (profile likelihood and Wald) and `simulate`. Left out, as decided in the
"rStats.js's choices" of [oracle/mixedconfint-behaviour.md](oracle/mixedconfint-behaviour.md) and
[oracle/mixedsimulate-behaviour.md](oracle/mixedsimulate-behaviour.md): bootstrap intervals, the profile table itself,
profiles of `nAGQ > 1` fits and of the dispersion, `newdata`, `newparams` and `allow.new.levels` in `simulate`, and
inverse Gaussian simulation. The `mixed` area stays out of the root export and `dist/rstats.js`.

Meta-analysis (the former item 1) was done for 1.5.0 too, after metafor: `escalc`, `rma` with eleven estimators,
meta-regression and Knapp-Hartung inference, `confintRma`, `predictRma` and `regtest`. Left out, as decided in the
"rStats.js's choices" of [oracle/meta-behaviour.md](oracle/meta-behaviour.md): `ranktest`, `trimfill`, `rma.mh`,
`rma.peto`, `rma.glmm`, `rma.mv`, plotting, and the estimators `PMM`, `GENQ` and `GENQM`.

Sample size and power for trial designs (the former item 1) were done for 1.5.0: epiR's parallel-trial designs,
exact2x2's `powerPaired2x2`, powerSurvEpi's summary-parameter methods and clinfun's `ph2simon`. Left out, as decided in
the "rStats.js's choices" of [oracle/samplesize-behaviour.md](oracle/samplesize-behaviour.md): epiR's other
sample-size families, a sample-size search for McNemar's test, powerSurvEpi's pilot-data, interaction and stratified
forms, `ph2single`, group-sequential designs and inference after a two-stage design.

Survival analysis (the former item 1) was completed in 1.4.0. Not included for now, as decided in the "rStats.js's
choices" of the behaviour documents: `survfit`'s `scale` option and `crr`'s `cengroup`.

The former items 1 (robust standard errors) and 2 (diagnostic accuracy and agreement of measurements) were done in
1.3.0. Left out of them, as recorded in the "rStats.js's choices" of their behaviour documents
([oracle/robust-behaviour.md](oracle/robust-behaviour.md), [oracle/roc-behaviour.md](oracle/roc-behaviour.md),
[oracle/methodcomparison-behaviour.md](oracle/methodcomparison-behaviour.md)): the score and dfbeta residuals of
`coxph` (computed for the robust variance, not exported); pROC's Venkatraman test, intervals of the partial AUC,
smoothed curves, `percent`, the intervals of coordinates, thresholds, sensitivities and specificities (`ci.coords`,
`ci.thresholds`, `ci.se`, `ci.sp`), `power.roc.test` and multiclass curves; intervals of Youden's index and of the
number needed to diagnose; Bland-Altman's regression-based limits and limits for repeated measurements [SimplyAgree
would be the reference], and one-sided limits; mcr's `PaBaLarge` (the binned Passing-Bablok for large data),
`LinReg`, `WLinReg`, `PBequi` and `TS`; `ICC` with missing ratings; TOSTER's `log_TOST`, `wilcox_TOST`,
`boot_t_TOST` and power functions (the power belongs to item 2).

Speed: done for now. The incomplete beta function with both parameters large uses Temme's uniform asymptotic
expansion (constant time instead of a continued fraction of length √(a + b)), with one parameter large and the other
small DiDonato and Morris's expansion (`pt` and `pf` with large degrees of freedom, `pbeta(x, 1e6, 10)`, `pbinom`
with x near 0 or n: about the time of a typical `pbeta` instead of up to 30 times more), and the main d/p functions
leave out the double-double steps that an error bound shows to be unnecessary (see
[docs/performance.md](docs/performance.md)). Remaining: the continued fraction, which stays in double-double and is
still used where neither expansion applies (moderate parameters, such as a = 30 and b = 20, where it is short, and
the far tails).

Out of scope: the parts of SciPy with no counterpart in R (most of `scipy.special` and the
distributions that only `scipy.stats` has). Structural equation models (`lavaan`, including confirmatory factor
analysis and multilevel SEM) are out of scope too: they are the size of a library of their own; for the same reason
so are item response theory [mirt, ltm], latent class analysis [poLCA], multiple imputation [mice] and Gaussian
mixture models [mclust]. Also out of scope:
recycling distribution parameters as vectors (`rnorm(3, mean = c(0, 10, 100))`), since `map` does
the same with R's results and random stream (see
[docs/differences-from-r.md](docs/differences-from-r.md#general)). The other RNG kinds (Wichmann-Hill, Marsaglia-Multicarry, Super-Duper, Knuth-TAOCP) and normal kinds
(Kinderman-Ramberg, Ahrens-Dieter, Box-Muller) are out of scope too: they serve only to reproduce
old code.

## Size

Users of a bundler only get the functions they import (`pnorm` alone is 1.6 KB gzipped), so
adding functions costs them nothing. For CDN use there is one file per area
(`dist/distributions.js`, `dist/tests.js`, `dist/linalg.js`, `dist/descriptive.js`,
`dist/numerics.js`, `dist/special.js`, `dist/mixed.js`), built with esbuild's code splitting so that shared code is
not duplicated, and `dist/rstats.js` with everything except `mixed` (the mixed models are large, so they stay out
of the single-file bundle; decided 2026-11-05). The same areas are subpath exports of the
package (`@numero-uno-jpn/rstats/linalg`, ...). `npm run size` reports the sizes. After
publishing to npm, CDNs that bundle per export (such as esm.sh with `?exports=`) are a further
option.

## Sources for ported code

- Port only from permissively licensed sources: SciPy and xsf (BSD-3), Boost.Math (BSL-1.0),
  statsmodels (BSD-3), lifelines (MIT), the LAPACK reference implementation (modified BSD),
  public-domain code (LINPACK, EISPACK, Cephes as distributed with xsf), and published papers.
- R is the oracle that results are checked against. R's source may be read to find out how R
  behaves, but R's code and GPL packages are never copied or translated, so that rStats.js can stay
  MIT licensed.
- Each ported file names its source, and the source is listed in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See also [CONTRIBUTING.md](CONTRIBUTING.md).
